/**
 * TDD Routes
 * POST /api/generate-tdd     - Generate TDD from uploaded FDD
 * GET  /api/tdd/:id          - Retrieve a generated TDD
 * GET  /api/tdd/:id/markdown - Get TDD as Markdown
 */

const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const axios = require("axios");
const router = express.Router();
const { validateAndSanitizeTDD, computeCompletenessScore } = require("../utils/tddValidator");
const { markdownToHtml, generatePdfFromTdd } = require("../utils/pdfExporter");
const performanceStore = {}; // In-memory store for timing data

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * POST /api/generate-tdd
 * Body: { documentId }
 */
router.post("/generate-tdd", async (req, res, next) => {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId is required." });
    }

    const metaPath = path.join(__dirname, "../../uploads", `${documentId}.meta.json`);
    if (!await fs.pathExists(metaPath)) {
      return res.status(404).json({ error: "Document not found. Please upload first." });
    }

    const meta = await fs.readJson(metaPath);
    console.log(`[TDD] Generating TDD for ${documentId}...`);
    const startTime = Date.now();

    // Call AI service to generate TDD.
    // Timeout is intentionally longer than the frontend's own 150s timeout
    // to it (ExtractedComponents.js) -- under a tight Groq per-minute token
    // budget, concurrent tool calls can trigger a retry cascade that still
    // succeeds, just slowly. Giving up here before the frontend would have
    // just turns a slow-but-working request into a spurious failure.
    const aiRes = await axios.post(`${AI_SERVICE_URL}/generate-tdd`, {
      extracted_text: meta.extractedText,
      document_id: documentId,
    }, { timeout: 180000 });

    const rawTdd = aiRes.data.tdd;

    // Validate and sanitize TDD structure
    const { valid, warnings, tdd } = validateAndSanitizeTDD(rawTdd);
    const completenessScore = computeCompletenessScore(tdd);
    if (warnings.length > 0) {
      console.warn(`[TDD] Validation warnings for ${documentId}:`, warnings);
    }

    // Persist TDD as JSON
    const tddDir = path.join(__dirname, "../../generated_tdd");
    await fs.ensureDir(tddDir);
    const tddPath = path.join(tddDir, `${documentId}.tdd.json`);
    await fs.writeJson(tddPath, {
      documentId,
      originalName: meta.originalName,
      generatedAt: new Date().toISOString(),
      extracted_components: meta.components,
      tdd,
    }, { spaces: 2 });

    // Also generate Markdown version
    const mdPath = path.join(tddDir, `${documentId}.tdd.md`);
    const markdown = tddToMarkdown(tdd, meta.originalName);
    await fs.writeFile(mdPath, markdown, "utf8");

    // Also generate HTML version (printable / PDF-ready)
    const htmlPath = path.join(tddDir, `${documentId}.tdd.html`);
    const html = markdownToHtml(markdown, `TDD - ${meta.originalName}`);
    await fs.writeFile(htmlPath, html, "utf8");
    const endTime = Date.now();
    performanceStore[documentId] = { startTime, endTime, durationSeconds: (endTime - startTime) / 1000 };

    console.log(`[TDD] Generated successfully: ${tddPath}`);

    res.json({
      success: true,
      documentId,
      completenessScore,
      validationWarnings: warnings,
      tdd,
      downloads: {
        json: `/generated/${documentId}.tdd.json`,
        markdown: `/generated/${documentId}.tdd.md`,
        html: `/generated/${documentId}.tdd.html`,
      }
    });

  } catch (err) {
    console.error("[TDD Gen Error]", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        error: err.response.data?.detail || "AI service error during TDD generation.",
      });
    }
    next(err);
  }
});

/**
 * PUT /api/tdd/:id
 * Body: { tdd }
 * Saves architect edits to a previously generated TDD, including the
 * Traceability Matrix. Re-validates, recomputes the completeness score, and
 * regenerates the Markdown/HTML exports so downloads stay in sync with
 * what's on screen.
 */
router.put("/tdd/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tdd: editedTdd } = req.body;
    if (!editedTdd || typeof editedTdd !== "object") {
      return res.status(400).json({ error: "Body must include a 'tdd' object." });
    }

    const tddDir = path.join(__dirname, "../../generated_tdd");
    const tddPath = path.join(tddDir, `${id}.tdd.json`);
    if (!await fs.pathExists(tddPath)) {
      return res.status(404).json({ error: "TDD not found. Generate it first." });
    }

    const existing = await fs.readJson(tddPath);

    const merged = {
      ...editedTdd,
      traceability_matrix: editedTdd.traceability_matrix || existing.tdd?.traceability_matrix || [],
    };

    const { warnings, tdd } = validateAndSanitizeTDD(merged);
    const completenessScore = computeCompletenessScore(tdd);

    await fs.writeJson(tddPath, {
      ...existing,
      tdd,
      editedAt: new Date().toISOString(),
    }, { spaces: 2 });

    const markdown = tddToMarkdown(tdd, existing.originalName);
    await fs.writeFile(path.join(tddDir, `${id}.tdd.md`), markdown, "utf8");
    const html = markdownToHtml(markdown, `TDD - ${existing.originalName}`);
    await fs.writeFile(path.join(tddDir, `${id}.tdd.html`), html, "utf8");

    console.log(`[TDD] Saved edits for ${id}`);
    res.json({ success: true, documentId: id, tdd, completenessScore, validationWarnings: warnings });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tdd/:id
 * Returns previously generated TDD JSON
 */
router.get("/tdd/:id", async (req, res, next) => {
  try {
    const tddPath = path.join(__dirname, "../../generated_tdd", `${req.params.id}.tdd.json`);
    if (!await fs.pathExists(tddPath)) {
      return res.status(404).json({ error: "TDD not found for this document." });
    }
    const data = await fs.readJson(tddPath);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tdd/:id/markdown
 * Returns previously generated TDD as Markdown
 */
router.get("/tdd/:id/markdown", async (req, res, next) => {
  try {
    const mdPath = path.join(__dirname, "../../generated_tdd", `${req.params.id}.tdd.md`);
    if (!await fs.pathExists(mdPath)) {
      return res.status(404).json({ error: "Markdown TDD not found." });
    }
    const md = await fs.readFile(mdPath, "utf8");
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(md);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tdd/:id/html
 * Returns TDD as a printable HTML page (open in browser → Print → Save as PDF)
 */
router.get("/tdd/:id/html", async (req, res, next) => {
  try {
    const htmlPath = path.join(__dirname, "../../generated_tdd", `${req.params.id}.tdd.html`);
    if (!await fs.pathExists(htmlPath)) {
      // Try to regenerate from markdown
      const mdPath = path.join(__dirname, "../../generated_tdd", `${req.params.id}.tdd.md`);
      if (!await fs.pathExists(mdPath)) {
        return res.status(404).json({ error: "HTML TDD not found. Generate the TDD first." });
      }
      const md = await fs.readFile(mdPath, "utf8");
      const html = markdownToHtml(md, `TDD - ${req.params.id}`);
      await fs.writeFile(htmlPath, html, "utf8");
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }
    const html = await fs.readFile(htmlPath, "utf8");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    next(err);
  }
});

router.get("/tdd/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const tddPath = path.join(__dirname, "../../generated_tdd", `${id}.tdd.json`);
    if (!await fs.pathExists(tddPath)) {
      return res.status(404).json({ error: "TDD not found. Generate TDD first." });
    }
    const data = await fs.readJson(tddPath);
    const pdfBuffer = await generatePdfFromTdd(
      data.tdd,
      `Technical Design Document`,
      data.originalName || id
    );
    if (!pdfBuffer || pdfBuffer.length < 100) {
      return res.status(500).json({ error: "PDF generation produced empty output" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${id}_tdd.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "PDF generation failed", detail: err.message });
  }
});

/**
 * GET /api/tdd/:id/openapi
 * Returns the TDD's api_design as an OpenAPI 3.0 JSON spec
 */
router.get("/tdd/:id/openapi", async (req, res, next) => {
  try {
    const tddPath = path.join(__dirname, "../../generated_tdd", `${req.params.id}.tdd.json`);
    if (!await fs.pathExists(tddPath)) {
      return res.status(404).json({ error: "TDD not found. Generate TDD first." });
    }
    const data = await fs.readJson(tddPath);
    const tdd = data.tdd || {};

    // Call AI service to generate OpenAPI spec
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const specRes = await axios.post(`${AI_SERVICE_URL}/generate-openapi`, { tdd });
    const spec = specRes.data.openapi_spec;

    // Also save for download
    const specPath = path.join(__dirname, "../../generated_tdd", `${req.params.id}.openapi.json`);
    await fs.writeJson(specPath, spec, { spaces: 2 });

    res.json({ success: true, openapi_spec: spec });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Markdown generator from TDD JSON
// ────────────────────────────────────────────────
function tddToMarkdown(tdd, docName = "Document") {
  const lines = [];
  const h = (n, txt) => lines.push(`${"#".repeat(n)} ${txt}\n`);
  const p = (txt) => lines.push(`${txt}\n`);
  const li = (txt) => lines.push(`- ${txt}`);
  const br = () => lines.push("");

  h(1, `Technical Design Document`);
  p(`> Generated from: **${docName}**`);
  p(`> Generated at: ${new Date().toISOString()}`);
  br();

  // 1. Introduction
  if (tdd.introduction) {
    const intro = tdd.introduction;
    h(2, "1. Introduction");
    h(3, "1.1 Purpose");
    p(intro.purpose || "");
    h(3, "1.2 Scope");
    p(intro.scope || "");
    if (intro.assumptions?.length) {
      h(3, "1.3 Assumptions");
      intro.assumptions.forEach(a => li(a));
    }
    if (intro.constraints?.length) {
      h(3, "1.4 Constraints");
      intro.constraints.forEach(c => li(c));
    }
    if (intro.tech_stack) {
      h(3, "1.5 Technology Stack");
      Object.entries(intro.tech_stack).forEach(([k, v]) => p(`**${k}**: ${v}`));
    }
    br();
  }

  // 2. System Architecture
  if (tdd.system_architecture) {
    const sa = tdd.system_architecture;
    h(2, "2. System Architecture");
    p(sa.overview || "");
    p(`**Pattern:** ${sa.architectural_pattern || ""}`);
    p(`**Communication:** ${sa.communication || ""}`);
    if (sa.components?.length) {
      h(3, "2.1 Components");
      p("| Name | Type | Technology | Responsibility |");
      p("|------|------|------------|----------------|");
      sa.components.forEach(c =>
        p(`| ${c.name} | ${c.type} | ${c.technology} | ${c.responsibility} |`)
      );
    }
    if (sa.mermaid_diagram) {
      h(3, "2.2 Architecture Diagram");
      p("```mermaid");
      p(sa.mermaid_diagram);
      p("```");
    }
    br();
  }

  // 3. Data Model
  if (tdd.data_model) {
    const dm = tdd.data_model;
    h(2, "3. Data Model");
    p(dm.overview || "");
    p(`**Database Type:** ${dm.database_type || ""}`);
    dm.tables?.forEach((table, i) => {
      h(3, `3.${i + 1} Table: ${table.name}`);
      p(table.purpose || "");
      if (table.columns?.length) {
        p("| Column | Type | Constraints | Description |");
        p("|--------|------|-------------|-------------|");
        table.columns.forEach(col =>
          p(`| ${col.name} | ${col.type} | ${col.constraints || ""} | ${col.description || ""} |`)
        );
      }
      if (table.relationships?.length) {
        p(`**Relationships:** ${table.relationships.join(", ")}`);
      }
    });
    br();
  }

  // 4. API Design
  if (tdd.api_design) {
    const api = tdd.api_design;
    h(2, "4. API Design");
    p(api.overview || "");
    p(`**Base URL:** \`${api.base_url || ""}\``);
    p(`**Authentication:** ${api.authentication || ""}`);
    if (api.endpoints?.length) {
      h(3, "4.1 Endpoints");
      api.endpoints.forEach((ep, i) => {
        h(4, `${ep.method} ${ep.path}`);
        p(ep.description || "");
        if (ep.request_body) p(`**Request:** ${ep.request_body}`);
        if (ep.response) p(`**Response:** ${ep.response}`);
        if (ep.fdd_requirement) p(`> FDD: ${ep.fdd_requirement}`);
        br();
      });
    }
    br();
  }

  // 5. Component Architecture
  if (tdd.component_architecture) {
    const ca = tdd.component_architecture;
    h(2, "5. Component Architecture");
    p(ca.overview || "");
    if (ca.frontend_components?.length) {
      h(3, "5.1 Frontend Components");
      ca.frontend_components.forEach(c => {
        h(4, c.name);
        p(`**Type:** ${c.type || ""} | **Props:** ${c.props || ""}`);
        p(c.responsibility || "");
      });
    }
    if (ca.backend_services?.length) {
      h(3, "5.2 Backend Services");
      ca.backend_services.forEach(s => {
        h(4, s.name);
        p(s.responsibility || "");
        if (s.methods?.length) p(`Methods: \`${s.methods.join("`, `")}\``);
      });
    }
    br();
  }

  // 6. Non-Functional Requirements
  if (tdd.non_functional_requirements) {
    const nfr = tdd.non_functional_requirements;
    h(2, "6. Non-Functional Requirements");
    Object.entries(nfr).forEach(([k, v]) => {
      h(3, `6. ${k.charAt(0).toUpperCase() + k.slice(1)}`);
      p(v || "");
    });
    br();
  }

  // 7. Deployment Architecture
  if (tdd.deployment_architecture) {
    const da = tdd.deployment_architecture;
    h(2, "7. Deployment Architecture");
    p(da.overview || "");
    p(`**Infrastructure:** ${da.infrastructure || ""}`);
    p(`**CI/CD:** ${da.ci_cd || ""}`);
    p(`**Monitoring:** ${da.monitoring || ""}`);
    if (da.environments?.length) {
      h(3, "7.1 Environments");
      da.environments.forEach(e => li(e));
    }
    if (da.mermaid_diagram) {
      h(3, "7.2 Deployment Diagram");
      p("```mermaid");
      p(da.mermaid_diagram);
      p("```");
    }
    br();
  }

  // 8. Traceability Matrix
  if (tdd.traceability_matrix?.length) {
    h(2, "8. Traceability Matrix (FDD → TDD)");
    p("| FDD Requirement | APIs | Tables | Components | Coverage |");
    p("|----------------|------|--------|------------|----------|");
    tdd.traceability_matrix.forEach(row => {
      const req = (row.fdd_requirement || "").slice(0, 80).replace(/\|/g, "\\|");
      const apis = (row.tdd_apis || []).join(", ").replace(/\|/g, "\\|");
      const tables = (row.tdd_tables || []).join(", ");
      const comps = (row.tdd_components || []).join(", ");
      const cov = row.coverage || "";
      p(`| ${req} | ${apis} | ${tables} | ${comps} | ${cov} |`);
    });
  }

  return lines.join("\n");
}

// Reports routes
router.post("/reports/completeness/:id", async (req, res, next) => {
  try {
    const { tdd } = req.body;
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const result = await axios.post(`${AI_SERVICE_URL}/generate-completeness-report`, { tdd });
    res.json(result.data);
  } catch (err) { next(err); }
});

router.post("/reports/traceability/:id", async (req, res, next) => {
  try {
    const { tdd, components } = req.body;
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const result = await axios.post(`${AI_SERVICE_URL}/generate-traceability-report`, { tdd, components });
    res.json(result.data);
  } catch (err) { next(err); }
});

router.get("/reports/performance/:id", async (req, res, next) => {
  try {
    const timing = performanceStore[req.params.id];
    if (!timing) return res.status(404).json({ error: "No timing data. Generate TDD first." });
    const MANUAL_AVG_MINUTES = 12 * 60;
    const genMinutes = timing.durationSeconds / 60;
    const reduction = Math.min(((MANUAL_AVG_MINUTES - genMinutes) / MANUAL_AVG_MINUTES * 100), 99.9);
    res.json({
      success: true,
      report: {
        test: "Performance Metrics",
        generation_time_seconds: timing.durationSeconds,
        generation_time_minutes: Math.round(genMinutes * 100) / 100,
        manual_time_range: "8-16 hours",
        effort_reduction_percent: Math.round(reduction * 10) / 10,
        overall_status: reduction >= 70 ? "PASS " : "FAIL ",
        target: "≥ 70% effort reduction",
        comparison: {
          manual: "8-16 hours",
          automated: `${Math.round(timing.durationSeconds)}s`,
          speedup: `${Math.round(MANUAL_AVG_MINUTES / Math.max(genMinutes, 0.1))}x faster`
        }
      }
    });
  } catch (err) { next(err); }
});

router.post("/diagrams/:id", async (req, res, next) => {
  try {
    const { tdd, components } = req.body;
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const result = await axios.post(`${AI_SERVICE_URL}/generate-diagrams`, { tdd, components });
    res.json(result.data);
  } catch (err) { next(err); }
});

module.exports = router;
