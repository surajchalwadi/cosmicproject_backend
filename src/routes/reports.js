const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticateToken, authorizeRoles, protect, authorize } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');

const router = express.Router();

// Apply authentication to all routes (supporting both middleware patterns)
router.use(authenticateToken || protect);

// Get overview report (accessible to all authenticated users)
router.get('/overview', async (req, res) => {
  try {
    // Get basic counts
    const totalProjects = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'Completed' });
    const inProgressProjects = await Project.countDocuments({ status: 'In Progress' });
    const delayedProjects = await Project.countDocuments({ status: 'Delayed' });

    // Calculate completion rate
    const completionRate = totalProjects > 0 ? completedProjects / totalProjects : 0;

    // Calculate average project duration for completed projects
    const completedProjectsWithDates = await Project.find({
      status: 'Completed',
      startDate: { $exists: true },
      endDate: { $exists: true }
    });

    let averageDuration = 0;
    if (completedProjectsWithDates.length > 0) {
      const totalDuration = completedProjectsWithDates.reduce((sum, project) => {
        const duration = Math.ceil((project.endDate - project.startDate) / (1000 * 60 * 60 * 24));
        return sum + duration;
      }, 0);
      averageDuration = Math.round(totalDuration / completedProjectsWithDates.length);
    }

    // Get user counts
    const totalManagers = await User.countDocuments({ role: 'manager', status: 'Active' });
    const totalTechnicians = await User.countDocuments({ role: 'technician', status: 'Active' });

    // Get task statistics
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'Completed' });
    const pendingTasks = await Task.countDocuments({ status: { $in: ['Pending', 'In Progress'] } });

    // Projects by priority
    const projectsByPriority = await Project.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent activities (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentProjects = await Project.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const recentTasks = await Task.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      status: 'success',
      data: {
        totalProjects,
        completedProjects,
        inProgressProjects,
        delayedProjects,
        completionRate,
        averageDuration,
        totalManagers,
        totalTechnicians,
        totalTasks,
        completedTasks,
        pendingTasks,
        projectsByPriority: projectsByPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentActivity: {
          recentProjects,
          recentTasks
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate overview report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get detailed project report (superadmin and manager access)
router.get('/projects', (authorizeRoles || authorize)('superadmin', 'manager'), async (req, res) => {
  try {
    const { startDate, endDate, managerId, status, priority } = req.query;

    // Build filter
    let filter = {};
    
    // Managers can only see their projects
    if (req.user.role === 'manager') {
      filter.assignedManager = req.user._id;
    } else if (managerId) {
      filter.assignedManager = managerId;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const projects = await Project.find(filter)
      .populate('assignedManager', 'name email department')
      .populate('tasks')
      .sort({ createdAt: -1 });

    // Calculate project statistics
    const stats = {
      totalProjects: projects.length,
      completedProjects: projects.filter(p => p.status === 'Completed').length,
      inProgressProjects: projects.filter(p => p.status === 'In Progress').length,
      delayedProjects: projects.filter(p => p.status === 'Delayed').length,
      averageCompletionPercentage: projects.reduce((sum, p) => sum + p.completionPercentage, 0) / projects.length || 0
    };

    res.json({
      status: 'success',
      data: {
        projects,
        statistics: stats,
        filters: { startDate, endDate, managerId, status, priority },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate project report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get detailed reports (alternative endpoint for backward compatibility)
router.get('/detailed', (authorizeRoles || authorize)('superadmin'), async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('assignedManager', 'name email')
      .populate('tasks')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: projects,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch detailed report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get performance report by manager (superadmin only)
router.get('/performance', (authorizeRoles || authorize)('superadmin'), async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager', status: 'Active' });
    
    const performanceData = await Promise.all(
      managers.map(async (manager) => {
        const projects = await Project.find({ assignedManager: manager._id });
        const tasks = await Task.find({ 
          project: { $in: projects.map(p => p._id) }
        });

        const completedProjects = projects.filter(p => p.status === 'Completed').length;
        const onTimeProjects = projects.filter(p => 
          p.status === 'Completed' && 
          p.deadline && 
          p.endDate && 
          p.endDate <= p.deadline
        ).length;

        const completedTasks = tasks.filter(t => t.status === 'Completed').length;
        const averageCompletionTime = projects.length > 0 
          ? projects.reduce((sum, p) => sum + p.completionPercentage, 0) / projects.length 
          : 0;

        return {
          manager: {
            id: manager._id,
            name: manager.name,
            email: manager.email,
            department: manager.department
          },
          metrics: {
            totalProjects: projects.length,
            completedProjects,
            onTimeProjects,
            totalTasks: tasks.length,
            completedTasks,
            completionRate: projects.length > 0 ? (completedProjects / projects.length) * 100 : 0,
            onTimeRate: projects.length > 0 ? (onTimeProjects / projects.length) * 100 : 0,
            averageCompletionTime: Math.round(averageCompletionTime)
          }
        };
      })
    );

    res.json({
      status: 'success',
      data: {
        performanceData,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate performance report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Technician submits a report and marks task as completed
router.post('/',
  protect,
  authorize('technician'),
  async (req, res) => {
    try {
      const { task: taskId, content } = req.body;
      if (!taskId || !content) {
        return res.status(400).json({ status: 'error', message: 'Task ID and report content are required' });
      }

      // Find the task and ensure it's assigned to this technician
      const task = await Task.findById(taskId).populate('project');
      if (!task) {
        return res.status(404).json({ status: 'error', message: 'Task not found' });
      }
      if (task.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ status: 'error', message: 'Not authorized for this task' });
      }
      if (task.status === 'Completed' || task.status === 'completed') {
        return res.status(400).json({ status: 'error', message: 'Task already completed' });
      }

      // Mark task as completed
      task.status = 'Completed';
      task.completedAt = new Date();
      await task.save();

      // Find the manager for this project
      const project = task.project;
      const managerId = project.assignedManager;

      // Create the report
      const Report = require('../models/Report');
      const newReport = await Report.create({
        task: task._id,
        technician: req.user.id,
        manager: managerId,
        content
      });

      // Emit real-time event to manager and superadmin
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.to(`user_${managerId}`).emit('report_submitted', { report: newReport });
        io.to('superadmin').emit('report_submitted', { report: newReport });
      } catch (e) {
        console.error('Socket.IO emit error:', e.message);
      }

      res.status(201).json({
        status: 'success',
        data: newReport,
        message: 'Report submitted and task marked as completed'
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to submit report',
        error: error.message
      });
    }
  }
);

// Handle CORS preflight for PDF generation
router.options('/generate', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.sendStatus(200);
});

// Test PDF generation endpoint (without auth for testing)
router.post('/test-pdf', async (req, res) => {
  try {
    console.log('Test PDF generation request received');
    
    // Create a simple test PDF
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=test_report.pdf',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.send(pdfData);
    });
    
    doc.fontSize(20).text('Test PDF Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('This is a test PDF generation');
    doc.text(`Generated At: ${new Date().toLocaleString()}`);
    doc.end();
    
    console.log('Test PDF generation completed successfully');
  } catch (error) {
    console.error('Test PDF generation error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate test PDF', error: error.message });
  }
});

// Add PDF summary report generation endpoint
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    console.log('PDF generation request received:', req.body);
    console.log('User:', req.user);
    
    // Fetch summary stats (reuse logic from /overview)
    const totalProjects = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'Completed' });
    const inProgressProjects = await Project.countDocuments({ status: 'In Progress' });
    const delayedProjects = await Project.countDocuments({ status: 'Delayed' });
    const completionRate = totalProjects > 0 ? completedProjects / totalProjects : 0;
    const completedProjectsWithDates = await Project.find({
      status: 'Completed',
      startDate: { $exists: true },
      endDate: { $exists: true }
    });
    let averageDuration = 0;
    if (completedProjectsWithDates.length > 0) {
      const totalDuration = completedProjectsWithDates.reduce((sum, project) => {
        const duration = Math.ceil((project.endDate - project.startDate) / (1000 * 60 * 60 * 24));
        return sum + duration;
      }, 0);
      averageDuration = Math.round(totalDuration / completedProjectsWithDates.length);
    }
    // Calculate completed projects this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedThisMonth = await Project.find({
      status: 'Completed',
      endDate: { $gte: startOfMonth, $lte: now }
    });
    // Calculate pending projects
    const pendingProjects = await Project.find({ status: { $ne: 'Completed' } });
    // Create PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=project_summary_report.pdf',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.send(pdfData);
    });

    // Add logo and title centered at the top
    let y = 40;
    try {
      const logoPath = path.join(__dirname, '../../public/logo-cosmic.png');
      doc.image(logoPath, doc.page.width / 2 - 40, y, { width: 80, align: 'center' });
      y += 60;
    } catch (e) {
      console.error('Logo image failed to load:', e);
      y += 20;
    }
    doc.font('Helvetica-Bold').fontSize(26).text('Project Summary Report', 0, y, { align: 'center' });
    y += 32;
    doc.moveTo(60, y).lineTo(doc.page.width - 60, y).stroke('#1e293b');
    y += 16;
    // Summary stats in a light gray box
    doc.roundedRect(60, y, doc.page.width - 120, 110, 8).fillAndStroke('#f3f4f6', '#e5e7eb');
    doc.fillColor('black').font('Helvetica').fontSize(13);
    doc.text(`Total Projects: ${totalProjects}`, 80, y + 12);
    doc.text(`Completed Projects: ${completedProjects}`, 80, y + 32);
    doc.text(`In Progress Projects: ${inProgressProjects}`, 80, y + 52);
    doc.text(`Delayed Projects: ${delayedProjects}`, 80, y + 72);
    doc.text(`Completion Rate: ${(completionRate * 100).toFixed(2)}%`, 300, y + 12);
    doc.text(`Average Duration (Completed): ${averageDuration} days`, 300, y + 32);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 300, y + 52);
    y += 130;
    // Divider
    doc.moveTo(60, y).lineTo(doc.page.width - 60, y).stroke('#e5e7eb');
    y += 20;
    // Projects Completed This Month
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e293b').text('Projects Completed This Month', 60, y);
    y += 24;
    doc.font('Helvetica').fontSize(12).fillColor('black').text(`Count: ${completedThisMonth.length}`, 60, y);
    y += 18;
    if (completedThisMonth.length > 0) {
      doc.list(completedThisMonth.map(p => p.siteName || p.projectName || p.name || 'Untitled Project'), 80, y, { bulletRadius: 2, textIndent: 20 });
      y += completedThisMonth.length * 18 + 8;
    } else {
      doc.text('None', 80, y);
      y += 18;
    }
    y += 10;
    // Divider
    doc.moveTo(60, y).lineTo(doc.page.width - 60, y).stroke('#e5e7eb');
    y += 20;
    // Pending Projects
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e293b').text('Pending Projects', 60, y);
    y += 24;
    doc.font('Helvetica').fontSize(12).fillColor('black').text(`Count: ${pendingProjects.length}`, 60, y);
    y += 18;
    if (pendingProjects.length > 0) {
      doc.list(pendingProjects.map(p => p.siteName || p.projectName || p.name || 'Untitled Project'), 80, y, { bulletRadius: 2, textIndent: 20 });
      y += pendingProjects.length * 18 + 8;
    } else {
      doc.text('None', 80, y);
      y += 18;
    }
    y += 30;
    // Footer
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#64748b').text(`Generated by Cosmic Solutions | ${new Date().toLocaleString()}`, 0, doc.page.height - 50, { align: 'center' });
    doc.end();
    console.log('PDF generation completed successfully');
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF', error: error.message });
  }
});

