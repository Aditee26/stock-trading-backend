const express = require('express');
const router = express.Router();
const {
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  getPortfolioPerformance,
  addFunds
} = require('../controllers/portfolioController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/', getPortfolio);
router.post('/', createPortfolio);
router.put('/:id', updatePortfolio);
router.get('/performance', getPortfolioPerformance);
router.post('/add-funds', addFunds);

module.exports = router;