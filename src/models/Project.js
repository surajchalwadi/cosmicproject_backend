const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  clientName: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true
  },
  siteName: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  mapLink: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['Planning', 'In Progress', 'Completed', 'Delayed', 'On Hold'],
    default: 'Planning'
  },
  deadline: {
    type: Date
  },
  description: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Manager assignment is required']
  },
  assignedManagerName: {
    type: String,
    required: true
  },
  files: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  // Legacy fields for backward compatibility
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  tasksCount: {
    type: Number,
    default: 0
  },
  completedTasks: {
    type: Number,
    default: 0
  },
  // Enhanced completion tracking
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  }
}, {
  timestamps: true // This adds createdAt and updatedAt automatically
});

// Index for search functionality
projectSchema.index({ siteName: 'text', clientName: 'text', location: 'text' });

// Additional indexes for performance
projectSchema.index({ assignedManager: 1, status: 1 });
projectSchema.index({ priority: 1, deadline: 1 });
projectSchema.index({ status: 1, createdAt: -1 });

// Virtual for compatibility between progress and completionPercentage
projectSchema.virtual('currentProgress').get(function() {
  return this.completionPercentage || this.progress || 0;
});

// Pre-save middleware to sync progress fields
projectSchema.pre('save', function(next) {
  // Sync progress and completionPercentage fields
  if (this.isModified('progress') && !this.isModified('completionPercentage')) {
    this.completionPercentage = this.progress;
  } else if (this.isModified('completionPercentage') && !this.isModified('progress')) {
    this.progress = this.completionPercentage;
  }
  
  // Auto-update tasksCount if tasks array is modified
  if (this.isModified('tasks')) {
    this.tasksCount = this.tasks.length;
  }
  
  next();
});

// Method to calculate completion based on tasks
projectSchema.methods.calculateCompletion = async function() {
  if (this.tasks && this.tasks.length > 0) {
    await this.populate('tasks');
    const completedTasksCount = this.tasks.filter(task => task.status === 'Completed').length;
    this.completedTasks = completedTasksCount;
    this.tasksCount = this.tasks.length;
    this.completionPercentage = this.tasksCount > 0 ? Math.round((completedTasksCount / this.tasksCount) * 100) : 0;
    this.progress = this.completionPercentage; // Keep legacy field in sync
  }
  return this.completionPercentage;
};

// Method to update status based on completion
projectSchema.methods.updateStatusByCompletion = function() {
  if (this.completionPercentage === 100) {
    this.status = 'Completed';
    this.endDate = new Date();
  } else if (this.completionPercentage > 0 && this.status === 'Planning') {
    this.status = 'In Progress';
  }
};

// Static method to find projects by manager
projectSchema.statics.findByManager = function(managerId) {
  return this.find({ assignedManager: managerId });
};

// Static method to find overdue projects
projectSchema.statics.findOverdue = function() {
  return this.find({
    deadline: { $lt: new Date() },
    status: { $nin: ['Completed'] }
  });
};

module.exports = mongoose.model('Project', projectSchema);