const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const logger = require("../utils/logger");

const router = express.Router();

// Seed endpoint (only for development)
router.post("/users", async (req, res) => {
  try {
    if (process.env.NODE_ENV !== "development") {
      return res.status(403).json({
        status: "error",
        message: "Seeding is only allowed in development mode",
      });
    }

    // Clear existing users
    await User.deleteMany({});
    logger.info("Cleared existing users");

    // Define users
    const users = [
      {
        name: "System Administrator",
        email: "admin@cosmicsolutions.com",
        password: await bcrypt.hash("Admin@123", 10),
        role: "superadmin",
        isActive: true,
      },
      {
        name: "Site Manager",
        email: "manager@cosmicsolutions.com",
        password: await bcrypt.hash("Manager@123", 10),
        role: "manager",
        isActive: true,
      },
      {
        name: "Sarah Johnson",
        email: "sarah.johnson@cosmicsolutions.com",
        password: await bcrypt.hash("Sarah@123", 10),
        role: "manager",
        isActive: true,
      },
      {
        name: "David Kim",
        email: "david.kim@cosmicsolutions.com",
        password: await bcrypt.hash("David@123", 10),
        role: "manager",
        isActive: true,
      },
      {
        name: "Field Technician",
        email: "technician@cosmicsolutions.com",
        password: await bcrypt.hash("Tech@123", 10),
        role: "technician",
        isActive: true,
      },
      {
        name: "Mike Chen",
        email: "mike.chen@cosmicsolutions.com",
        password: await bcrypt.hash("Mike@123", 10),
        role: "technician",
        isActive: true,
      },
      {
        name: "Lisa Rodriguez",
        email: "lisa.rodriguez@cosmicsolutions.com",
        password: await bcrypt.hash("Lisa@123", 10),
        role: "technician",
        isActive: true,
      },
      {
        name: "James Wilson",
        email: "james.wilson@cosmicsolutions.com",
        password: await bcrypt.hash("James@123", 10),
        role: "technician",
        isActive: true,
      },
    ];

    // Insert users
    await User.insertMany(users);
    logger.info(`Successfully seeded ${users.length} users`);

    res.status(200).json({
      status: "success",
      message: `Successfully seeded ${users.length} users`,
      data: {
        users: users.map((user) => ({
          name: user.name,
          email: user.email,
          role: user.role,
        })),
      },
    });
  } catch (error) {
    logger.error(`Seeding error: ${error.message}`);
    res.status(500).json({
      status: "error",
      message: "Failed to seed users",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

module.exports = router;
