const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const User = require('../models/User');
const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');

// All routes require admin authentication
router.use(protect, admin);

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalStocks,
      totalTransactions,
      totalVolume,
      recentUsers,
      recentTransactions
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Stock.countDocuments({ isActive: true }),
      Transaction.countDocuments(),
      Transaction.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      User.find().select('-password').sort('-createdAt').limit(5),
      Transaction.find()
        .populate('user', 'name email')
        .populate('stock', 'symbol companyName')
        .sort('-createdAt')
        .limit(10)
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          totalStocks,
          totalTransactions,
          totalVolume: totalVolume[0]?.total || 0
        },
        recentUsers,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// System health
router.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed'
    });
  }
});

module.exports = router;