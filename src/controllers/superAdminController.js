const Project = require("../models/Project");
const User = require("../models/User");

exports.getStats = async (req, res) => {
  try {
    const managersCount = await User.countDocuments({ role: "manager" });
    const projectsCount = await Project.countDocuments();
    const completedTasks = await Project.aggregate([
      { $group: { _id: null, total: { $sum: "$completedTasks" } } },
    ]);
    const pendingTasks = await Project.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $subtract: ["$tasksCount", "$completedTasks"] } },
        },
      },
    ]);

    res.json({
      status: "success",
      data: {
        managersCount,
        projectsCount,
        completedTasks: completedTasks[0]?.total || 0,
        pendingTasks: pendingTasks[0]?.total || 0,
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
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find().populate(
      "assignedManager",
      "name email",
    );
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
};

exports.createProject = async (req, res) => {
  try {
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
      files,
    } = req.body;

    const project = await Project.create({
      clientName,
      siteName,
      location,
      mapLink,
      priority,
      deadline,
      description,
      notes,
      assignedManager,
      files,
      status: "Planning",
    });

    res.status(201).json({
      status: "success",
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to create project",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" });
    res.json({
      status: "success",
      data: managers,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch managers",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
