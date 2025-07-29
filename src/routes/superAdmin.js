const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { authenticateToken, authorizeRoles, protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Apply authentication and super admin authorization to all routes (supporting both middleware patterns)
router.use(authenticateToken || protect);
router.use((authorizeRoles && authorizeRoles('superadmin')) || (authorize && authorize('superadmin')));

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Get counts for dashboard
    const managersCount = await User.countDocuments({ role: 'manager', status: 'Active' });
    const techniciansCount = await User.countDocuments({ role: 'technician', status: 'Active' });
    const projectsCount = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'Completed' });
    const inProgressProjects = await Project.countDocuments({ status: 'In Progress' });
    const delayedProjects = await Project.countDocuments({ status: 'Delayed' });
    const completedTasks = await Task.countDocuments({ status: 'Completed' });
    const pendingTasks = await Task.countDocuments({ status: { $in: ['Pending', 'In Progress'] } });
    const totalTasks = await Task.countDocuments();

    // Recent activities (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentProjects = await Project.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const recentTasks = await Task.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      status: 'success',
      data: {
        managersCount,
        techniciansCount,
        projectsCount,
        completedProjects,
        inProgressProjects,
        delayedProjects,
        completedTasks,
        pendingTasks,
        totalTasks,
        recentActivity: {
          recentProjects,
          recentTasks
        },
        completionRate: projectsCount > 0 ? (completedProjects / projectsCount) * 100 : 0,
        taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all projects with manager details
router.get('/projects', async (req, res) => {
  try {
    const { status, priority, managerId, page = 1, limit = 50 } = req.query;
    
    // Build filter
    let filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (managerId) filter.assignedManager = managerId;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const projects = await Project.find(filter)
      .populate('assignedManager', 'name email department')
      .populate({
        path: 'tasks',
        populate: { path: 'assignedTo', select: 'name email' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalProjects = await Project.countDocuments(filter);
    const totalPages = Math.ceil(totalProjects / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        projects,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProjects,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch projects',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single project details
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedManager', 'name email department')
      .populate('tasks');

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    res.json({
      status: 'success',
      data: project
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new project
router.post(
  '/projects',
  upload.array('files', 10), // <-- Multer parses the body first!
  [
    body('clientName').trim().isLength({ min: 2 }).withMessage('Client name is required'),
    body('siteName').trim().isLength({ min: 2 }).withMessage('Site name is required'),
    body('location').trim().isLength({ min: 5 }).withMessage('Location is required'),
    body('assignedManager').isMongoId().withMessage('Valid manager ID is required')
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

      console.log('REQ.BODY:', req.body);
      console.log('REQ.FILES:', req.files);

      const {
        clientName,
        siteName,
        location,
        mapLink,
        priority,
        deadline,
        description,
        notes,
        assignedManager,
        assignedManagerName
      } = req.body;

      // Verify manager exists and is active
      const manager = await User.findById(assignedManager);
      if (!manager || manager.role !== 'manager' || manager.status !== 'Active') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or inactive manager assignment'
        });
      }

      // Process uploaded files
      const files = req.files ? req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size
      })) : [];

      // Create project
      const project = new Project({
        clientName,
        siteName,
        location,
        mapLink,
        priority: priority || 'medium',
        deadline: deadline ? new Date(deadline) : null,
        description,
        notes,
        assignedManager,
        assignedManagerName: assignedManagerName || manager.name,
        files,
        createdBy: req.user._id
      });

      await project.save();

      // Add project to manager's assigned projects if the field exists
      if (manager.assignedProjects) {
        manager.assignedProjects.push(project._id);
        await manager.save();
      }

      // Populate manager details for response
      await project.populate('assignedManager', 'name email department');

      res.status(201).json({
        status: 'success',
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to create project',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// Update project
router.put('/projects/:id', [
  body('clientName').optional().trim().isLength({ min: 2 }),
  body('siteName').optional().trim().isLength({ min: 2 }),
  body('location').optional().trim().isLength({ min: 5 }),
  body('assignedManager').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // If updating assigned manager, verify the manager exists
    if (req.body.assignedManager) {
      const manager = await User.findById(req.body.assignedManager);
      if (!manager || manager.role !== 'manager' || manager.status !== 'Active') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or inactive manager assignment'
        });
      }
      req.body.assignedManagerName = manager.name;
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('assignedManager', 'name email department');

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }

    // Remove project from manager's assigned projects if the field exists
    await User.updateOne(
      { _id: project.assignedManager },
      { $pull: { assignedProjects: project._id } }
    );

    // Delete associated tasks
    await Task.deleteMany({ project: project._id });

    res.json({
      status: 'success',
      message: 'Project deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all managers
router.get('/managers', async (req, res) => {
  try {
    const { department, status = 'Active' } = req.query;
    
    let filter = { role: 'manager' };
    if (status) filter.status = status;
    if (department) filter.department = department;

    const managers = await User.find(filter)
      .select('name email department assignedProjects status createdAt');

    // Add project statistics for each manager
    const managersWithStats = await Promise.all(
      managers.map(async (manager) => {
        const totalProjects = await Project.countDocuments({ assignedManager: manager._id });
        const completedProjects = await Project.countDocuments({ 
          assignedManager: manager._id, 
          status: 'Completed' 
        });
        const inProgressProjects = await Project.countDocuments({ 
          assignedManager: manager._id, 
          status: 'In Progress' 
        });

        return {
          ...manager.toObject(),
          statistics: {
            totalProjects,
            completedProjects,
            inProgressProjects,
            completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0
          }
        };
      })
    );

    res.json({
      status: 'success',
      data: managersWithStats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch managers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all technicians
router.get('/technicians', async (req, res) => {
  try {
    const { department, status = 'Active' } = req.query;
    
    let filter = { role: 'technician' };
    if (status) filter.status = status;
    if (department) filter.department = department;

    const technicians = await User.find(filter)
      .select('name email department status createdAt');

    // Add task statistics for each technician
    const techniciansWithStats = await Promise.all(
      technicians.map(async (technician) => {
        const totalTasks = await Task.countDocuments({ assignedTo: technician._id });
        const completedTasks = await Task.countDocuments({ 
          assignedTo: technician._id, 
          status: 'Completed' 
        });
        const inProgressTasks = await Task.countDocuments({ 
          assignedTo: technician._id, 
          status: 'In Progress' 
        });

        return {
          ...technician.toObject(),
          statistics: {
            totalTasks,
            completedTasks,
            inProgressTasks,
            completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
          }
        };
      })
    );

    res.json({
      status: 'success',
      data: techniciansWithStats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch technicians',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all users (managers and technicians)
router.get('/users', async (req, res) => {
  try {
    const { role, department, status = 'Active' } = req.query;
    
    let filter = { role: { $in: ['manager', 'technician'] } };
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (department) filter.department = department;

    const users = await User.find(filter)
      .select('name email role department status createdAt')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: users
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Bulk project status update
router.patch('/projects/bulk-status', [
  body('projectIds').isArray().withMessage('Project IDs must be an array'),
  body('status').isIn(['Planning', 'In Progress', 'Completed', 'On Hold', 'Delayed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { projectIds, status } = req.body;

    const result = await Project.updateMany(
      { _id: { $in: projectIds } },
      { status, updatedBy: req.user._id }
    );

    res.json({
      status: 'success',
      message: `Updated ${result.modifiedCount} projects`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update projects',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;