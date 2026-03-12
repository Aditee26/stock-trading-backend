const socketIo = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user-${socket.userId}`);

    // Handle stock subscription
    socket.on('subscribeStocks', (symbols) => {
      symbols.forEach(symbol => {
        socket.join(`stock-${symbol}`);
      });
      console.log(`User ${socket.userId} subscribed to stocks:`, symbols);
    });

    // Handle stock unsubscription
    socket.on('unsubscribeStocks', (symbols) => {
      symbols.forEach(symbol => {
        socket.leave(`stock-${symbol}`);
      });
    });

    // Handle price alerts
    socket.on('setPriceAlert', async (data) => {
      const { stockId, targetPrice, condition } = data;
      
      // Store alert in database (implement this)
      // await PriceAlert.create({
      //   user: socket.userId,
      //   stock: stockId,
      //   targetPrice,
      //   condition
      // });

      console.log(`Price alert set for user ${socket.userId}:`, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

// Function to emit stock updates
const emitStockUpdate = (symbol, data) => {
  if (io) {
    io.to(`stock-${symbol}`).emit('stockUpdate', {
      symbol,
      ...data,
      timestamp: new Date()
    });
  }
};

// Function to emit user notification
const emitUserNotification = (userId, notification) => {
  if (io) {
    io.to(`user-${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date()
    });
  }
};

module.exports = {
  initializeSocket,
  emitStockUpdate,
  emitUserNotification
};