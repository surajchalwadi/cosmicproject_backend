const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Try to import models (production), fallback to mock data (development)
let Project, Task, User;
let useMockData = false;

try {
  Project = require('../models/Project');
  Task = require('../models/Task');
  User = require('../models/User');
} catch (error) {
  console.log('Models not found, using mock data for development');
  useMockData = true;
}

// Mock data for development
let mockProjects = [
  {
    id: 1,
    _id: '1',
    title: 'Cosmic Web Platform',
    siteName: 'Cosmic Web Platform',
    description: 'A comprehensive web platform for managing cosmic solutions',
    status: 'In Progress',
    priority: 'high',
    clientName: 'Cosmic Solutions Ltd',
    location: 'Mumbai, Maharashtra',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    userId: 1,
    assignedManager: {
      _id: '1',
      name: 'John Manager',
      email: 'john@cosmic.com',
      department: 'Development'
    },
    tasks: [],
    completionPercentage: 75
  },
  {
    id: 2,
    _id: '2',
    title: 'Mobile App Development',
    siteName: 'Mobile App Development',
    description: 'Cross-platform mobile application for cosmic services',
    status: 'Planning',
    priority: 'medium',
    clientName: 'Tech Innovations Inc',
    location: 'Pune, Maharashtra',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
    userId: 1,
    assignedManager: {
      _id: '1',
      name: 'John Manager',
      email: 'john@cosmic.com',
      department: 'Development'
    },
    tasks: [],
    completionPercentage: 30
  }
];

// Mock user for development
const mockUser = { 
  _id: '1',
  id: 1, 
  email: 'dev@cosmic.com', 
  name: 'Dev User',
  role: 'admin'
};

// Authentication middleware (with development fallback)
router.use((req, res, next) => {
  if (useMockData) {
    // Add mock user for development
    req.user = mockUser;
    next();
  } else {
    // Use actual authentication in production
    authenticateToken(req, res, next);
  }
});

// Get projects based on user role with pagination and filtering
router.get('/', [
  query('page').optional().toInt().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().toInt().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['Planning', 'In Progress', 'Completed', 'Delayed', 'On Hold']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('search').optional().isString()
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (useMockData) {
      // Mock data implementation
      let filteredProjects = mockProjects.filter(project => project.userId === req.user.id);

      // Apply filters
      if (req.query.status) {
        filteredProjects = filteredProjects.filter(p => p.status === req.query.status);
      }
      if (req.query.priority) {
        filteredProjects = filteredProjects.filter(p => p.priority === req.query.priority);
      }
      if (req.query.search) {
        const searchTerm = req.query.search.toLowerCase();
        filteredProjects = filteredProjects.filter(p => 
          p.siteName?.toLowerCase().includes(searchTerm) ||
          p.clientName?.toLowerCase().includes(searchTerm) ||
          p.location?.toLowerCase().includes(searchTerm) ||
          p.title?.toLowerCase().includes(searchTerm)
        );
      }

      // Pagination
      const total = filteredProjects.length;
      const paginatedProjects = filteredProjects
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(skip, skip + limit);

      return res.json({
        status: 'success',
        success: true,
        data: {
          projects: paginatedProjects,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        },
        message: 'Projects retrieved successfully'
      });
    }

    // Production implementation with MongoDB
    let filter = {};
    
    // Managers can only see their assigned projects
    if (req.user.role === 'manager') {
      filter.assignedManager = req.user._id;
    }

    // Apply additional filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.search) {
      filter.$or = [
        { siteName: { $regex: req.query.search, $options: 'i' } },
        { clientName: { $regex: req.query.search, $options: 'i' } },
        { location: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(filter)
      .populate('assignedManager', 'name email department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Project.countDocuments(filter);

    res.json({
      status: 'success',
      success: true,
      data: {
        projects,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    if (useMockData) {
      const projectId = parseInt(req.params.id);
      const project = mockProjects.find(p => 
        (p.id === projectId || p._id === req.params.id) && p.userId === req.user.id
      );
      
      if (!project) {
        return res.status(404).json({
          status: 'error',
          success: false,
          message: 'Project not found'
        });
      }
      
      return res.json({
        status: 'success',
        success: true,
        data: project,
        message: 'Project retrieved successfully'
      });
    }

    // Production implementation
    const project = await Project.findById(req.params.id)
      .populate('assignedManager', 'name email department phone')
      .populate({
        path: 'tasks',
        populate: {
          path: 'assignedTo',
          select: 'name email'
        }
      });

    if (!project) {
      return res.status(404).json({
        status: 'error',
        success: false,
        message: 'Project not found'
      });
    }

    // Check permissions for managers
    if (req.user.role === 'manager' && project.assignedManager._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      status: 'success',
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to fetch project',
      error: error.message
    });
  }
});

// Create a new project
router.post('/', [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('status').optional().isIn(['Planning', 'In Progress', 'Completed', 'Delayed', 'On Hold'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, description, status = 'Planning', priority = 'medium', clientName, location, siteName } = req.body;

    if (useMockData) {
      const newProject = {
        id: mockProjects.length + 1,
        _id: (mockProjects.length + 1).toString(),
        title,
        siteName: siteName || title,
        description,
        status,
        priority,
        clientName: clientName || 'Unknown Client',
        location: location || 'Unknown Location',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: req.user.id,
        assignedManager: req.user,
        tasks: [],
        completionPercentage: 0
      };
      
      mockProjects.push(newProject);
      
      return res.status(201).json({
        status: 'success',
        success: true,
        data: newProject,
        message: 'Project created successfully'
      });
    }

    // Production implementation
    const newProject = new Project({
      title,
      siteName: siteName || title,
      description,
      status,
      priority,
      clientName,
      location,
      assignedManager: req.user._id
    });

    await newProject.save();
    await newProject.populate('assignedManager', 'name email department');

    // Add project to manager's assignedProjects if not already present
    const manager = await User.findById(req.user._id);
    if (manager && !manager.assignedProjects.includes(newProject._id)) {
      manager.assignedProjects.push(newProject._id);
      await manager.save();
    }

    // Emit real-time event to superadmin room
    try {
      if (global.socketServer) {
        global.socketServer.sendNotificationToRole('super-admin', {
          title: 'New Project Created',
          message: `A new project has been created: ${newProject.siteName}`,
          type: 'info',
          priority: 'medium',
          category: 'task'
        });
      }
    } catch (e) {
      console.error('Socket.IO emit error:', e.message);
    }

    res.status(201).json({
      status: 'success',
      success: true,
      data: newProject,
      message: 'Project created successfully'
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to create project',
      error: error.message
    });
  }
});

// Update a project
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('status').optional().isIn(['Planning', 'In Progress', 'Completed', 'Delayed', 'On Hold'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (useMockData) {
      const projectId = parseInt(req.params.id);
      const projectIndex = mockProjects.findIndex(p => 
        (p.id === projectId || p._id === req.params.id) && p.userId === req.user.id
      );
      
      if (projectIndex === -1) {
        return res.status(404).json({
          status: 'error',
          success: false,
          message: 'Project not found'
        });
      }
      
      const updatedProject = {
        ...mockProjects[projectIndex],
        ...req.body,
        updatedAt: new Date()
      };
      
      mockProjects[projectIndex] = updatedProject;
      
      return res.json({
        status: 'success',
        success: true,
        data: updatedProject,
        message: 'Project updated successfully'
      });
    }

    // Production implementation
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        status: 'error',
        success: false,
        message: 'Project not found'
      });
    }

    // Check permissions
    if (req.user.role === 'manager' && project.assignedManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        success: false,
        message: 'Access denied'
      });
    }

    Object.assign(project, req.body);
    await project.save();
    await project.populate('assignedManager', 'name email department');

    res.json({
      status: 'success',
      success: true,
      data: project,
      message: 'Project updated successfully'
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to update project',
      error: error.message
    });
  }
});

