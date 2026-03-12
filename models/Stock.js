const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    unique: true
  },
  companyName: {
    type: String,
    required: true
  },
  sector: {
    type: String,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  previousClose: {
    type: Number,
    required: true
  },
  dayChange: {
    type: Number,
    default: 0
  },
  dayChangePercent: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    default: 0
  },
  marketCap: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  historicalData: [{
    date: Date,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
  }]
});

module.exports = mongoose.model('Stock', stockSchema);