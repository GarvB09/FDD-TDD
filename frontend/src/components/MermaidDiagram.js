import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import BlueprintGrid from "./blueprint/BlueprintGrid";
import ZoomControl from "./blueprint/ZoomControl";
import { BLUEPRINT } from "../theme";

/**
 * Fix a specific, recurring LLM-generated flowchart bug: a `subgraph <ID>`
 * block containing a node declared with that exact same ID (e.g. a "Queue"
 * cluster containing a node also called "Queue", representing the queue
 * itself). Mermaid's layout engine can't tell the group and the node apart
 * and fails with "Setting X as parent of X would create a cycle".
 *
 * Fix: rename only the inner node's occurrences (within that subgraph's own
 * body), leaving the `subgraph <ID>` line itself untouched so any edges
 * elsewhere that reference the cluster by that ID still resolve correctly.
 */
/**
 * Replace whole-word occurrences of `idRegex` in `line`, but only in the
 * parts of the line that are NOT inside a node's [ ], ( ), or { } label --
 * a naive replace-everywhere would also rename plain text that happens to
 * match inside a label (e.g. "Queue" the id vs. "Message Queue" the label).
 */
function renameIdOutsideLabels(line, idRegex, newId) {
  const openers = "[({";
  const closers = "])}";
  let result = "";
  let i = 0;
  while (i < line.length) {
    const openIdx = openers.indexOf(line[i]);
    if (openIdx !== -1) {
      const closer = closers[openIdx];
      const end = line.indexOf(closer, i + 1);
      if (end === -1) {
        result += line.slice(i);
        i = line.length;
      } else {
        result += line.slice(i, end + 1); // label content, left untouched
        i = end + 1;
      }
    } else {
      let nextOpen = line.length;
      for (const o of openers) {
        const idx = line.indexOf(o, i);
        if (idx !== -1 && idx < nextOpen) nextOpen = idx;
      }
      result += line.slice(i, nextOpen).replace(idRegex, newId);
      i = nextOpen;
    }
  }
  return result;
}

function fixSubgraphNodeIdCollision(lines) {
  const subgraphRe = /^\s*subgraph\s+([A-Za-z0-9_]+)/;
  const endRe = /^\s*end\s*$/;

  const stack = [];
  const blocks = [];
  lines.forEach((line, i) => {
    const m = line.match(subgraphRe);
    if (m) {
      stack.push({ id: m[1], start: i });
    } else if (endRe.test(line) && stack.length > 0) {
      const top = stack.pop();
      blocks.push({ id: top.id, start: top.start, end: i });
    }
  });

  let changed = false;
  blocks.forEach(({ id, start, end }) => {
    const idEsc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shapeRe = new RegExp(`\\b${idEsc}\\s*(\\[|\\(\\(|\\(|\\{|>)`);
    const hasCollidingNode = lines.slice(start + 1, end).some((l) => shapeRe.test(l));
    if (!hasCollidingNode) return;

    changed = true;
    const newId = `${id}_node`;
    const wordRe = new RegExp(`\\b${idEsc}\\b`, "g");
    for (let i = start + 1; i < end; i++) {
      lines[i] = renameIdOutsideLabels(lines[i], wordRe, newId);
    }
  });

  return { lines, changed };
}

