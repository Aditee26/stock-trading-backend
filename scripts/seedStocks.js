const mongoose = require('mongoose');
const Stock = require('../models/Stock');
require('dotenv').config();

const stocks = [
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    sector: 'Technology',
    currentPrice: 175.50,
    previousClose: 174.00,
    dayChange: 1.50,
    dayChangePercent: 0.86,
    volume: 50000000,
    marketCap: 2800000000000
  },
  {
    symbol: 'GOOGL',
    companyName: 'Alphabet Inc.',
    sector: 'Technology',
    currentPrice: 140.25,
    previousClose: 139.00,
    dayChange: 1.25,
    dayChangePercent: 0.90,
    volume: 25000000,
    marketCap: 1750000000000
  },
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    sector: 'Technology',
    currentPrice: 380.50,
    previousClose: 378.00,
    dayChange: 2.50,
    dayChangePercent: 0.66,
    volume: 30000000,
    marketCap: 2800000000000
  },
  {
    symbol: 'AMZN',
    companyName: 'Amazon.com Inc.',
    sector: 'Consumer Cyclical',
    currentPrice: 145.75,
    previousClose: 144.50,
    dayChange: 1.25,
    dayChangePercent: 0.87,
    volume: 40000000,
    marketCap: 1500000000000
  },
  {
    symbol: 'TSLA',
    companyName: 'Tesla Inc.',
    sector: 'Automotive',
    currentPrice: 245.50,
    previousClose: 248.00,
    dayChange: -2.50,
    dayChangePercent: -1.01,
    volume: 100000000,
    marketCap: 780000000000
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected...');
    
    await Stock.deleteMany({});
    await Stock.insertMany(stocks);
    
    console.log('Stocks seeded successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });