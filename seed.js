const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: __dirname + '/.env' });

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing users
    await User.deleteMany({});
    console.log("Cleared existing users");

    // Define users
    const users = [
      {
        name: "System Administrator",
        email: "admin@cosmicsolutions.com",
        password: await bcrypt.hash("Admin@123", 12),
        role: "superadmin",
        isActive: true,
      },
      {
        name: "Site Manager",
        email: "manager@cosmicsolutions.com",
        password: await bcrypt.hash("Manager@123", 12),
        role: "manager",
        isActive: true,
      },
      {
        name: "Sarah Johnson",
        email: "sarah.johnson@cosmicsolutions.com",
        password: await bcrypt.hash("Sarah@123", 12),
        role: "manager",
        isActive: true,
      },
      {
        name: "David Kim",
        email: "david.kim@cosmicsolutions.com",
        password: await bcrypt.hash("David@123", 12),
        role: "manager",
        isActive: true,
      },
      {
        name: "Field Technician",
        email: "technician@cosmicsolutions.com",
        password: await bcrypt.hash("Tech@123", 12),
        role: "technician",
        isActive: true,
      },
      {
        name: "Mike Chen",
        email: "mike.chen@cosmicsolutions.com",
        password: await bcrypt.hash("Mike@123", 12),
        role: "technician",
        isActive: true,
      },
      {
        name: "Lisa Rodriguez",
        email: "lisa.rodriguez@cosmicsolutions.com",
        password: await bcrypt.hash("Lisa@123", 12),
        role: "technician",
        isActive: true,
      },
      {
        name: "James Wilson",
        email: "james.wilson@cosmicsolutions.com",
        password: await bcrypt.hash("James@123", 12),
        role: "technician",
        isActive: true,
      },
    ];

    // Insert users
    await User.insertMany(users);
    console.log(`✅ Successfully seeded ${users.length} users`);

    console.log("\n🚀 Database seeding completed successfully!");
    console.log("\nAvailable login credentials:");
    console.log("================================");
    console.log("SUPERADMIN: admin@cosmicsolutions.com / Admin@123");
    console.log("MANAGER: manager@cosmicsolutions.com / Manager@123");
    console.log("MANAGER: sarah.johnson@cosmicsolutions.com / Sarah@123");
    console.log("MANAGER: david.kim@cosmicsolutions.com / David@123");
    console.log("TECHNICIAN: technician@cosmicsolutions.com / Tech@123");
    console.log("TECHNICIAN: mike.chen@cosmicsolutions.com / Mike@123");
    console.log("TECHNICIAN: lisa.rodriguez@cosmicsolutions.com / Lisa@123");
    console.log("TECHNICIAN: james.wilson@cosmicsolutions.com / James@123");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding users:", error);
    process.exit(1);
  }
};

seedUsers();