// Generate and download a PDF of all tasks (for superadmin)
router.post('/task-pdf', authorizeRoles('superadmin', 'manager'), async (req, res) => {
  try {
    let { tasks } = req.body;
    console.log('TASKS RECEIVED:', tasks);
    const Task = require('../models/Task');
    // If tasks are just IDs, fetch full details
    if (tasks && tasks.length > 0 && (typeof tasks[0] === 'string' || (tasks[0] && tasks[0]._id && Object.keys(tasks[0]).length === 1))) {
      // tasks is an array of IDs or objects with only _id
      const ids = tasks.map(t => typeof t === 'string' ? t : t._id);
      tasks = await Task.find({ _id: { $in: ids } })
        .populate('assignedTo', 'name email')
        .populate('assignedBy', 'name email')
        .populate('project', 'siteName clientName');
    }
    console.log('TASKS FOR PDF:', tasks);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=task_report.pdf',
      });
      res.send(pdfData);
    });

    // Professional Header with better branding
    doc
      .rect(0, 0, doc.page.width, 80)
      .fill('#1e293b')
      .fillColor('white');
    
    // Company name
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('COSMIC SOLUTIONS', 40, 25, { align: 'left' });
    
    // Report type
    doc
      .fontSize(18)
      .font('Helvetica')
      .text('Task Report', doc.page.width - 200, 30, { align: 'right' });
    
    // Subtitle
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#94a3b8')
      .text('Site Engineer & CCTV Management System', 40, 55, { align: 'left' });
    
    // Reset colors for content
    doc.fillColor('black');

    if (tasks && tasks.length === 1) {
      // Beautiful single-task PDF with improved spacing and clickable links
      const task = tasks[0];
      
      // Task title with better spacing
      doc.moveDown(2);
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(task.title || 'Untitled Task', { align: 'left' });
      
      // Decorative line
      doc.moveDown(0.5);
      doc
        .moveTo(40, doc.y)
        .lineTo(doc.page.width - 40, doc.y)
        .stroke('#1e293b', 2);
      
      // Task details with proper spacing
      doc.moveDown(2);
      
      // Status
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text('Status:', 40, doc.y);
      doc.fontSize(12).font('Helvetica').fillColor('#6b7280').text(task.status || '-', 120, doc.y);
      doc.moveDown(1.5);
      
      // Project
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text('Project:', 40, doc.y);
      doc.fontSize(12).font('Helvetica').fillColor('#6b7280').text(task.project?.siteName || task.projectName || task.project || '-', 120, doc.y);
      doc.moveDown(1.5);
      
      // Technician
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text('Technician:', 40, doc.y);
      doc.fontSize(12).font('Helvetica').fillColor('#6b7280').text(task.assignedTo?.name || 'N/A', 120, doc.y);
      doc.moveDown(1.5);
      
      // Description
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text('Description:', 40, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').fillColor('#6b7280').text(task.description || '-', 40, doc.y);
      doc.moveDown(2);
      
      // Attachments section with clickable links
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text('Attachments:', 40, doc.y);
      doc.moveDown(0.5);
      
      if (task.files && task.files.length > 0) {
        task.files.forEach((file, index) => {
          const fileName = file.originalName || file.name || file.filename || 'Attachment';
          
          // Create proper server URL for file download
          const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
          const fileUrl = file.url || file.path || `${baseUrl}/api/files/download/${file.filename}`;
          
          // Create clickable link
          doc.fontSize(12).font('Helvetica').fillColor('#3b82f6');
          doc.text(`• ${fileName}`, 60, doc.y);
          
          // Add clickable link with proper server URL
          const linkWidth = doc.widthOfString(`• ${fileName}`);
          const linkX = 60;
          const linkY = doc.y - 12;
          
          doc.link(linkX, linkY, linkWidth, 15, fileUrl);
          doc.moveDown(0.5);
        });
      } else {
        doc.fontSize(12).font('Helvetica').fillColor('#9ca3af').text('  No attachments', 60, doc.y);
      }
      
      // Footer with better spacing
      doc.moveDown(3);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#e5e7eb', 1);
      doc.moveDown(1);
      doc.fontSize(10).fillColor('#64748b').text(`Generated by Cosmic Solutions | ${new Date().toLocaleString()}`, 40, doc.page.height - 60, { align: 'center' });
    } else {
      // Multiple tasks format with improved styling
      doc.moveDown(2);
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e293b').text('Multiple Tasks Report', { align: 'center' });
      doc.moveDown(1);
      
      (tasks || []).forEach((task, idx) => {
        // Task separator
        if (idx > 0) {
          doc.moveDown(1);
          doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#e5e7eb', 1);
          doc.moveDown(1);
        }
        
        // Task title
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#374151').text(`Task #${idx + 1}: ${task.title}`);
        doc.moveDown(0.5);
        
        // Task details
        doc.fontSize(12).font('Helvetica').fillColor('#6b7280');
        doc.text(`Status: ${task.status}`);
        doc.text(`Project: ${task.project?.siteName || task.projectName || task.project}`);
        doc.text(`Technician: ${task.assignedTo?.name || 'N/A'}`);
        doc.text(`Description: ${task.description || '-'}`);
        
        // Attachments with clickable links
        if (task.files && task.files.length > 0) {
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fillColor('#374151').text('Attachments:');
          task.files.forEach((file, fidx) => {
            const fileName = file.originalName || file.name || file.filename || 'Attachment';
            
            // Create proper server URL for file download
            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
            const fileUrl = file.url || file.path || `${baseUrl}/api/files/download/${file.filename}`;
            
            doc.font('Helvetica').fillColor('#3b82f6');
            doc.text(`  • ${fileName}`);
            
            // Add clickable link with proper server URL
            const linkWidth = doc.widthOfString(`  • ${fileName}`);
            const linkX = 40;
            const linkY = doc.y - 12;
            doc.link(linkX, linkY, linkWidth, 15, fileUrl);
          });
        } else {
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fillColor('#374151').text('Attachments: None');
        }
      });
      
      // Footer
      doc.moveDown(2);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#e5e7eb', 1);
      doc.moveDown(1);
      doc.fontSize(10).fillColor('#64748b').text(`Generated by Cosmic Solutions | ${new Date().toLocaleString()}`, 40, doc.page.height - 60, { align: 'center' });
    }
    doc.end();
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF', error: error.message });
  }
});

