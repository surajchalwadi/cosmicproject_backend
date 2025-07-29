const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io;

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000', 
        'http://localhost:5000',
        'https://cosmic-projectfrontend.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      logger.error(`Socket authentication error: ${error.message}`);
      next(new Error('Authentication failed'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId} (Role: ${socket.userRole})`);

    // Join user to their role-based room(s)
    const joinedRooms = [];
    if (typeof socket.userRole === 'string') {
      const role = socket.userRole.toLowerCase();
      if (role === 'superadmin' || role === 'super-admin') {
        socket.join('superadmin');
        joinedRooms.push('superadmin');
      } else if (role === 'manager') {
        socket.join('manager');
        joinedRooms.push('manager');
      } else if (role === 'technician') {
        socket.join('technician');
        joinedRooms.push('technician');
      }
    }
    socket.join(`user_${socket.userId}`);
    joinedRooms.push(`user_${socket.userId}`);
    logger.info(`User ${socket.userId} joined rooms: ${joinedRooms.join(', ')}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });

    // Handle custom events
    socket.on('join_room', (roomName) => {
      socket.join(roomName);
      logger.info(`User ${socket.userId} joined room: ${roomName}`);
    });

    socket.on('leave_room', (roomName) => {
      socket.leave(roomName);
      logger.info(`User ${socket.userId} left room: ${roomName}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};