const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../uploads/profiles");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and user ID
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user._id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

// Get user profile
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    res.json({
      status: "success",
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
});

// Upload profile picture
router.post("/picture", protect, upload.single("profilePicture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No file uploaded"
      });
    }

    // Delete old profile picture if exists
    const user = await User.findById(req.user._id);
    if (user.profilePicture) {
      const oldPicturePath = path.join(__dirname, "../../", user.profilePicture);
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
      }
    }

    // Update user with new profile picture path
    const profilePicturePath = `uploads/profiles/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, {
      profilePicture: profilePicturePath
    });

    res.json({
      status: "success",
      message: "Profile picture uploaded successfully",
      data: {
        profilePicture: profilePicturePath
      }
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to upload profile picture",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
});

// Remove profile picture
router.delete("/picture", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user.profilePicture) {
      // Delete file from filesystem
      const picturePath = path.join(__dirname, "../../", user.profilePicture);
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
      }

      // Remove from database
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { profilePicture: 1 }
      });
    }

    res.json({
      status: "success",
      message: "Profile picture removed successfully"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to remove profile picture",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
});

// Update profile information
router.put("/", protect, async (req, res) => {
  try {
    const { name, phone, department } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (department) updateData.department = department;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      status: "success",
      message: "Profile updated successfully",
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
});

// Test endpoint to create a test profile picture
router.get("/test-image", (req, res) => {
  try {
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    // Ensure uploads/profiles directory exists
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create test file
    const testFileName = 'test-profile.png';
    const testFilePath = path.join(uploadsDir, testFileName);
    fs.writeFileSync(testFilePath, testImageBuffer);
    
    console.log('✅ Test image created at:', testFilePath.replace(__dirname, '...'));
    
    res.json({
      status: 'success',
      message: 'Test image created successfully',
      testUrl: `/api/profile/picture/${testFileName}`,
      fullUrl: `https://cosmicproject-backend-1.onrender.com/api/profile/picture/${testFileName}`
    });
    
  } catch (error) {
    console.error('❌ Test image creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create test image',
      error: error.message
    });
  }
});

// Test endpoint to verify route is working
router.get("/test", (req, res) => {
  res.json({
    status: 'success',
    message: 'Profile routes are working',
    timestamp: new Date().toISOString()
  });
});

// Serve profile picture - handle full path or just filename
router.get("/picture/*", (req, res) => {
  try {
    // Get the full path from the wildcard parameter
    const fullPath = req.params[0]; // This captures everything after /picture/
    
    console.log('🔍 Profile picture request:', {
      fullPath: fullPath
    });
    
    let filename = fullPath;
    
    // Clean the filename - remove uploads/ prefix if present
    if (filename.startsWith('uploads/')) {
      filename = filename.replace('uploads/', '');
      console.log('🧹 Cleaned uploads/ prefix, new filename:', filename);
    }
    if (filename.startsWith('profiles/')) {
      filename = filename.replace('profiles/', '');
      console.log('🧹 Cleaned profiles/ prefix, new filename:', filename);
    }
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      console.log('❌ Invalid filename:', filename);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid filename'
      });
    }

    // Try multiple possible file paths
    const possiblePaths = [
      path.join(__dirname, '../../uploads/profiles', filename),
      path.join(__dirname, '../../uploads', filename),
      path.join(__dirname, '../../', filename)
    ];
    
    console.log('🔍 Searching for file in paths:', possiblePaths.map(p => p.replace(__dirname, '...')));
    
    let filePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        console.log('✅ File found at:', testPath.replace(__dirname, '...'));
        break;
      }
    }
    
    // Check if file exists
    if (!filePath) {
      console.log('❌ File not found in any path');
      return res.status(404).json({
        status: 'error',
        message: 'Profile picture not found',
        searchedPaths: possiblePaths.map(p => p.replace(__dirname, '...')),
        requestedPath: fullPath,
        cleanedFilename: filename
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }[ext] || 'application/octet-stream';
    
    console.log('📤 Serving file:', {
      filePath: filePath.replace(__dirname, '...'),
      contentType: contentType,
      fileSize: stats.size
    });
    
    // Set CORS headers to allow cross-origin requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('🛡️ Handling preflight request');
      return res.status(200).end();
    }
    
    // Set content type and length headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('❌ File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          message: 'Failed to serve profile picture'
        });
      }
    });
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ Profile picture serve error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to serve profile picture'
      });
    }
  }
});

module.exports = router; 