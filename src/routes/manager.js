const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Protect all manager routes and require manager role
router.use(protect);
router.use(authorize("manager"));

// Get manager's assigned projects
router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find({
      assignedManager: req.user.id,
    }).populate("assignedManager", "name email");

    res.json({
      status: "success",
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch projects",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Get technicians under this manager
router.get("/technicians", async (req, res) => {
  try {
    const technicians = await User.find({ role: "technician" });

    res.json({
      status: "success",
      data: technicians,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch technicians",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Get manager's dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const assignedProjectsCount = await Project.countDocuments({
      assignedManager: req.user.id,
    });
    const techniciansCount = await User.countDocuments({ role: "technician" });

    // Calculate completed and pending tasks (for now, use basic project stats)
    const projects = await Project.find({ assignedManager: req.user.id });
    const completedTasks = projects.reduce(
      (sum, p) => sum + (p.completedTasks || 0),
      0,
    );
    const pendingTasks = projects.reduce(
      (sum, p) => sum + ((p.tasksCount || 0) - (p.completedTasks || 0)),
      0,
    );

    res.json({
      status: "success",
      data: {
        assignedProjectsCount,
        techniciansCount,
        completedTasks,
        pendingTasks,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch stats",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Create new task and assign to technician
router.post("/tasks", upload.array("files", 10), async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      technicianId,
      priority,
      deadline,
      estimatedHours,
      location,
      locationLink,
    } = req.body;

    // Verify the project belongs to this manager
    const project = await Project.findOne({
      _id: projectId,
      assignedManager: req.user.id,
    });

    if (!project) {
      return res.status(404).json({
        status: "error",
        message: "Project not found or access denied",
      });
    }

    // Verify the technician exists
    const technician = await User.findOne({
      _id: technicianId,
      role: "technician",
    });

    if (!technician) {
      return res.status(404).json({
        status: "error",
        message: "Technician not found",
      });
    }

    // Process uploaded files
    const files = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        files.push({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
          uploadedBy: req.user._id
        });
      });
    }

    // Process project files (copy from project to task)
    const projectFiles = req.body.projectFiles ? 
      (Array.isArray(req.body.projectFiles) ? req.body.projectFiles : [req.body.projectFiles]) : [];
    const copiedProjectFiles = [];
    for (const projectFilePath of projectFiles) {
      try {
        const projectFile = project.files.find(f => f.path === projectFilePath || f.filename === projectFilePath);
        if (projectFile) {
          copiedProjectFiles.push({
            originalName: projectFile.originalName || projectFile.filename,
            filename: projectFile.filename,
            path: projectFile.path,
            mimetype: projectFile.mimetype || 'application/octet-stream',
            size: projectFile.size || 0,
            isProjectFile: true
          });
        }
      } catch (error) {
        console.error("[ERROR] Failed to copy project file:", projectFilePath, error);
      }
    }

    // Combine uploaded files and project files
    const allFiles = [...files, ...copiedProjectFiles];

    // Create the task, always linking to the verified project
    const task = await Task.create({
      title,
      description,
      project: project._id, // always use the verified project
      assignedTo: technicianId,
      assignedBy: req.user._id,
      priority: priority || "medium",
      deadline,
      estimatedHours: estimatedHours || 0,
      location: location || project.location,
      locationLink: locationLink,
      files: allFiles,
    });

    // Ensure the task is linked to the project
    await Project.findByIdAndUpdate(
      project._id,
      { $addToSet: { tasks: task._id } }
    );

    // Populate the created task with references
    const populatedTask = await Task.findById(task._id)
      .populate("project", "siteName clientName location mapLink files")
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email");

    res.status(201).json({
      status: "success",
      message: "Task created and assigned successfully",
      data: populatedTask,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to create task",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Get tasks for all projects assigned to this manager
router.get("/tasks", async (req, res) => {
  try {
    console.log("[DEBUG] Manager ID:", req.user.id);
    // Find all projects assigned to this manager
    const projects = await Project.find({ assignedManager: req.user.id }, '_id');
    const projectIds = projects.map(p => p._id);
    console.log("[DEBUG] Project IDs:", projectIds);
    // Find all tasks for these projects
    const query = { project: { $in: projectIds } };
    const allTasks = await Task.find();
    console.log("[DEBUG] All Task IDs:", allTasks.map(t => t._id), "with project field:", allTasks.map(t => t.project));
    const tasks = await Task.find(query)
      .populate("project", "siteName clientName location mapLink files")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });
    console.log("[DEBUG] /api/manager/tasks query:", query, "Found tasks:", tasks.length, tasks.map(t => t._id));
    res.json({
      status: "success",
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch tasks",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

module.exports = router;
