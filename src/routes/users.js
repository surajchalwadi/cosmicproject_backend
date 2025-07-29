const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { authenticateToken, authorizeRoles, protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes (supporting both middleware patterns)
router.use(authenticateToken || protect);

// Create new user (Super Admin only)
router.post('/', (authorizeRoles && authorizeRoles('superadmin')) || (authorize && authorize('superadmin', 'super-admin')), [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['manager', 'technician']).withMessage('Invalid role'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number')
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

    const { name, email, password, role, department, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Create new user (password will be hashed by the User model pre-save middleware)
    const user = new User({
      name,
      email,
      password,
      role,
      department,
      phone,
      createdBy: req.user._id
    });

    await user.save();

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          phone: user.phone,
          status: user.status,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all users with filtering and pagination
router.get('/', (authorizeRoles && authorizeRoles('superadmin')) || (authorize && authorize('superadmin', 'super-admin')), async (req, res) => {
  try {
    const { role, status, department, page = 1, limit = 50, search } = req.query;
    
    // Build filter object
    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.status = status;
    if (department && department !== 'all') filter.department = department;

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user statistics (Super Admin only)
router.get('/stats', (authorizeRoles && authorizeRoles('superadmin')) || (authorize && authorize('superadmin', 'super-admin')), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'Active' });
    const inactiveUsers = await User.countDocuments({ status: 'Inactive' });
    const managers = await User.countDocuments({ role: 'manager', status: 'Active' });
    const technicians = await User.countDocuments({ role: 'technician', status: 'Active' });

    // Department statistics
    const departmentStats = await User.aggregate([
      { $match: { status: 'Active' } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Recent user registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      status: 'success',
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        managers,
        technicians,
        departmentStats: departmentStats.reduce((acc, item) => {
          acc[item._id || 'Unassigned'] = item.count;
          return acc;
        }, {}),
        recentRegistrations,
        userActivityRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get users by role (Managers and Super Admins)
router.get('/role/:role', (authorizeRoles && authorizeRoles('superadmin', 'manager')) || (authorize && authorize('superadmin', 'super-admin', 'manager')), async (req, res) => {
  try {
    const { role } = req.params;
    const { status = 'Active', department } = req.query;

    if (!['manager', 'technician'].includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid role specified'
      });
    }

    const filter = { role, status };
    if (department) filter.department = department;

    const users = await User.find(filter)
      .select('name email department status createdAt')
      .sort({ name: 1 });

    res.json({
      status: 'success',
      data: users
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users by role',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user by ID with detailed information
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check permissions - users can see their own profile, superadmin can see all
    if (req.user.role !== 'superadmin' && req.user.role !== 'super-admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Add user statistics if requesting own profile or if superadmin
    let userStats = {};
    if (user.role === 'manager') {
      const totalProjects = await Project.countDocuments({ assignedManager: user._id });
      const completedProjects = await Project.countDocuments({ 
        assignedManager: user._id, 
        status: 'Completed' 
      });
      userStats = {
        totalProjects,
        completedProjects,
        completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0
      };
    } else if (user.role === 'technician') {
      const totalTasks = await Task.countDocuments({ assignedTo: user._id });
      const completedTasks = await Task.countDocuments({ 
        assignedTo: user._id, 
        status: 'Completed' 
      });
      userStats = {
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      };
    }

    res.json({
      status: 'success',
      data: {
        ...user.toObject(),
        statistics: userStats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update user
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('role').optional().isIn(['manager', 'technician']).withMessage('Invalid role'),
  body('status').optional().isIn(['Active', 'Inactive']).withMessage('Invalid status')
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

    // Check permissions
    const isSuperAdmin = req.user.role === 'superadmin' || req.user.role === 'super-admin';
    const isOwnProfile = req.user._id.toString() === req.params.id;

    if (!isSuperAdmin && !isOwnProfile) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const { password, role, status, ...updateData } = req.body;

    // Only superadmin can change roles and status
    if ((role || status) && !isSuperAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Only super admin can change user roles and status'
      });
    }

    // Add role and status to update data if provided and user is superadmin
    if (role && isSuperAdmin) updateData.role = role;
    if (status && isSuperAdmin) updateData.status = status;

    // Handle password update
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters'
        });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Check if email is being updated and ensure it's unique
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email, 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already exists'
        });
      }
    }

    updateData.updatedBy = req.user._id;
    updateData.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete user (Super Admin only)
router.delete('/:id', (authorizeRoles && authorizeRoles('superadmin')) || (authorize && authorize('superadmin', 'super-admin')), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if user has active projects or tasks before deletion
    let canDelete = true;
    let activeItems = [];

    if (user.role === 'manager') {
      const activeProjects = await Project.countDocuments({ 
        assignedManager: user._id, 
        status: { $in: ['In Progress', 'Planning'] }
      });
      if (activeProjects > 0) {
        canDelete = false;
        activeItems.push(`${activeProjects} active project(s)`);
      }
    } else if (user.role === 'technician') {
      const activeTasks = await Task.countDocuments({ 
        assignedTo: user._id, 
        status: { $in: ['In Progress', 'Pending'] }
      });
      if (activeTasks > 0) {
        canDelete = false;
        activeItems.push(`${activeTasks} active task(s)`);
      }
    }

    if (!canDelete) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete user. They have ${activeItems.join(' and ')}. Please reassign or complete them first.`
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Bulk user operations (Super Admin only)
router.patch('/bulk', (authorizeRoles && authorizeRoles('superadmin')) || (authorize && authorize('superadmin', 'super-admin')), [
  body('userIds').isArray().withMessage('User IDs must be an array'),
  body('action').isIn(['activate', 'deactivate', 'delete']).withMessage('Invalid action'),
  body('status').optional().isIn(['Active', 'Inactive']).withMessage('Invalid status')
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

    const { userIds, action, status } = req.body;

    let result;
    switch (action) {
      case 'activate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { status: 'Active', updatedBy: req.user._id }
        );
        break;
      case 'deactivate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { status: 'Inactive', updatedBy: req.user._id }
        );
        break;
      case 'delete':
        result = await User.deleteMany({ _id: { $in: userIds } });
        break;
      default:
        return res.status(400).json({
          status: 'error',
          message: 'Invalid action'
        });
    }

    res.json({
      status: 'success',
      message: `Successfully ${action}d ${result.modifiedCount || result.deletedCount} user(s)`,
      data: {
        affectedCount: result.modifiedCount || result.deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform bulk operation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;