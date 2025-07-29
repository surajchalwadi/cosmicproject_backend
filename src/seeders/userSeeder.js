const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Project = require("../models/Project");
const { connectDB } = require("../config/database");
const { logger } = require("../utils/logger");
const { DEFAULT_USERS } = require("../utils/constants");

const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();

    // Create database indexes for better performance
    await createIndexes();

    // Clear existing users (optional - remove if you want to keep existing data)
    await User.deleteMany({});
    await Project.deleteMany({});
    logger.info("Cleared existing users");

    // Hash passwords before inserting users
    const usersWithHashedPasswords = await Promise.all(
      DEFAULT_USERS.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10),
      }))
    );
    // Insert users
    await User.insertMany(usersWithHashedPasswords);
    logger.info(`✅ Successfully seeded ${usersWithHashedPasswords.length} users`);

    // Seed sample projects
    await seedSampleProjects();

    console.log("\n🚀 Database seeding completed successfully!");
    console.log("\nAvailable login credentials:");
    console.log("================================");

  } catch (error) {
    logger.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    // Create text indexes for search functionality
    await Project.collection.createIndex({
      siteName: 'text',
      clientName: 'text',
      location: 'text'
    });

    // Create compound indexes for common queries
    await Project.collection.createIndex({
      assignedManager: 1,
      status: 1
    });

    await User.collection.createIndex({
      role: 1,
      isActive: 1
    });

    logger.info('✅ Database indexes created successfully');
  } catch (error) {
    logger.error('❌ Error creating indexes:', error);
  }
};

const seedSampleProjects = async () => {
  try {
    // Get managers for project assignment
    const managers = await User.find({ role: 'manager' });
    
    if (managers.length === 0) {
      logger.warn('No managers found, skipping sample projects');
      return;
    }

    const sampleProjects = [
      {
        clientName: "TechCorp Industries",
        siteName: "Main Office Security Upgrade",
        location: "123 Business District, Downtown",
        mapLink: "https://maps.google.com/?q=123+Business+District+Downtown",
        priority: "high",
        status: "In Progress",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        description: "Complete CCTV system installation and network security setup for main office building",
        notes: "Client requires 24/7 monitoring capability",
        assignedManager: managers[0]._id,
        assignedManagerName: managers[0].name,
        completionPercentage: 45,
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      },
      {
        clientName: "Retail Solutions Ltd",
        siteName: "Shopping Mall Security System",
        location: "456 Mall Avenue, Retail District",
        mapLink: "https://maps.google.com/?q=456+Mall+Avenue+Retail+District",
        priority: "medium",
        status: "Planning",
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        description: "Multi-zone CCTV installation across shopping mall with central monitoring station",
        notes: "Requires coordination with multiple store owners",
        assignedManager: managers[1] ? managers[1]._id : managers[0]._id,
        assignedManagerName: managers[1] ? managers[1].name : managers[0].name,
        completionPercentage: 0,
        startDate: new Date(),
      },
      {
        clientName: "Manufacturing Corp",
        siteName: "Factory Perimeter Security",
        location: "789 Industrial Zone East",
        mapLink: "https://maps.google.com/?q=789+Industrial+Zone+East",
        priority: "urgent",
        status: "Delayed",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        description: "Perimeter security system with motion detection and alarm integration",
        notes: "Weather delays affecting outdoor installation",
        assignedManager: managers[2] ? managers[2]._id : managers[0]._id,
        assignedManagerName: managers[2] ? managers[2].name : managers[0].name,
        completionPercentage: 25,
        startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      }
    ];

    await Project.insertMany(sampleProjects);
    logger.info(`✅ Successfully seeded ${sampleProjects.length} sample projects`);
  } catch (error) {
    logger.error('❌ Error seeding sample projects:', error);
  }
};

// Run seeder if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };