const mongoose = require('mongoose');

const loginSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true, // This creates the index automatically
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  loginTime: {
    type: Date,
    default: Date.now,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  logoutTime: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // 24 hours in seconds - this creates the TTL index automatically
  },
}, {
  timestamps: true,
});

// Index for faster queries
loginSessionSchema.index({ userId: 1, isActive: 1 });
// loginSessionSchema.index({ token: 1 }); // REMOVED - already created by unique: true
// loginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // REMOVED - already created by expires: 86400

// Method to deactivate session
loginSessionSchema.methods.deactivate = function() {
  this.isActive = false;
  this.logoutTime = Date.now();
  return this.save();
};

// Method to update last activity
loginSessionSchema.methods.updateActivity = function() {
  this.lastActivity = Date.now();
  return this.save();
};

// Static method to cleanup expired sessions
loginSessionSchema.statics.cleanupExpiredSessions = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: Date.now() } },
      { isActive: false, logoutTime: { $lt: Date.now() - 7 * 24 * 60 * 60 * 1000 } } // 7 days old inactive sessions
    ]
  });
};



module.exports = mongoose.model('LoginSession', loginSessionSchema);