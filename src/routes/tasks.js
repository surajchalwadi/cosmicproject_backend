const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

const router = express.Router();

// Create and assign a new task (Manager only)
router.post('/',
  protect,
  authorize('manager'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('project').notEmpty().withMessage('Project ID is required'),
    body('assignedTo').notEmpty().withMessage('Technician ID is required'),
    body('description').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, description, project, assignedTo, priority = 'medium', deadline } = req.body;

      // Check project exists and belongs to manager
      const foundProject = await Project.findById(project);
      if (!foundProject) {
        return res.status(404).json({ status: 'error', message: 'Project not found' });
      }
      if (foundProject.assignedManager.toString() !== req.user.id) {
        return res.status(403).json({ status: 'error', message: 'Not authorized for this project' });
      }

      // Check technician exists
      const technician = await User.findById(assignedTo);
      if (!technician || technician.role !== 'technician') {
        return res.status(404).json({ status: 'error', message: 'Technician not found' });
      }

      // Create task
      const newTask = new Task({
        title,
        description,
        project: foundProject._id,
        assignedTo: technician._id,
        assignedBy: req.user.id,
        priority,
        deadline
      });
      await newTask.save();

      // Add task to project's tasks array
      foundProject.tasks.push(newTask._id);
      await foundProject.save();

      // Emit real-time event to technician
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.to(`user_${technician._id}`).emit('task_assigned', {
          task: newTask
        });
      } catch (e) {
        console.error('Socket.IO emit error:', e.message);
      }

      res.status(201).json({
        status: 'success',
        data: newTask,
        message: 'Task created and assigned successfully'
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create task',
        error: error.message
      });
    }
  }
);

module.exports = router; 