const puppeteer = require("puppeteer");

const HTML_STYLE = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    line-height: 1.7;
    color: #1A1A1A;
    background: #F7F5EF;
    max-width: 960px;
    margin: 0 auto;
    padding: 40px 48px;
  }
  h1 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px; color: #1A1A1A; border-bottom: 3px solid #1A1A1A; padding-bottom: 8px; margin-bottom: 24px; }
  h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 20px; color: #2C5F7C; border-bottom: 1px solid #D8D2C4; padding-bottom: 4px; margin-top: 40px; margin-bottom: 16px; }
  h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; color: #1A1A1A; margin-top: 24px; margin-bottom: 8px; }
  h4 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 13px; color: #5B584E; margin-top: 16px; margin-bottom: 4px; }
  p { margin: 6px 0; }
  blockquote { border-left: 3px solid #2C5F7C; margin: 8px 0; padding: 8px 16px; background: #FFFFFF; color: #1A1A1A; }
  ul { padding-left: 24px; margin: 6px 0; }
  li { margin: 3px 0; }
  strong { color: #1A1A1A; }
  code { background: #FFFFFF; border: 1px solid #D8D2C4; padding: 2px 6px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #2C5F7C; }
  pre { background: #FFFFFF; border: 1px solid #D8D2C4; color: #1A1A1A; padding: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  pre code { background: none; border: none; color: inherit; padding: 0; }

  /* ── Tables ── */
  .tdd-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 24px 0;
    font-size: 12px;
    border: 1px solid #BDB5A0;
    background: #FFFFFF;
  }
  .tdd-table th {
    background: #FBFAF5;
    color: #5B584E;
    padding: 9px 12px;
    text-align: left;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
    border: 1px solid #D8D2C4;
    white-space: nowrap;
  }
  .tdd-table td {
    padding: 8px 12px;
    border: 1px solid #E4DFD3;
    vertical-align: top;
    color: #1A1A1A;
  }
  .tdd-table tr:nth-child(even) td { background: #FBFAF5; }

  .chip {
    display: inline-block;
    background: #FFFFFF;
    color: #2C5F7C;
    padding: 1px 7px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    margin: 1px 2px;
    border: 1px solid #2C5F7C;
  }
  .method-get    { color:#3A7355; border-color:#3A7355; }
  .method-post   { color:#2C5F7C; border-color:#2C5F7C; }
  .method-put    { color:#C8551E; border-color:#C8551E; }
  .method-delete { color:#A13327; border-color:#A13327; }
  .coverage-full    { color:#3A7355; border-color:#3A7355; }
  .coverage-partial { color:#C8551E; border-color:#C8551E; }

  .meta { color: #5B584E; font-size: 12px; margin-bottom: 32px; font-family: 'IBM Plex Mono', monospace; }

  .diagram-container {
    margin: 20px 0 28px 0;
    padding: 16px;
    background: #FFFFFF;
    border: 1px solid #D8D2C4;
    text-align: center;
  }
  .diagram-container svg {
    max-width: 100%;
    height: auto;
  }
  .diagram-error {
    margin: 16px 0;
    padding: 12px 16px;
    background: #FBEAE6;
    border: 1px solid #A13327;
    color: #A13327;
    font-size: 12px;
  }
  .diagram-error pre {
    background: none;
    color: #A13327;
    font-size: 11px;
    margin-top: 8px;
    white-space: pre-wrap;
  }

  @media print {
    body { padding: 20px; max-width: 100%; background: #FFFFFF; }
    h2 { page-break-before: always; }
    h1, h3, h4 { page-break-after: avoid; }
    .tdd-table { page-break-inside: avoid; }
    pre { page-break-inside: avoid; }
    @page { margin: 2cm; size: A4; }
  }
</style>
`;

const MERMAID_INIT = `{
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    themeVariables: {
      fontFamily: "'Inter', sans-serif",
      primaryColor: '#EAF1F5',
      primaryTextColor: '#1A1A1A',
      primaryBorderColor: '#2C5F7C',
      lineColor: '#2C5F7C',
      secondaryColor: '#F7F5EF',
      tertiaryColor: '#FFFFFF',
      mainBkg: '#EAF1F5',
      nodeBorder: '#2C5F7C',
      clusterBkg: '#F7F5EF',
      clusterBorder: '#D8D2C4',
      titleColor: '#1A1A1A',
      edgeLabelBackground: '#F7F5EF',
      actorBkg: '#EAF1F5',
      actorBorder: '#2C5F7C',
      actorTextColor: '#1A1A1A',
      signalColor: '#2C5F7C',
      signalTextColor: '#1A1A1A',
    },
    er: { diagramPadding: 20 },
    flowchart: { useMaxWidth: true, htmlLabels: true }
  }`;

/**
 * Build a proper HTML table from headers + rows arrays
 */
function htmlTable(headers, rows) {
  if (!rows || rows.length === 0) return "";
  const ths = headers.map(h => `<th>${h}</th>`).join("");
  const trs = rows.map(cells =>
    `<tr>${cells.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`
  ).join("\n");
  return `<table class="tdd-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function chip(text, cls = "") {
  return `<span class="chip ${cls}">${text}</span>`;
}

/**
 * Convert TDD JSON object directly to a full styled HTML document.
 * This avoids markdown → HTML conversion entirely, giving us proper tables.
 */
function tddToHtml(tdd = {}, title = "Technical Design Document", docName = "", diagrams = {}) {
  const sections = [];
  const s = (html) => sections.push(html);

  // ── Header ──
  s(`<h1>${title}</h1>`);
  if (docName) s(`<p class="meta">Generated from: <strong>${docName}</strong> &nbsp;|&nbsp; ${new Date().toISOString()}</p>`);

  // ── 1. Introduction ──
  if (tdd.introduction) {
    const i = tdd.introduction;
    s(`<h2>1. Introduction</h2>`);
    if (i.purpose)  s(`<h3>1.1 Purpose</h3><p>${i.purpose}</p>`);
    if (i.scope)    s(`<h3>1.2 Scope</h3><p>${i.scope}</p>`);
    if (i.assumptions?.length) {
      s(`<h3>1.3 Assumptions</h3><ul>${i.assumptions.map(a => `<li>${a}</li>`).join("")}</ul>`);
    }
    if (i.constraints?.length) {
      s(`<h3>1.4 Constraints</h3><ul>${i.constraints.map(c => `<li>${c}</li>`).join("")}</ul>`);
    }
    if (i.tech_stack && Object.keys(i.tech_stack).length) {
      const rows = Object.entries(i.tech_stack).map(([k, v]) => [k, v]);
      s(`<h3>1.5 Technology Stack</h3>`);
      s(htmlTable(["Layer", "Technology"], rows));
    }
  }

  // ── 2. System Architecture ──
  if (tdd.system_architecture) {
    const sa = tdd.system_architecture;
    s(`<h2>2. System Architecture</h2>`);
    if (sa.overview)               s(`<p>${sa.overview}</p>`);
    if (sa.architectural_pattern)  s(`<p><strong>Pattern:</strong> ${sa.architectural_pattern}</p>`);
    if (sa.communication)          s(`<p><strong>Communication:</strong> ${sa.communication}</p>`);
    if (sa.components?.length) {
      s(`<h3>2.1 Components</h3>`);
      s(htmlTable(
        ["Name", "Type", "Technology", "Responsibility"],
        sa.components.map(c => [
          `<strong>${c.name}</strong>`,
          c.type,
          chip(c.technology),
          c.responsibility
        ])
      ));
    }
if (sa.mermaid_diagram) {
  s(`<h3>2.2 Architecture Diagram</h3>`);
  if (diagrams.architecture) {
    s(`<div class="diagram-container">${diagrams.architecture}</div>`);
  } else {
    s(`<div class="diagram-error">⚠ Architecture diagram could not be rendered.<br/><pre>${sa.mermaid_diagram}</pre></div>`);
  }
}
}

  // ── 3. Data Model ──
  if (tdd.data_model) {
    const dm = tdd.data_model;
    s(`<h2>3. Data Model</h2>`);
    if (dm.overview)       s(`<p>${dm.overview}</p>`);
    if (dm.database_type)  s(`<p><strong>Database Type:</strong> ${dm.database_type}</p>`);
    dm.tables?.forEach((table, i) => {
      s(`<h3>3.${i + 1} Table: ${table.name}</h3>`);
      if (table.purpose) s(`<p>${table.purpose}</p>`);
      if (table.columns?.length) {
        s(htmlTable(
          ["Column", "Type", "Constraints", "Description"],
          table.columns.map(col => [
            `<code>${col.name}</code>`,
            chip(col.type),
            col.constraints || "",
            col.description || ""
          ])
        ));
      }
      if (table.relationships?.length) {
        s(`<p><strong>Relationships:</strong> ${table.relationships.map(r => chip(r)).join(" ")}</p>`);
      }
    });
  }

  // ── 4. API Design ──
  if (tdd.api_design) {
    const api = tdd.api_design;
    s(`<h2>4. API Design</h2>`);
    if (api.overview)        s(`<p>${api.overview}</p>`);
    if (api.base_url)        s(`<p><strong>Base URL:</strong> <code>${api.base_url}</code></p>`);
    if (api.authentication)  s(`<p><strong>Authentication:</strong> ${api.authentication}</p>`);
    if (api.endpoints?.length) {
      s(`<h3>4.1 Endpoints</h3>`);
      s(htmlTable(
        ["Method", "Path", "Description", "Request", "Response"],
        api.endpoints.map(ep => [
          chip(ep.method, `method-${(ep.method || "").toLowerCase()}`),
          `<code>${ep.path}</code>`,
          ep.description || "",
          ep.request_body || "",
          ep.response || ""
        ])
      ));
    }
  }

  // ── 5. Component Architecture ──
  if (tdd.component_architecture) {
    const ca = tdd.component_architecture;
    s(`<h2>5. Component Architecture</h2>`);
    if (ca.overview) s(`<p>${ca.overview}</p>`);
    if (ca.frontend_components?.length) {
      s(`<h3>5.1 Frontend Components</h3>`);
      s(htmlTable(
        ["Name", "Type", "Props", "Responsibility"],
        ca.frontend_components.map(c => [c.name, c.type || "", c.props || "", c.responsibility || ""])
      ));
    }
    if (ca.backend_services?.length) {
      s(`<h3>5.2 Backend Services</h3>`);
      s(htmlTable(
        ["Name", "Responsibility", "Methods"],
        ca.backend_services.map(sv => [
          sv.name,
          sv.responsibility || "",
          (sv.methods || []).map(m => chip(m)).join(" ")
        ])
      ));
    }
  }

  // ── 6. Non-Functional Requirements ──
  if (tdd.non_functional_requirements) {
    s(`<h2>6. Non-Functional Requirements</h2>`);
    const nfr = tdd.non_functional_requirements;
    s(htmlTable(
      ["Category", "Requirement"],
      Object.entries(nfr).map(([k, v]) => [
        `<strong>${k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</strong>`,
        v || ""
      ])
    ));
  }

  // ── 7. Deployment Architecture ──
  if (tdd.deployment_architecture) {
    const da = tdd.deployment_architecture;
    s(`<h2>7. Deployment Architecture</h2>`);
    if (da.overview)        s(`<p>${da.overview}</p>`);
    if (da.infrastructure)  s(`<p><strong>Infrastructure:</strong> ${da.infrastructure}</p>`);
    if (da.ci_cd)           s(`<p><strong>CI/CD:</strong> ${da.ci_cd}</p>`);
    if (da.monitoring)      s(`<p><strong>Monitoring:</strong> ${da.monitoring}</p>`);
    if (da.environments?.length) {
      s(`<h3>7.1 Environments</h3><ul>${da.environments.map(e => `<li>${e}</li>`).join("")}</ul>`);
    }

if (da.mermaid_diagram) {
      s(`<h3>7.2 Deployment Diagram</h3>`);
      if (diagrams.deployment) {
        s(`<div class="diagram-container">${diagrams.deployment}</div>`);
      } else {
        s(`<div class="diagram-error">⚠ Deployment diagram could not be rendered.<br/><pre>${da.mermaid_diagram}</pre></div>`);
      }
    }
  }

  // ── 8. Traceability Matrix ──
  if (tdd.traceability_matrix?.length) {
    s(`<h2>8. Traceability Matrix</h2>`);
    s(htmlTable(
      ["FDD Requirement", "APIs", "DB Tables", "Components", "Coverage"],
      tdd.traceability_matrix.map(row => [
        (row.fdd_requirement || "").slice(0, 120),
        (row.tdd_apis || []).map(a => chip(a, "method-post")).join(" "),
        (row.tdd_tables || []).map(t => chip(t)).join(" "),
        (row.tdd_components || []).map(c => chip(c)).join(" "),
        chip(row.coverage, row.coverage === "full" ? "coverage-full" : "coverage-partial")
      ])
    ));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
${HTML_STYLE}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
${sections.join("\n")}
<script>
  mermaid.initialize(${MERMAID_INIT});

  document.addEventListener('DOMContentLoaded', async () => {
    const diagrams = document.querySelectorAll('.mermaid');
    for (const el of diagrams) {
      try {
        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
        const { svg } = await mermaid.render(id, el.textContent.trim());
        el.innerHTML = svg;
      } catch (err) {
el.innerHTML =
  '<div style="padding:16px;background:#FBEAE6;border:1px solid #A13327;color:#A13327;font-size:12px;">' +
  '<strong>Diagram could not be rendered</strong><br/>' +
  '<pre style="margin-top:8px;white-space:pre-wrap;font-size:11px;">' +
  el.textContent.trim() +
  '</pre></div>';
      }
    }
  });
</script>
</body>
</html>`;
}

/**
 * Still exported for the /html route (pass markdown for backward compat)
 * But for PDF we now use tddToHtml directly with the JSON.
 */
const MarkdownIt = require("markdown-it");
const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

function markdownToHtml(markdown, title = "Technical Design Document") {
  const body = md.render(markdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  ${HTML_STYLE}
</head>
<body>${body}</body>
</html>`;
}

async function generatePdf(markdown, title = "Technical Design Document") {
  const html = markdownToHtml(markdown, title);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });
    // Wait for mermaid to finish rendering all diagrams
await page.waitForFunction(
      () => {
        const all = document.querySelectorAll('.mermaid');
        if (all.length === 0) return true;
        // Each mermaid div will have either an svg or the error fallback div inside
        const processed = document.querySelectorAll('.mermaid svg, .mermaid div');
        return processed.length >= all.length;
      },
      { timeout: 25000 }
    ).catch(() => console.warn("[PDF] Mermaid render timed out — continuing anyway"));
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF directly from TDD JSON — uses proper HTML tables, not markdown.
 */
async function generatePdfFromTdd(tdd, title, docName) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    // Step 1: Pre-render all mermaid diagrams to SVG strings
    const diagrams = {};
    const diagramSources = {};
    
    if (tdd.system_architecture?.mermaid_diagram) {
      diagramSources.architecture = tdd.system_architecture.mermaid_diagram;
    }
    if (tdd.deployment_architecture?.mermaid_diagram) {
      diagramSources.deployment = tdd.deployment_architecture.mermaid_diagram;
    }

    for (const [key, mermaidCode] of Object.entries(diagramSources)) {
      try {
        const page = await browser.newPage();
        const renderHtml = `<!DOCTYPE html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head><body>
<div id="diagram" class="mermaid">${mermaidCode}</div>
<script>
  mermaid.initialize(${MERMAID_INIT});
  mermaid.render('svg-${key}', document.getElementById('diagram').textContent.trim())
    .then(({svg}) => { document.getElementById('diagram').innerHTML = svg; document.title = 'done'; })
    .catch(err => { document.getElementById('diagram').innerHTML = '<span id="error">' + err.message + '</span>'; document.title = 'done'; });
</script>
</body></html>`;
        
        await page.setContent(renderHtml, { waitUntil: "networkidle0", timeout: 30000 });
        await page.waitForFunction(() => document.title === 'done', { timeout: 15000 });
        
        const svg = await page.$eval('#diagram', el => el.innerHTML);
        if (svg && svg.includes('<svg')) {
          diagrams[key] = svg;
        } else {
          diagrams[key] = null;
          console.warn(`[PDF] Mermaid render failed for ${key}`);
        }
        await page.close();
      } catch (err) {
        console.warn(`[PDF] Could not render ${key} diagram:`, err.message);
        diagrams[key] = null;
      }
    }

    // Step 2: Build HTML with pre-rendered SVGs (no mermaid JS needed at PDF time)
    const html = tddToHtml(tdd, title, docName, diagrams);

    // Step 3: Render final PDF
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });
    return Buffer.from(pdfBuffer);

  } finally {
    await browser.close();
  }
}

module.exports = { markdownToHtml, generatePdf, generatePdfFromTdd, tddToHtml };