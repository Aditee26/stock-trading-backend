const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const User = require('../models/User');

// @desc    Get user portfolio
// @route   GET /api/portfolio
// @access  Private
const getPortfolio = async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user.id })
      .populate({
        path: 'holdings.stock',
        select: 'symbol companyName currentPrice dayChange dayChangePercent sector'
      });

    if (!portfolio) {
      portfolio = await Portfolio.create({
        user: req.user.id,
        cashBalance: 100000
      });
    }

    // Get user data for cash balance
    const user = await User.findById(req.user.id);
    portfolio.cashBalance = user.virtualBalance;

    // Calculate portfolio metrics
    await portfolio.save();

    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch portfolio' 
    });
  }
};

// @desc    Create new portfolio
// @route   POST /api/portfolio
// @access  Private
const createPortfolio = async (req, res) => {
  try {
    const { name } = req.body;

    // Check if user already has a portfolio
    const existingPortfolio = await Portfolio.findOne({ user: req.user.id });
    
    if (existingPortfolio) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already has a portfolio' 
      });
    }

    const portfolio = await Portfolio.create({
      user: req.user.id,
      name: name || 'Main Portfolio',
      cashBalance: 100000
    });

    res.status(201).json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create portfolio' 
    });
  }
};

// @desc    Update portfolio
// @route   PUT /api/portfolio/:id
// @access  Private
const updatePortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!portfolio) {
      return res.status(404).json({ 
        success: false, 
        message: 'Portfolio not found' 
      });
    }

    // Only allow updating name
    portfolio.name = req.body.name || portfolio.name;
    await portfolio.save();

    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update portfolio' 
    });
  }
};

// @desc    Get portfolio performance
// @route   GET /api/portfolio/performance
// @access  Private
const getPortfolioPerformance = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user.id });

    if (!portfolio) {
      return res.status(404).json({ 
        success: false, 
        message: 'Portfolio not found' 
      });
    }

    // Get transaction history
    const transactions = await Transaction.find({ user: req.user.id })
      .populate('stock', 'symbol companyName')
      .sort('-createdAt')
      .limit(50);

    // Calculate performance metrics
    const performance = {
      history: portfolio.performanceHistory,
      transactions: transactions,
      metrics: {
        totalValue: portfolio.totalValue,
        totalInvestment: portfolio.totalInvestment,
        totalProfitLoss: portfolio.totalProfitLoss,
        totalProfitLossPercent: portfolio.totalProfitLossPercent,
        dayProfitLoss: portfolio.dayProfitLoss,
        dayProfitLossPercent: portfolio.dayProfitLossPercent,
        cashBalance: portfolio.cashBalance
      },
      diversification: portfolio.diversification
    };

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Get portfolio performance error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch portfolio performance' 
    });
  }
};

// @desc    Add funds to portfolio
// @route   POST /api/portfolio/add-funds
// @access  Private
const addFunds = async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount must be greater than 0' 
      });
    }

    const user = await User.findById(req.user.id);
    user.virtualBalance += amount;
    await user.save();

    // Update portfolio cash balance
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    portfolio.cashBalance = user.virtualBalance;
    await portfolio.save();

    res.json({
      success: true,
      message: `Successfully added $${amount} to your account`,
      data: {
        newBalance: user.virtualBalance
      }
    });
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add funds' 
    });
  }
};

module.exports = {
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  getPortfolioPerformance,
  addFunds
};