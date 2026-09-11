/**
 * Upload Route
 * POST /api/upload-fdd
 * Accepts PDF, DOCX, or Markdown, sends to AI service for parsing
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [".pdf", ".docx", ".md"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOCX, and Markdown files are supported."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

/**
 * POST /api/upload-fdd
 * Uploads the FDD file and extracts its text + NLP components
 */
router.post("/upload-fdd", upload.single("fdd"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase().slice(1); // "pdf" or "docx"
    const documentId = path.basename(req.file.filename, path.extname(req.file.filename));

    console.log(`[Upload] File received: ${req.file.originalname} → ${filePath}`);

    // Step 1: Parse document text
    const parseRes = await axios.post(`${AI_SERVICE_URL}/parse-document`, {
      file_path: filePath,
      file_type: fileExt,
    });

    const { text } = parseRes.data;

    // Step 2: Extract NLP components
    const nlpRes = await axios.post(`${AI_SERVICE_URL}/extract-components`, {
      text,
    });

    const { components } = nlpRes.data;

    // Save metadata for later TDD generation
    const metaPath = path.join(__dirname, "../../uploads", `${documentId}.meta.json`);
    await fs.writeJson(metaPath, {
      documentId,
      originalName: req.file.originalname,
      filePath,
      fileType: fileExt,
      extractedText: text,
      components,
      uploadedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      documentId,
      originalName: req.file.originalname,
      fileType: fileExt,
      textLength: text.length,
      components,
    });

  } catch (err) {
    console.error("[Upload Error]", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        error: err.response.data?.detail || "AI service error during upload.",
      });
    }
    next(err);
  }
});

module.exports = router;
