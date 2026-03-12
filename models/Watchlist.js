const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'My Watchlist'
  },
  stocks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock'
  }],
  alerts: [{
    stock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock'
    },
    targetPrice: Number,
    condition: {
      type: String,
      enum: ['ABOVE', 'BELOW'],
      default: 'ABOVE'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Check alerts
watchlistSchema.methods.checkAlerts = async function() {
  const triggeredAlerts = [];
  
  for (const alert of this.alerts) {
    if (!alert.isActive) continue;
    
    const stock = await mongoose.model('Stock').findById(alert.stock);
    if (!stock) continue;
    
    if (alert.condition === 'ABOVE' && stock.currentPrice >= alert.targetPrice) {
      triggeredAlerts.push({
        ...alert.toObject(),
        currentPrice: stock.currentPrice
      });
      alert.isActive = false;
    } else if (alert.condition === 'BELOW' && stock.currentPrice <= alert.targetPrice) {
      triggeredAlerts.push({
        ...alert.toObject(),
        currentPrice: stock.currentPrice
      });
      alert.isActive = false;
    }
  }
  
  await this.save();
  return triggeredAlerts;
};

module.exports = mongoose.model('Watchlist', watchlistSchema);