// Update project status (separate endpoint for status updates)
router.patch('/:id/status', [
  body('status').isIn(['Planning', 'In Progress', 'Completed', 'Delayed', 'On Hold']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status } = req.body;

    if (useMockData) {
      const projectId = parseInt(req.params.id);
      const project = mockProjects.find(p => 
        (p.id === projectId || p._id === req.params.id) && p.userId === req.user.id
      );
      
      if (!project) {
        return res.status(404).json({
          status: 'error',
          success: false,
          message: 'Project not found'
        });
      }
      
      project.status = status;
      project.updatedAt = new Date();
      
      if (status === 'Completed' && !project.endDate) {
        project.endDate = new Date();
        project.completionPercentage = 100;
      }
      
      return res.json({
        status: 'success',
        success: true,
        message: 'Project status updated successfully',
        data: project
      });
    }

    // Production implementation
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        status: 'error',
        success: false,
        message: 'Project not found'
      });
    }

    // Check permissions
    if (
      req.user.role === 'manager' &&
      project.assignedManager.toString() !== (req.user._id?.toString() || req.user.id?.toString())
    ) {
      return res.status(403).json({
        status: 'error',
        success: false,
        message: 'Access denied'
      });
    }

    project.status = status;

    // Set end date if completed
    if (status === 'Completed' && !project.endDate) {
      project.endDate = new Date();
      project.completionPercentage = 100;
      // Also mark all tasks as Completed
      const Task = require('../models/Task');
      await Task.updateMany(
        { project: project._id, status: { $ne: 'Completed' } },
        { status: 'Completed' }
      );
    }

    await project.save();

    // Emit real-time event to superadmin room for project status update
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to('superadmin').emit('project_status_updated', {
        projectId: project._id,
        status: project.status,
        project: project
      });
    } catch (e) {
      console.error('Socket.IO emit error:', e.message);
    }

    res.json({
      status: 'success',
      success: true,
      message: 'Project status updated successfully',
      data: project
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to update project status',
      error: error.message
    });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  try {
    if (useMockData) {
      const projectId = parseInt(req.params.id);
      const projectIndex = mockProjects.findIndex(p => 
        (p.id === projectId || p._id === req.params.id) && p.userId === req.user.id
      );
      
      if (projectIndex === -1) {
        return res.status(404).json({
          status: 'error',
          success: false,
          message: 'Project not found'
        });
      }
      
      const deletedProject = mockProjects.splice(projectIndex, 1)[0];
      
      return res.json({
        status: 'success',
        success: true,
        data: deletedProject,
        message: 'Project deleted successfully'
      });
    }

    // Production implementation
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        status: 'error',
        success: false,
        message: 'Project not found'
      });
    }

    // Check permissions
    if (req.user.role === 'manager' && project.assignedManager.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        success: false,
        message: 'Access denied'
      });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.json({
      status: 'success',
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  }
});

// Get projects by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    if (useMockData) {
      const filteredProjects = mockProjects.filter(p => 
        p.status === status && p.userId === req.user.id
      );
      
      return res.json({
        status: 'success',
        success: true,
        data: filteredProjects,
        message: `Projects with status '${status}' retrieved successfully`
      });
    }

    // Production implementation
    let filter = { status };
    
    if (req.user.role === 'manager') {
      filter.assignedManager = req.user._id;
    }

    const projects = await Project.find(filter)
      .populate('assignedManager', 'name email department')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      success: true,
      data: projects,
      message: `Projects with status '${status}' retrieved successfully`
    });
  } catch (error) {
    console.error('Error fetching projects by status:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;