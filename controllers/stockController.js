const Stock = require('../models/Stock');
const Watchlist = require('../models/Watchlist');
const axios = require('axios');

// @desc    Get all stocks
// @route   GET /api/stocks
// @access  Public
const getStocks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sector,
      sortBy = 'symbol',
      order = 'asc'
    } = req.query;

    const query = { isActive: true };

    // Search
    if (search) {
      query.$or = [
        { symbol: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by sector
    if (sector) {
      query.sector = sector;
    }

    // Sorting
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const stocks = await Stock.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Stock.countDocuments(query);

    // Get unique sectors for filters
    const sectors = await Stock.distinct('sector');

    res.json({
      success: true,
      data: stocks,
      filters: {
        sectors
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get stocks error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stocks' 
    });
  }
};

// @desc    Get single stock by symbol
// @route   GET /api/stocks/:symbol
// @access  Public
const getStockBySymbol = async (req, res) => {
  try {
    const stock = await Stock.findOne({ 
      symbol: req.params.symbol.toUpperCase(),
      isActive: true 
    });

    if (!stock) {
      return res.status(404).json({ 
        success: false, 
        message: 'Stock not found' 
      });
    }

    // Check if stock is in user's watchlist (if authenticated)
    let inWatchlist = false;
    if (req.user) {
      const watchlist = await Watchlist.findOne({ 
        user: req.user.id,
        stocks: stock._id
      });
      inWatchlist = !!watchlist;
    }

    res.json({
      success: true,
      data: {
        ...stock.toObject(),
        inWatchlist
      }
    });
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stock' 
    });
  }
};

// @desc    Get stock historical data
// @route   GET /api/stocks/:symbol/history
// @access  Public
const getStockHistory = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1M' } = req.query;

    const stock = await Stock.findOne({ 
      symbol: symbol.toUpperCase() 
    });

    if (!stock) {
      return res.status(404).json({ 
        success: false, 
        message: 'Stock not found' 
      });
    }

    // Filter historical data based on period
    const now = new Date();
    let startDate;

    switch(period) {
      case '1D':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case '1W':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case '1M':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3M':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6M':
        startDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case '1Y':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const historicalData = stock.historicalData
      .filter(data => data.date >= startDate)
      .sort((a, b) => a.date - b.date);

    res.json({
      success: true,
      data: historicalData
    });
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stock history' 
    });
  }
};

// @desc    Get market movers (gainers/losers)
// @route   GET /api/stocks/movers/:type
// @access  Public
const getMarketMovers = async (req, res) => {
  try {
    const { type } = req.params; // 'gainers' or 'losers'
    const { limit = 10 } = req.query;

    let sort = {};
    if (type === 'gainers') {
      sort = { dayChangePercent: -1 };
    } else {
      sort = { dayChangePercent: 1 };
    }

    const stocks = await Stock.find({ isActive: true })
      .sort(sort)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: stocks
    });
  } catch (error) {
    console.error('Get market movers error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch market movers' 
    });
  }
};

// @desc    Search stocks
// @route   GET /api/stocks/search/:query
// @access  Public
const searchStocks = async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const stocks = await Stock.find({
      $or: [
        { symbol: { $regex: query, $options: 'i' } },
        { companyName: { $regex: query, $options: 'i' } }
      ],
      isActive: true
    })
    .limit(parseInt(limit))
    .select('symbol companyName sector currentPrice dayChangePercent');

    res.json({
      success: true,
      data: stocks
    });
  } catch (error) {
    console.error('Search stocks error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search stocks' 
    });
  }
};

// @desc    Update stock price (for admin)
// @route   PUT /api/stocks/:id
// @access  Private/Admin
const updateStock = async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);

    if (!stock) {
      return res.status(404).json({ 
        success: false, 
        message: 'Stock not found' 
      });
    }

    const updatedStock = await Stock.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: Date.now() },
      { new: true, runValidators: true }
    );

    // Emit real-time update via socket
    const io = req.app.get('io');
    io.to(`stock-${stock.symbol}`).emit('stockUpdate', updatedStock);

    res.json({
      success: true,
      data: updatedStock
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update stock' 
    });
  }
};

// @desc    Fetch real-time stock data from API
// @route   POST /api/stocks/fetch
// @access  Private/Admin
const fetchStockData = async (req, res) => {
  try {
    const { symbols } = req.body;
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const updatedStocks = [];

    for (const symbol of symbols) {
      try {
        // Fetch current price
        const quoteResponse = await axios.get(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
        );

        const quote = quoteResponse.data['Global Quote'];
        
        if (quote && Object.keys(quote).length > 0) {
          const currentPrice = parseFloat(quote['05. price']);
          const previousClose = parseFloat(quote['08. previous close']);
          const volume = parseInt(quote['06. volume']);
          
          // Fetch company overview
          const overviewResponse = await axios.get(
            `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
          );
          
          const overview = overviewResponse.data;
          
          const stock = await Stock.findOneAndUpdate(
            { symbol },
            {
              currentPrice,
              previousClose,
              volume,
              dayChange: currentPrice - previousClose,
              dayChangePercent: ((currentPrice - previousClose) / previousClose) * 100,
              marketCap: parseFloat(overview.MarketCapitalization) || 0,
              pe: parseFloat(overview.PERatio) || null,
              dividendYield: parseFloat(overview.DividendYield) || 0,
              week52High: parseFloat(overview['52WeekHigh']) || 0,
              week52Low: parseFloat(overview['52WeekLow']) || 0,
              lastUpdated: Date.now()
            },
            { new: true }
          );
          
          if (stock) {
            updatedStocks.push(stock);
            
            // Emit update via socket
            const io = req.app.get('io');
            io.to(`stock-${symbol}`).emit('stockUpdate', stock);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
      }
      
      // Rate limiting for API
      await new Promise(resolve => setTimeout(resolve, 12000));
    }

    res.json({
      success: true,
      message: `Updated ${updatedStocks.length} stocks`,
      data: updatedStocks
    });
  } catch (error) {
    console.error('Fetch stock data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stock data' 
    });
  }
};

module.exports = {
  getStocks,
  getStockBySymbol,
  getStockHistory,
  getMarketMovers,
  searchStocks,
  updateStock,
  fetchStockData
};