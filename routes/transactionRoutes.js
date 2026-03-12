const express = require('express');
const router = express.Router();
const {
  buyStock,
  sellStock,
  getUserTransactions,
  getTransaction,
  cancelTransaction
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.post('/buy', buyStock);
router.post('/sell', sellStock);  // Fixed: removed the extra character
router.get('/', getUserTransactions);
router.get('/:id', getTransaction);
router.put('/:id/cancel', cancelTransaction);

module.exports = router;