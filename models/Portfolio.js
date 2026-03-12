const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  averageBuyPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalInvestment: {
    type: Number,
    required: true,
    min: 0
  },
  currentValue: {
    type: Number,
    default: 0
  },
  profitLoss: {
    type: Number,
    default: 0
  },
  profitLossPercent: {
    type: Number,
    default: 0
  },
  dayChange: {
    type: Number,
    default: 0
  },
  dayChangePercent: {
    type: Number,
    default: 0
  }
}, { _id: false });

const portfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'Main Portfolio'
  },
  holdings: [holdingSchema],
  totalValue: {
    type: Number,
    default: 0
  },
  totalInvestment: {
    type: Number,
    default: 0
  },
  totalProfitLoss: {
    type: Number,
    default: 0
  },
  totalProfitLossPercent: {
    type: Number,
    default: 0
  },
  dayProfitLoss: {
    type: Number,
    default: 0
  },
  dayProfitLossPercent: {
    type: Number,
    default: 0
  },
  cashBalance: {
    type: Number,
    default: 100000
  },
  diversification: {
    type: Map,
    of: Number,
    default: {}
  },
  performanceHistory: [{
    date: Date,
    value: Number
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

// Update portfolio values before saving
portfolioSchema.pre('save', async function(next) {
  if (this.isModified('holdings') || this.isModified('cashBalance')) {
    let totalInvestment = 0;
    let totalCurrentValue = 0;
    
    // Populate stock data if needed
    if (this.holdings.length > 0) {
      await this.populate('holdings.stock');
      
      this.holdings.forEach(holding => {
        if (holding.stock) {
          const currentPrice = holding.stock.currentPrice;
          const currentValue = currentPrice * holding.quantity;
          const profitLoss = currentValue - holding.totalInvestment;
          const dayChange = holding.stock.dayChange * holding.quantity;
          
          holding.currentValue = currentValue;
          holding.profitLoss = profitLoss;
          holding.profitLossPercent = (profitLoss / holding.totalInvestment) * 100;
          holding.dayChange = dayChange;
          holding.dayChangePercent = holding.stock.dayChangePercent;
          
          totalInvestment += holding.totalInvestment;
          totalCurrentValue += currentValue;
        }
      });
    }
    
    this.totalInvestment = totalInvestment;
    this.totalValue = totalCurrentValue + this.cashBalance;
    this.totalProfitLoss = totalCurrentValue - totalInvestment;
    this.totalProfitLossPercent = totalInvestment > 0 
      ? (this.totalProfitLoss / totalInvestment) * 100 
      : 0;
    
    // Calculate diversification
    const diversification = {};
    this.holdings.forEach(holding => {
      if (holding.stock) {
        const sector = holding.stock.sector;
        diversification[sector] = (diversification[sector] || 0) + holding.currentValue;
      }
    });
    
    // Convert to percentages
    Object.keys(diversification).forEach(sector => {
      diversification[sector] = (diversification[sector] / totalCurrentValue) * 100;
    });
    
    this.diversification = diversification;
    
    // Add to performance history
    this.performanceHistory.push({
      date: new Date(),
      value: this.totalValue
    });
    
    // Keep only last 30 days of history
    if (this.performanceHistory.length > 30) {
      this.performanceHistory = this.performanceHistory.slice(-30);
    }
  }
  
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Portfolio', portfolioSchema);