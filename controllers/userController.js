const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort('-createdAt');

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's portfolio
    const portfolio = await Portfolio.findOne({ user: userId })
      .populate('holdings.stock');

    // Get recent transactions
    const recentTransactions = await Transaction.find({ user: userId })
      .populate('stock', 'symbol companyName')
      .sort('-createdAt')
      .limit(10);

    res.json({
      success: true,
      data: {
        user,
        portfolio,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const { name, email, role, virtualBalance, isActive } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (virtualBalance !== undefined) user.virtualBalance = virtualBalance;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // Update portfolio cash balance if virtual balance changed
    if (virtualBalance !== undefined) {
      const portfolio = await Portfolio.findOne({ user: userId });
      if (portfolio) {
        portfolio.cashBalance = virtualBalance;
        await portfolio.save();
      }
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete - just deactivate
    user.isActive = false;
    await user.save();

    // Or hard delete - uncomment below for permanent deletion
    // await Promise.all([
    //   User.findByIdAndDelete(userId),
    //   Portfolio.deleteMany({ user: userId }),
    //   Transaction.deleteMany({ user: userId }),
    //   Watchlist.deleteMany({ user: userId })
    // ]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const portfolio = await Portfolio.findOne({ user: userId });
    
    // Get transaction stats
    const transactionStats = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get monthly performance
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          buyVolume: {
            $sum: {
              $cond: [{ $eq: ['$type', 'BUY'] }, '$totalAmount', 0]
            }
          },
          sellVolume: {
            $sum: {
              $cond: [{ $eq: ['$type', 'SELL'] }, '$totalAmount', 0]
            }
          },
          trades: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate win rate
    const closedTrades = await Transaction.find({
      user: userId,
      type: 'SELL'
    });

    let winningTrades = 0;
    for (const trade of closedTrades) {
      const profit = await trade.calculateProfitLoss();
      if (profit > 0) winningTrades++;
    }

    const winRate = closedTrades.length > 0 
      ? (winningTrades / closedTrades.length) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        portfolio: {
          totalValue: portfolio?.totalValue || 0,
          totalProfitLoss: portfolio?.totalProfitLoss || 0,
          totalProfitLossPercent: portfolio?.totalProfitLossPercent || 0,
          holdingsCount: portfolio?.holdings?.length || 0
        },
        transactions: {
          buyCount: transactionStats.find(t => t._id === 'BUY')?.count || 0,
          sellCount: transactionStats.find(t => t._id === 'SELL')?.count || 0,
          totalInvested: transactionStats.find(t => t._id === 'BUY')?.totalAmount || 0,
          totalReturned: transactionStats.find(t => t._id === 'SELL')?.totalAmount || 0
        },
        performance: {
          winRate: winRate.toFixed(2),
          winningTrades,
          totalTrades: closedTrades.length,
          monthlyStats
        }
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      user.email = email;
    }

    if (name) user.name = name;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  updateProfile,
  changePassword
};