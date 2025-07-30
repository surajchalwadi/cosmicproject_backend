const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const User = require('../models/User');

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:3000",
          "http://localhost:5173", 
          "https://cosmic-projectfrontend.vercel.app",
          "https://cosmicprojectfrontend.vercel.app"
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.connectedUsers = new Map(); // userId -> socketId
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        // Try to get token from different possible locations
        let token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                   socket.handshake.query.token ||
                   socket.handshake.auth.authorization?.replace('Bearer ', '');

        if (!token) {
          console.log('Socket authentication failed: No token provided');
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          console.log('Socket authentication failed: User not found');
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        console.log(`Socket authenticated for user: ${user.name} (${user._id})`);
        next();
      } catch (error) {
        console.error('Socket authentication error:', error.message);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.name} (${socket.userId})`);
      
      // Store connected user
      this.connectedUsers.set(socket.userId, socket.id);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join user to role-based rooms
      socket.join(`role:${socket.user.role}`);

      // Send connection confirmation
      socket.emit('connected', {
        message: 'Connected to real-time updates',
        user: {
          id: socket.user._id,
          name: socket.user.name,
          role: socket.user.role
        }
      });

      // Handle notification acknowledgment
      socket.on('notification:acknowledged', (data) => {
        console.log(`Notification acknowledged by ${socket.user.name}:`, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.name} (${socket.userId})`);
        this.connectedUsers.delete(socket.userId);
      });

      // Handle user typing events (for future chat features)
      socket.on('typing', (data) => {
        socket.broadcast.to(data.room).emit('user_typing', {
          userId: socket.userId,
          userName: socket.user.name
        });
      });

      // Handle stop typing events
      socket.on('stop_typing', (data) => {
        socket.broadcast.to(data.room).emit('user_stop_typing', {
          userId: socket.userId,
          userName: socket.user.name
        });
      });
    });
  }

  // Send notification to specific user
  async sendNotificationToUser(userId, notification) {
    try {
      console.log(`Sending notification to user ${userId}:`, notification);
      
      // Save notification to database
      const savedNotification = await Notification.create({
        userId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        priority: notification.priority || 'medium',
        category: notification.category || 'general',
        metadata: notification.metadata || {}
      });

      console.log(`Notification saved to database:`, savedNotification._id);

      // Send to connected user
      const socketId = this.connectedUsers.get(userId);
      if (socketId) {
        console.log(`User ${userId} is connected, sending real-time notification`);
        this.io.to(socketId).emit('notification:new', {
          ...savedNotification.toObject(),
          timestamp: new Date()
        });
      } else {
        console.log(`User ${userId} is not connected, notification saved to database only`);
      }

      return savedNotification;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  }

  // Send notification to multiple users
  async sendNotificationToUsers(userIds, notification) {
    const promises = userIds.map(userId => this.sendNotificationToUser(userId, notification));
    return Promise.all(promises);
  }

  // Send notification to all users with specific role
  async sendNotificationToRole(role, notification) {
    try {
      console.log(`Sending notification to role ${role}:`, notification);
      
      // Get all users with the specified role
      const users = await User.find({ role }).select('_id');
      const userIds = users.map(user => user._id.toString());

      console.log(`Found ${userIds.length} users with role ${role}`);

      // Send to all users with this role
      await this.sendNotificationToUsers(userIds, notification);

      // Also emit to role room for real-time updates
      this.io.to(`role:${role}`).emit('notification:new', {
        ...notification,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error sending notification to role:', error);
      throw error;
    }
  }

  // Send notification to all connected users
  async sendNotificationToAll(notification) {
    try {
      console.log(`Sending notification to all users:`, notification);
      
      // Get all users
      const users = await User.find().select('_id');
      const userIds = users.map(user => user._id.toString());

      // Send to all users
      await this.sendNotificationToUsers(userIds, notification);

      // Also emit to all connected clients
      this.io.emit('notification:new', {
        ...notification,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error sending notification to all:', error);
      throw error;
    }
  }

  // Project events
  emitProjectCreated(project, createdBy) {
    this.io.emit('project:created', {
      project,
      createdBy: {
        id: createdBy._id,
        name: createdBy.name,
        role: createdBy.role
      },
      timestamp: new Date()
    });
  }

  emitProjectUpdated(project, updatedBy) {
    this.io.emit('project:updated', {
      project,
      updatedBy: {
        id: updatedBy._id,
        name: updatedBy.name,
        role: updatedBy.role
      },
      timestamp: new Date()
    });
  }

  emitProjectStatusChanged(project, newStatus, changedBy) {
    this.io.emit('project:status_changed', {
      project,
      status: newStatus,
      changedBy: {
        id: changedBy._id,
        name: changedBy.name,
        role: changedBy.role
      },
      timestamp: new Date()
    });
  }

  // Task events
  emitTaskAssigned(task, assignedTo, assignedBy) {
    // Send to specific user who was assigned the task
    const socketId = this.connectedUsers.get(assignedTo._id.toString());
    if (socketId) {
      this.io.to(socketId).emit('task:assigned', {
        task,
        assignedBy: {
          id: assignedBy._id,
          name: assignedBy.name,
          role: assignedBy.role
        },
        timestamp: new Date()
      });
    }

    // Also emit to all managers and super admins
    this.io.to('role:manager').to('role:superadmin').emit('task:assigned', {
      task,
      assignedTo: {
        id: assignedTo._id,
        name: assignedTo.name,
        role: assignedTo.role
      },
      assignedBy: {
        id: assignedBy._id,
        name: assignedBy.name,
        role: assignedBy.role
      },
      timestamp: new Date()
    });
  }

  emitTaskUpdated(task, updatedBy) {
    this.io.emit('task:updated', {
      task,
      updatedBy: {
        id: updatedBy._id,
        name: updatedBy.name,
        role: updatedBy.role
      },
      timestamp: new Date()
    });
  }

  emitTaskStatusChanged(task, newStatus, changedBy) {
    this.io.emit('task:status_changed', {
      task,
      status: newStatus,
      changedBy: {
        id: changedBy._id,
        name: changedBy.name,
        role: changedBy.role
      },
      timestamp: new Date()
    });
  }

  emitTaskCompleted(task, completedBy) {
    this.io.emit('task:completed', {
      task,
      completedBy: {
        id: completedBy._id,
        name: completedBy.name,
        role: completedBy.role
      },
      timestamp: new Date()
    });
  }

  // Report events
  emitReportSubmitted(report, submittedBy) {
    this.io.emit('report:submitted', {
      report,
      submittedBy: {
        id: submittedBy._id,
        name: submittedBy.name,
        role: submittedBy.role
      },
      timestamp: new Date()
    });
  }

  // User events
  emitUserLogin(user) {
    this.io.emit('user:login', {
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      },
      timestamp: new Date()
    });
  }

  emitUserLogout(user) {
    this.io.emit('user:logout', {
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      },
      timestamp: new Date()
    });
  }

  // System events
  emitSystemMaintenance(message) {
    this.io.emit('system:maintenance', {
      message,
      timestamp: new Date()
    });
  }

  emitSystemAlert(message) {
    this.io.emit('system:alert', {
      message,
      timestamp: new Date()
    });
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users info
  getConnectedUsers() {
    return Array.from(this.connectedUsers.entries()).map(([userId, socketId]) => ({
      userId,
      socketId
    }));
  }
}

module.exports = SocketServer; 