const express = require('express');
const router = express.Router();
const {
  getStocks,
  getStockBySymbol,
  getStockHistory,
  getMarketMovers,
  searchStocks,
  updateStock,
  fetchStockData
} = require('../controllers/stockController');
const { protect, admin } = require('../middleware/auth');

// Public routes
router.get('/', getStocks);
router.get('/search/:query', searchStocks);
router.get('/movers/:type', getMarketMovers);
router.get('/:symbol', getStockBySymbol);
router.get('/:symbol/history', getStockHistory);

// Admin only routes
router.put('/:id', protect, admin, updateStock);
router.post('/fetch', protect, admin, fetchStockData);

module.exports = router;