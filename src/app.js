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

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

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

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Handle 404 errors
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
