const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Secure file download route
router.get('/download/:filename', authenticateToken, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid filename'
      });
    }

    // Construct file path
    const filePath = path.join(__dirname, '../../uploads/projects', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found'
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to download file'
    });
  }
});

// Get file info route
router.get('/info/:filename', authenticateToken, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid filename'
      });
    }

    const filePath = path.join(__dirname, '../../uploads/projects', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found'
      });
    }

    const stats = fs.statSync(filePath);
    
    res.json({
      status: 'success',
      data: {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        path: `/api/files/download/${filename}`
      }
    });
    
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get file info'
    });
  }
});

module.exports = router; 