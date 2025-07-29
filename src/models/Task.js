const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'delayed', 'Pending', 'In Progress', 'Completed', 'Delayed'],
    default: 'assigned'
  },
  // Date fields - comprehensive coverage
  deadline: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  startedDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  // Progress tracking
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  estimatedHours: {
    type: Number,
    default: 0
  },
  actualHours: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    trim: true
  },
  locationLink: {
    type: String,
    trim: true
  },
  // Enhanced comments system
  comments: [{
    text: String,
    content: String, // Support both field names
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Enhanced files system
  files: [{
    // Enhanced file structure
    name: String,
    filename: String,
    originalName: String,
    url: String,
    path: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Status log for audit trail
  statusLog: [{
    status: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    comment: String,
    files: [{
      name: String,
      url: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: { type: Date, default: Date.now }
    }],
    delayReason: String
  }],
  // Delay reason for delayed status
  delayReason: { type: String, trim: true }
}, {
  timestamps: true
});

// Comprehensive indexing for performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ project: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ priority: 1, deadline: 1 });
taskSchema.index({ status: 1, createdAt: -1 });

// Virtual for unified due date access
taskSchema.virtual('effectiveDueDate').get(function() {
  return this.deadline || this.dueDate;
});

// Virtual for unified completion date access
taskSchema.virtual('effectiveCompletedDate').get(function() {
  return this.completedDate || this.completedAt;
});

// Pre-save middleware for date and status synchronization
taskSchema.pre('save', function(next) {
  // Sync date fields
  if (this.isModified('deadline') && !this.isModified('dueDate')) {
    this.dueDate = this.deadline;
  } else if (this.isModified('dueDate') && !this.isModified('deadline')) {
    this.deadline = this.dueDate;
  }
  
  if (this.isModified('completedDate') && !this.isModified('completedAt')) {
    this.completedAt = this.completedDate;
  } else if (this.isModified('completedAt') && !this.isModified('completedDate')) {
    this.completedDate = this.completedAt;
  }
  
  // Auto-set completion date when status changes to completed
  if (this.isModified('status') && (this.status === 'completed' || this.status === 'Completed')) {
    if (!this.completedDate && !this.completedAt) {
      this.completedDate = new Date();
      this.completedAt = new Date();
    }
    this.progress = 100;
  }
  
  // Auto-set started date when status changes to in_progress
  if (this.isModified('status') && (this.status === 'in_progress' || this.status === 'In Progress')) {
    if (!this.startedDate) {
      this.startedDate = new Date();
    }
  }
  
  // Update progress based on status
  if (this.isModified('status')) {
    switch(this.status.toLowerCase()) {
      case 'assigned':
      case 'pending':
        this.progress = 0;
        break;
      case 'in_progress':
      case 'in progress':
        if (this.progress === 0) this.progress = 25;
        break;
      case 'completed':
        this.progress = 100;
        break;
    }
  }
  
  next();
});

// Method to add comment with backward compatibility
taskSchema.methods.addComment = function(commentData, userId) {
  const comment = {
    text: commentData.text || commentData.content,
    content: commentData.content || commentData.text,
    author: userId,
    user: userId,
    createdAt: new Date(),
    timestamp: new Date()
  };
  
  this.comments.push(comment);
  return this.save();
};

// Method to update progress
taskSchema.methods.updateProgress = function(progressValue) {
  this.progress = Math.max(0, Math.min(100, progressValue));
  
  // Auto-update status based on progress
  if (this.progress === 0) {
    this.status = 'assigned';
  } else if (this.progress === 100) {
    this.status = 'completed';
    if (!this.completedDate) {
      this.completedDate = new Date();
      this.completedAt = new Date();
    }
  } else if (this.progress > 0 && (this.status === 'assigned' || this.status === 'Pending')) {
    this.status = 'in_progress';
    if (!this.startedDate) {
      this.startedDate = new Date();
    }
  }
  
  return this.save();
};

// Method to check if task is overdue
taskSchema.methods.isOverdue = function() {
  const dueDate = this.deadline || this.dueDate;
  return dueDate && new Date() > dueDate && this.status !== 'completed' && this.status !== 'Completed';
};

// Static method to find overdue tasks
taskSchema.statics.findOverdue = function() {
  const now = new Date();
  return this.find({
    $or: [
      { deadline: { $lt: now } },
      { dueDate: { $lt: now } }
    ],
    status: { $nin: ['completed', 'Completed'] }
  });
};

// Static method to find tasks by project
taskSchema.statics.findByProject = function(projectId) {
  return this.find({ project: projectId });
};

// Static method to find tasks assigned to user
taskSchema.statics.findByAssignee = function(userId) {
  return this.find({ assignedTo: userId });
};

module.exports = mongoose.model('Task', taskSchema);