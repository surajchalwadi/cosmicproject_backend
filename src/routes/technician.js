const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const Task = require("../models/Task");
const Project = require("../models/Project");

// Protect all technician routes and require technician role
router.use(protect);
router.use(authorize("technician"));

// Get technician's assigned tasks
router.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .populate("project", "siteName clientName location mapLink files")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });

    // Transform tasks to match frontend expectations
    const transformedTasks = tasks.map((task) => ({
      id: task._id,
      title: task.title,
      description: task.description,
      project: task.project ? task.project.siteName : "Unknown Project",
      location: task.project
        ? task.project.location
        : task.location || "Unknown Location",
      locationLink: task.locationLink || task.project?.mapLink || "",
      assignedBy: task.assignedBy ? task.assignedBy.name : "Unknown Manager",
      priority: task.priority,
      status: task.status,
      deadline: task.deadline,
      assignedDate: task.createdAt,
      startedDate: task.startedDate,
      completedDate: task.completedDate,
      progress: task.progress,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      files: task.files || [],
      projectFiles: task.project?.files || task.projectFiles || [],
    }));

    res.json({
      status: "success",
      data: transformedTasks,
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

// Get technician's dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const assignedTasksCount = await Task.countDocuments({
      assignedTo: req.user.id,
      status: "assigned",
    });

    const inProgressTasksCount = await Task.countDocuments({
      assignedTo: req.user.id,
      status: "in_progress",
    });

    const completedTasksCount = await Task.countDocuments({
      assignedTo: req.user.id,
      status: "completed",
    });

    const delayedTasksCount = await Task.countDocuments({
      assignedTo: req.user.id,
      status: "delayed",
    });

    res.json({
      status: "success",
      data: {
        assignedTasksCount,
        inProgressTasksCount,
        completedTasksCount,
        delayedTasksCount,
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

// Update task status
router.put("/tasks/:taskId/status", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, comment, files, delayReason } = req.body;

    // Find the task and ensure it belongs to this technician
    const task = await Task.findOne({
      _id: taskId,
      assignedTo: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        status: "error",
        message: "Task not found or access denied",
      });
    }

    // Prepare update data
    const updateData = { status };

    if (status === "in_progress" && !task.startedDate) {
      updateData.startedDate = new Date();
    } else if (status === "completed") {
      updateData.completedDate = new Date();
      updateData.progress = 100;
    }

    // Handle delay reason
    if (status === "delayed") {
      if (!delayReason || delayReason.trim() === "") {
        return res.status(400).json({
          status: "error",
          message: "Delay reason is required when reporting delay."
        });
      }
      updateData.delayReason = delayReason;
    } else {
      updateData.delayReason = undefined;
    }

    // Add comment if provided
    if (comment) {
      updateData.$push = {
        comments: {
          text: comment,
          author: req.user.id,
          createdAt: new Date(),
        },
      };
    }

    // Add files if provided
    let fileData = [];
    if (files && files.length > 0) {
      fileData = files.map((file) => ({
        name: file.name || file,
        url: file.url || file,
        uploadedBy: req.user.id,
        uploadedAt: new Date(),
      }));
      if (updateData.$push) {
        updateData.$push.files = { $each: fileData };
      } else {
        updateData.$push = { files: { $each: fileData } };
      }
    }

    // Add status log entry
    const statusLogEntry = {
      status,
      updatedBy: req.user.id,
      timestamp: new Date(),
      comment: comment || undefined,
      files: fileData,
      delayReason: status === "delayed" ? delayReason : undefined
    };
    if (!updateData.$push) updateData.$push = {};
    updateData.$push.statusLog = statusLogEntry;

    const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, {
      new: true,
    })
      .populate("project", "siteName clientName")
      .populate("assignedBy", "name email");

    // Fully populate the updated task before emitting
    const fullyPopulatedTask = await Task.findById(updatedTask._id)
      .populate("project", "siteName clientName location status tasks")
      .populate("assignedBy", "name email")
      .populate("assignedTo", "name email");

    // Fetch the parent project with tasks and status
    const parentProject = await Project.findById(fullyPopulatedTask.project._id)
      .populate("assignedManager", "name email")
      .populate({ path: "tasks", select: "title status assignedTo completedDate" });

    // Ensure the task is present in the parent project's tasks array
    if (parentProject && updatedTask && !parentProject.tasks.some(t => t.equals(updatedTask._id))) {
      parentProject.tasks.push(updatedTask._id);
      await parentProject.save();
    }

    // Automatic project status update based on task completion
    if (parentProject) {
      const allProjectTasks = await Task.find({ project: parentProject._id });
      
      if (allProjectTasks.length > 0) {
        const completedTasks = allProjectTasks.filter(task => task.status === "completed");
        const totalTasks = allProjectTasks.length;
        
        const completionPercentage = Math.round((completedTasks.length / totalTasks) * 100);
        
        await Project.findByIdAndUpdate(parentProject._id, {
          completedTasks: completedTasks.length,
          tasksCount: totalTasks,
          completionPercentage: completionPercentage
        });

        let newProjectStatus = parentProject.status;
        
        if (completedTasks.length === totalTasks) {
          newProjectStatus = "Completed";
        } else if (completedTasks.length > 0) {
          newProjectStatus = "In Progress";
        } else {
          newProjectStatus = "Planning";
        }

        if (newProjectStatus !== parentProject.status) {
          await Project.findByIdAndUpdate(parentProject._id, {
            status: newProjectStatus
          });
          
          // Update the parentProject object for socket emission
          parentProject.status = newProjectStatus;
          parentProject.completedTasks = completedTasks.length;
          parentProject.tasksCount = totalTasks;
          parentProject.completionPercentage = completionPercentage;
        }
      }
    }

    // Emit real-time event to manager and superadmin
    try {
      const { getIO } = require("../config/socket");
      const io = getIO();
      // Notify the assigned manager if available
      if (task && task.assignedBy) {
        console.log('Emitting task_status_updated to manager:', task.assignedBy, fullyPopulatedTask.status);
        io.to(`user_${task.assignedBy}`).emit("task_status_updated", {
          task: fullyPopulatedTask,
          project: parentProject,
          delayReason: updateData.delayReason || undefined
        });
      }
      // Notify all superadmins
      console.log('Emitting task_status_updated to superadmin:', fullyPopulatedTask.status);
      io.to("superadmin").emit("task_status_updated", {
        task: fullyPopulatedTask,
        project: parentProject,
        delayReason: updateData.delayReason || undefined
      });
    } catch (e) {
      console.error("Socket.IO emit error (task_status_updated):", e.message);
    }

    res.json({
      status: "success",
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to update task status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

module.exports = router;
