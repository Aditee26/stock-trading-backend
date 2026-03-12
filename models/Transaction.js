const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  type: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'COMPLETED'
  },
  orderType: {
    type: String,
    enum: ['MARKET', 'LIMIT', 'STOP'],
    default: 'MARKET'
  },
  limitPrice: {
    type: Number,
    min: 0
  },
  stopPrice: {
    type: Number,
    min: 0
  },
  fees: {
    type: Number,
    default: 0
  },
  executedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ stock: 1, createdAt: -1 });

// Calculate profit/loss for sell transactions
transactionSchema.methods.calculateProfitLoss = async function() {
  if (this.type !== 'SELL') return 0;
  
  const buyTransactions = await this.constructor.find({
    user: this.user,
    stock: this.stock,
    type: 'BUY',
    createdAt: { $lt: this.createdAt }
  }).sort({ createdAt: -1 });
  
  let remainingQuantity = this.quantity;
  let totalCost = 0;
  
  for (const buyTx of buyTransactions) {
    const quantityToUse = Math.min(remainingQuantity, buyTx.quantity);
    totalCost += quantityToUse * buyTx.price;
    remainingQuantity -= quantityToUse;
    if (remainingQuantity <= 0) break;
  }
  
  const profitLoss = this.totalAmount - totalCost;
  return profitLoss;
};

module.exports = mongoose.model('Transaction', transactionSchema);