// Get all reports relevant to the current user (dashboard view)
router.get('/user', protect, async (req, res) => {
  try {
    const Report = require('../models/Report');
    let filter = {};

    if (req.user.role === 'superadmin') {
      // No filter, get all reports
    } else if (req.user.role === 'manager') {
      filter.manager = req.user.id;
    } else if (req.user.role === 'technician') {
      filter.technician = req.user.id;
    } else {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    const reports = await Report.find(filter)
      .populate({
        path: 'task',
        populate: [
          { path: 'project', select: 'siteName clientName location assignedManager' },
          { path: 'assignedTo', select: 'name email' },
        ]
      })
      .populate('technician', 'name email')
      .populate('manager', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch reports',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Generate and download a PDF version of a report
router.get('/:id/pdf', protect, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const Report = require('../models/Report');
    const report = await Report.findById(req.params.id)
      .populate({
        path: 'task',
        populate: [
          { path: 'project', select: 'siteName clientName location assignedManager' },
          { path: 'assignedTo', select: 'name email' },
        ]
      })
      .populate('technician', 'name email')
      .populate('manager', 'name email');

    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Report not found' });
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_${report._id}.pdf`);

    // Create PDF document
    const doc = new PDFDocument();
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Task Completion Report', { align: 'center' });
    doc.moveDown();

    // Report Info
    doc.fontSize(12).text(`Report ID: ${report._id}`);
    doc.text(`Submitted At: ${report.submittedAt.toLocaleString()}`);
    doc.moveDown();

    // Task Info
    doc.fontSize(14).text('Task Details', { underline: true });
    doc.fontSize(12);
    doc.text(`Task: ${report.task?.title || 'N/A'}`);
    doc.text(`Description: ${report.task?.description || 'N/A'}`);
    doc.text(`Project: ${report.task?.project?.siteName || 'N/A'}`);
    doc.text(`Client: ${report.task?.project?.clientName || 'N/A'}`);
    doc.text(`Location: ${report.task?.project?.location || 'N/A'}`);
    doc.text(`Assigned Technician: ${report.technician?.name || 'N/A'} (${report.technician?.email || ''})`);
    doc.text(`Manager: ${report.manager?.name || 'N/A'} (${report.manager?.email || ''})`);
    doc.moveDown();

    // Report Content
    doc.fontSize(14).text('Report Content', { underline: true });
    doc.fontSize(12).text(report.content || 'No content provided');

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate PDF', error: error.message });
  }
});

module.exports = router;