const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // This creates the index automatically
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['superadmin', 'manager', 'technician'],
    required: [true, 'Role is required']
  },
  department: {
    type: String,
    default: 'General'
  },
  phone: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    trim: true
  },
  // Status fields - supporting both approaches
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // Security fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  // Project management
  assignedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  // Legacy timestamp fields (kept for backward compatibility)
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // This adds createdAt and updatedAt automatically
});

// Indexes for performance
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ department: 1 });

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for unified status checking
userSchema.virtual('effectiveStatus').get(function() {
  if (!this.isActive) return 'Inactive';
  return this.status || 'Active';
});

// Pre-save middleware to hash password and sync status fields
userSchema.pre('save', async function(next) {
  // Sync status fields
  if (this.isModified('status')) {
    this.isActive = this.status === 'Active';
  } else if (this.isModified('isActive')) {
    this.status = this.isActive ? 'Active' : 'Inactive';
  }
  
  // Update legacy updatedAt field
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  
  // Only hash password if it's modified or new AND not already hashed
  if (!this.isModified('password')) return next();

  try {
    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
      // Password is already hashed, don't hash again
      return next();
    }
    
    // Hash password with salt rounds of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to check if user is effectively active
userSchema.methods.isEffectivelyActive = function() {
  return this.isActive && this.status === 'Active' && !this.isLocked;
};

// Method to activate user
userSchema.methods.activate = function() {
  this.isActive = true;
  this.status = 'Active';
  return this.save();
};

// Method to deactivate user
userSchema.methods.deactivate = function() {
  this.isActive = false;
  this.status = 'Inactive';
  return this.save();
};

// Method to suspend user
userSchema.methods.suspend = function() {
  this.isActive = false;
  this.status = 'Suspended';
  return this.save();
};

// Method to assign project
userSchema.methods.assignProject = function(projectId) {
  if (!this.assignedProjects.includes(projectId)) {
    this.assignedProjects.push(projectId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unassign project
userSchema.methods.unassignProject = function(projectId) {
  this.assignedProjects = this.assignedProjects.filter(
    id => id.toString() !== projectId.toString()
  );
  return this.save();
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ 
    $and: [
      { isActive: true },
      { status: 'Active' }
    ]
  });
};

// Static method to find by role
userSchema.statics.findByRole = function(role) {
  return this.find({ role });
};

// Static method to find by department
userSchema.statics.findByDepartment = function(department) {
  return this.find({ department });
};

// Transform output (remove sensitive fields)
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.loginAttempts;
  delete user.lockUntil;
  return user;
};

// Method to get safe user data for API responses
userSchema.methods.toSafeObject = function() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    phone: this.phone,
    status: this.status,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    assignedProjects: this.assignedProjects,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', userSchema);