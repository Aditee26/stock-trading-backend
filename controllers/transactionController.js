const Transaction = require('../models/Transaction');
const Portfolio = require('../models/Portfolio');
const Stock = require('../models/Stock');
const User = require('../models/User');

// @desc    Buy stock
// @route   POST /api/transactions/buy
// @access  Private
const buyStock = async (req, res) => {
  try {
    const { stockId, quantity, orderType = 'MARKET', limitPrice, stopPrice } = req.body;
    const userId = req.user.id;

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be greater than 0' 
      });
    }

    // Get stock details
    const stock = await Stock.findById(stockId);
    if (!stock) {
      return res.status(404).json({ 
        success: false, 
        message: 'Stock not found' 
      });
    }

    // Determine execution price
    let executionPrice = stock.currentPrice;
    if (orderType === 'LIMIT' && limitPrice) {
      if (stock.currentPrice > limitPrice) {
        return res.status(400).json({ 
          success: false, 
          message: 'Limit price not met' 
        });
      }
      executionPrice = limitPrice;
    }

    const totalCost = executionPrice * quantity;

    // Check user balance
    const user = await User.findById(userId);
    if (user.virtualBalance < totalCost) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Required: $${totalCost.toFixed(2)}, Available: $${user.virtualBalance.toFixed(2)}` 
      });
    }

    // Create transaction
    const transaction = await Transaction.create({
      user: userId,
      stock: stockId,
      type: 'BUY',
      quantity,
      price: executionPrice,
      totalAmount: totalCost,
      orderType,
      limitPrice,
      stopPrice,
      status: 'COMPLETED'
    });

    // Update user balance
    user.virtualBalance -= totalCost;
    user.tradesCount += 1;
    user.totalInvested += totalCost;
    await user.save();

    // Update portfolio
    let portfolio = await Portfolio.findOne({ user: userId });
    if (!portfolio) {
      portfolio = await Portfolio.create({
        user: userId,
        cashBalance: user.virtualBalance
      });
    }

    // Find existing holding
    const holdingIndex = portfolio.holdings.findIndex(
      h => h.stock.toString() === stockId
    );

    if (holdingIndex > -1) {
      // Update existing holding
      const holding = portfolio.holdings[holdingIndex];
      const newQuantity = holding.quantity + quantity;
      const newTotalInvestment = holding.totalInvestment + totalCost;
      
      portfolio.holdings[holdingIndex] = {
        ...holding.toObject(),
        quantity: newQuantity,
        averageBuyPrice: newTotalInvestment / newQuantity,
        totalInvestment: newTotalInvestment
      };
    } else {
      // Add new holding
      portfolio.holdings.push({
        stock: stockId,
        quantity,
        averageBuyPrice: executionPrice,
        totalInvestment: totalCost
      });
    }

    portfolio.cashBalance = user.virtualBalance;
    await portfolio.save();

    // Populate stock details
    await transaction.populate('stock', 'symbol companyName');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`user-${userId}`).emit('transactionUpdate', {
      type: 'BUY',
      transaction,
      newBalance: user.virtualBalance
    });

    res.status(201).json({
      success: true,
      message: `Successfully bought ${quantity} shares of ${stock.symbol}`,
      data: {
        transaction,
        newBalance: user.virtualBalance,
        portfolio
      }
    });
  } catch (error) {
    console.error('Buy stock error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to buy stock' 
    });
  }
};

// @desc    Sell stock
// @route   POST /api/transactions/sell
// @access  Private
const sellStock = async (req, res) => {
  try {
    const { stockId, quantity, orderType = 'MARKET', limitPrice, stopPrice } = req.body;
    const userId = req.user.id;

    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be greater than 0' 
      });
    }

    // Get stock details
    const stock = await Stock.findById(stockId);
    if (!stock) {
      return res.status(404).json({ 
        success: false, 
        message: 'Stock not found' 
      });
    }

    // Get portfolio
    const portfolio = await Portfolio.findOne({ user: userId });
    if (!portfolio) {
      return res.status(404).json({ 
        success: false, 
        message: 'Portfolio not found' 
      });
    }

    // Check if user owns enough shares
    const holding = portfolio.holdings.find(
      h => h.stock.toString() === stockId
    );

    if (!holding || holding.quantity < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient shares. You own ${holding?.quantity || 0} shares` 
      });
    }

    // Determine execution price
    let executionPrice = stock.currentPrice;
    if (orderType === 'LIMIT' && limitPrice) {
      if (stock.currentPrice < limitPrice) {
        return res.status(400).json({ 
          success: false, 
          message: 'Limit price not met' 
        });
      }
      executionPrice = limitPrice;
    }

    const totalAmount = executionPrice * quantity;

    // Create transaction
    const transaction = await Transaction.create({
      user: userId,
      stock: stockId,
      type: 'SELL',
      quantity,
      price: executionPrice,
      totalAmount,
      orderType,
      limitPrice,
      stopPrice,
      status: 'COMPLETED'
    });

    // Update user balance
    const user = await User.findById(userId);
    user.virtualBalance += totalAmount;
    user.tradesCount += 1;
    await user.save();

    // Update portfolio
    holding.quantity -= quantity;
    holding.totalInvestment = holding.averageBuyPrice * holding.quantity;

    if (holding.quantity === 0) {
      // Remove holding if quantity becomes 0
      portfolio.holdings = portfolio.holdings.filter(
        h => h.stock.toString() !== stockId
      );
    }

    portfolio.cashBalance = user.virtualBalance;
    await portfolio.save();

    // Populate stock details
    await transaction.populate('stock', 'symbol companyName');

    // Calculate profit/loss
    const profitLoss = await transaction.calculateProfitLoss();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`user-${userId}`).emit('transactionUpdate', {
      type: 'SELL',
      transaction,
      profitLoss,
      newBalance: user.virtualBalance
    });

    res.json({
      success: true,
      message: `Successfully sold ${quantity} shares of ${stock.symbol}`,
      data: {
        transaction,
        profitLoss,
        newBalance: user.virtualBalance,
        portfolio
      }
    });
  } catch (error) {
    console.error('Sell stock error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to sell stock' 
    });
  }
};

// @desc    Get user transactions
// @route   GET /api/transactions
// @access  Private
const getUserTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, symbol } = req.query;
    const query = { user: req.user.id };

    if (type) {
      query.type = type;
    }

    if (symbol) {
      const stocks = await Stock.find({ 
        symbol: { $regex: symbol, $options: 'i' } 
      });
      query.stock = { $in: stocks.map(s => s._id) };
    }

    const transactions = await Transaction.find(query)
      .populate('stock', 'symbol companyName')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transactions' 
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('stock', 'symbol companyName sector');

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transaction' 
    });
  }
};

// @desc    Cancel pending transaction
// @route   PUT /api/transactions/:id/cancel
// @access  Private
const cancelTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
      status: 'PENDING'
    });

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pending transaction not found' 
      });
    }

    transaction.status = 'CANCELLED';
    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Cancel transaction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel transaction' 
    });
  }
};

module.exports = {
  buyStock,
  sellStock,
  getUserTransactions,
  getTransaction,
  cancelTransaction
};