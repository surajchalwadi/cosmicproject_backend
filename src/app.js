const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const path = require("path");

const logger = require("./utils/logger");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const notificationRoutes = require("./routes/notifications");
const superAdminRoutes = require(path.join(__dirname, "routes", "superAdmin"));
const managerRoutes = require("./routes/manager");
const technicianRoutes = require("./routes/technician");
const reportsRoutes = require("./routes/reports");
const seedRoutes = require("./routes/seed");
const profileRoutes = require("./routes/profile");
const projectsRoutes = require("./routes/projects");
const filesRoutes = require("./routes/files");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Allow all origins for now to ensure frontend works
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

console.log("CORS: Allowing all origins for production");
app.use(cors(corsOptions));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
//   max: process.env.RATE_LIMIT_MAX || 100,
//   message: {
//     error: "Too many requests from this IP, please try again later.",
//   },
// });

// app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running successfully",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/files", filesRoutes);

// CORS middleware for uploads directory
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Root route to handle GET /
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Backend is running successfully 🚀",
    status: "ok",
    environment: process.env.NODE_ENV || "development",
  });
});
// Handle favicon requests to avoid errors in logs
app.get("/favicon.ico", (req, res) => res.status(204));

// Handle 404 errors
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
