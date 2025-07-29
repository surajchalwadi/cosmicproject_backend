const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');
const SocketServer = require('./src/socket/socketServer');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Initialize Socket.IO server
const socketServer = new SocketServer(server);
global.socketServer = socketServer; // Make it globally available

logger.info(`🔌 Socket.IO server initialized`);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});