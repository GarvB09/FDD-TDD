/**
 * FDD to TDD Backend - Express API
 * Handles file uploads and orchestrates the AI pipeline
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const uploadRoutes = require("./routes/upload");
const tddRoutes = require("./routes/tdd");

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure directories exist
fs.ensureDirSync(path.join(__dirname, "../uploads"));
fs.ensureDirSync(path.join(__dirname, "../generated_tdd"));

// Middleware
// FRONTEND_URL may be a comma-separated list, e.g.
// "https://my-app.vercel.app,http://localhost:3000"
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static access to generated files
app.use("/generated", express.static(path.join(__dirname, "../generated_tdd")));

// Routes
app.use("/api", uploadRoutes);
app.use("/api", tddRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "FDD-TDD Backend",
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[Error]", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
  console.log(`📁 Uploads dir: ${path.join(__dirname, "../uploads")}`);
  console.log(`📄 TDD output: ${path.join(__dirname, "../generated_tdd")}`);
});

module.exports = app;