function sanitizeMermaid(code) {
  if (!code) return "";

  let cleaned = code.trim();

  // Remove markdown fences
  cleaned = cleaned.replace(/^```mermaid\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  // Fix |label|> and |label|< — most common Groq error
  cleaned = cleaned.replace(/\|([^|]*)\|>/g, "|$1|");
  cleaned = cleaned.replace(/\|([^|]*)\|</g, "|$1|");

  // Fix -->| label |> pattern
  cleaned = cleaned.replace(/-->\|([^|]*)\|>/g, "-->|$1|");

  // Remove > or < immediately after closing pipe
  cleaned = cleaned.replace(/\|([^|\n]*)\|([><])/g, "|$1|");

  // Fix special arrow characters
  cleaned = cleaned.replace(/→/g, "-->").replace(/←/g, "<--");

  // Fix quoted labels
  cleaned = cleaned.replace(/\["([^"]+)"\]/g, "[$1]");

  // Fix graph TD → flowchart TD
  cleaned = cleaned.replace(/^graph\s+TD/im, "flowchart TD");
  cleaned = cleaned.replace(/^graph\s+LR/im, "flowchart LR");
  cleaned = cleaned.replace(/^graph\s+TB/im, "flowchart TB");

  // Split into lines and fix each line individually
  let lines = cleaned.split("\n")
    .map(line => {
      line = line.replace(/\|([^|]*)\|>/g, "|$1|");
      line = line.replace(/={2,}>/g, "-->");
      return line.trimEnd();
    })
    .filter(line => line.trim() !== "");

  // Fix subgraph/node ID collisions (see fixSubgraphNodeIdCollision) before
  // rejoining -- needs the line array, not a single string.
  ({ lines } = fixSubgraphNodeIdCollision(lines));

  cleaned = lines.join("\n");

  const diagramTypes = ["flowchart", "graph", "sequenceDiagram", "erDiagram"];
  const hasType = diagramTypes.some(t => cleaned.toLowerCase().startsWith(t.toLowerCase()));
  if (!hasType) cleaned = "flowchart TD\n" + cleaned;

  return cleaned;
}

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

export default function MermaidDiagram({ code, title }) {
  const iframeRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  useEffect(() => {
    if (!code || !iframeRef.current) return;

    const cleanCode = sanitizeMermaid(code);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: transparent;
      padding: 16px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }
    #container { width: 100%; }
    .mermaid { width: 100%; }
    svg { max-width: 100% !important; height: auto !important; }
    #error-box {
      display: none;
      background: #FBEAE6;
      border: 1px solid #A13327;
      padding: 12px;
      color: #A13327;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="container">
    <div class="mermaid">${cleanCode}</div>
    <div id="error-box"></div>
  </div>

  <script>
    mermaid.initialize({
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
        background: 'transparent',
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
        labelBoxBkgColor: '#EAF1F5',
        labelBoxBorderColor: '#2C5F7C',
        attributeBackgroundColorEven: '#FFFFFF',
        attributeBackgroundColorOdd: '#F7F5EF',
      },
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'linear' },
      er: { useMaxWidth: true, diagramPadding: 20 },
      sequence: { useMaxWidth: true, diagramMarginX: 20 }
    });

    async function renderDiagram() {
      try {
        await mermaid.run({ querySelector: '.mermaid' });
        setTimeout(function() {
          const height = document.body.scrollHeight + 32;
          window.parent.postMessage({ type: 'resize', height: height }, '*');
        }, 300);
      } catch(err) {
        document.querySelector('.mermaid').style.display = 'none';
        const errBox = document.getElementById('error-box');
        errBox.style.display = 'block';
        errBox.textContent = 'Render error: ' + err.message;
        window.parent.postMessage({ type: 'resize', height: 300 }, '*');
      }
    }

    renderDiagram();
  </script>
</body>
</html>`;

    iframeRef.current.srcdoc = html;
  }, [code]);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "resize" && iframeRef.current) {
        iframeRef.current.style.height = (e.data.height + 20) + "px";
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const onMouseDown = (e) => {
    if (zoom <= 1) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
  };
  const onMouseUp = () => { dragState.current = null; };

  return (
    <Box>
      {title && (
        <Typography variant="subtitle1" sx={{ mb: 1, color: BLUEPRINT.steel }}>
          {title}
        </Typography>
      )}
      <BlueprintGrid
        sx={{
          border: `1px solid ${BLUEPRINT.paperBorderStrong}`,
          overflow: "hidden",
          position: "relative",
          cursor: zoom > 1 ? "grab" : "default",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Box
          sx={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center top",
            transition: dragState.current ? "none" : "transform 0.15s ease",
          }}
        >
          <iframe
            ref={iframeRef}
            style={{
              width: "100%",
              height: "450px",
              border: "none",
              display: "block",
              pointerEvents: zoom > 1 ? "none" : "auto",
              transition: "height 0.3s ease",
            }}
            title={title || "diagram"}
            sandbox="allow-scripts"
          />
        </Box>
        <ZoomControl
          onZoomIn={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          onZoomOut={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          onReset={resetView}
        />
      </BlueprintGrid>
    </Box>
  );
}
