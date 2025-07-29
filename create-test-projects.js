const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Import models
const Project = require("./src/models/Project");
const User = require("./src/models/User");

async function createTestProjects() {
  try {
    // Find a manager to assign projects to
    const manager = await User.findOne({ role: "manager" });

    if (!manager) {
      console.log("No manager found. Please run the seed script first.");
      return;
    }

    // Clear existing projects first (optional)
    await Project.deleteMany({});
    console.log("Cleared existing projects");

    // Create test projects
    const projects = [
      {
        clientName: "TechCorp Industries",
        siteName: "Corporate Headquarters Security System",
        location: "123 Business District, Tech City, TC 12345",
        mapLink: "https://maps.google.com/?q=123+Business+District",
        priority: "high",
        deadline: new Date("2024-12-31"),
        description:
          "Install comprehensive CCTV security system for corporate headquarters including 24 cameras, control room setup, and network infrastructure.",
        notes:
          "High priority project. Client requires completion before year end.",
        assignedManager: manager._id,
        status: "Planning",
        progress: 0,
        tasksCount: 0,
        completedTasks: 0,
      },
      {
        clientName: "Metro Shopping Center",
        siteName: "Shopping Mall Security Upgrade",
        location: "456 Commerce Avenue, Shopping District, SC 54321",
        mapLink: "https://maps.google.com/?q=456+Commerce+Avenue",
        priority: "medium",
        deadline: new Date("2024-11-15"),
        description:
          "Upgrade existing security system with modern IP cameras, access control integration, and central monitoring dashboard.",
        notes:
          "Replace 15 analog cameras with IP cameras. Integrate with existing access control system.",
        assignedManager: manager._id,
        status: "Planning",
        progress: 0,
        tasksCount: 0,
        completedTasks: 0,
      },
      {
        clientName: "City Hospital",
        siteName: "Medical Facility Security Enhancement",
        location: "789 Healthcare Drive, Medical Center, MC 98765",
        mapLink: "https://maps.google.com/?q=789+Healthcare+Drive",
        priority: "urgent",
        deadline: new Date("2024-10-30"),
        description:
          "Implement security enhancement including additional cameras in patient areas, pharmacy security, and emergency response integration.",
        notes:
          "HIPAA compliance required. 24/7 monitoring needed for critical areas.",
        assignedManager: manager._id,
        status: "Planning",
        progress: 0,
        tasksCount: 0,
        completedTasks: 0,
      },
    ];

    // Insert the projects
    const createdProjects = await Project.insertMany(projects);

    console.log(
      `✅ Successfully created ${createdProjects.length} test projects:`,
    );
    createdProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.siteName} (${project.clientName})`);
    });

    console.log(`\nAssigned to manager: ${manager.name} (${manager.email})`);
  } catch (error) {
    console.error("Error creating test projects:", error);
  } finally {
    mongoose.connection.close();
  }
}

createTestProjects();
