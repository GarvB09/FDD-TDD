import React, { useRef, useState } from "react";
import {
  Box, Paper, Typography, Button, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails, Alert, Select, MenuItem,
} from "@mui/material";
import { ChevronDown, Download, RotateCw, Pencil, Save, X } from "lucide-react";
import axios from "axios";
import OpenAPIViewer from "./OpenAPIViewer";
import DiagramViewer from "./DiagramViewer";
import TestingDashboard from "./TestingDashboard";
import MermaidDiagram from "./MermaidDiagram";
import Mono from "./blueprint/Mono";
import EditableField from "./blueprint/EditableField";
import ScoreScale from "./blueprint/ScoreScale";
import { setAtPath } from "./blueprint/editUtils";
import { TraceSource, TraceTarget, TraceOverlay } from "./blueprint/Traceability";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const TAB_LABELS = [
  "Introduction", "Architecture", "Data Model", "API Spec", "Components",
  "NFRs", "Deployment", "Traceability", "OpenAPI Spec", "Diagrams", "Testing",
];

const METHOD_COLOR = {
  GET: BLUEPRINT.success,
  POST: BLUEPRINT.steel,
  PUT: BLUEPRINT.accent,
  PATCH: BLUEPRINT.steelDark,
  DELETE: BLUEPRINT.error,
};

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2.5 }}>{children}</Box> : null;
}

function KVRow({ label, value, editMode, onChange, multiline, mono }) {
  if (!editMode && !value) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle1">{label}</Typography>
      {editMode ? (
        <EditableField editMode value={value} onChange={onChange} multiline={multiline} mono={mono} sx={{ mt: 0.5 }} />
      ) : (
        <Typography variant="body2" sx={{ mt: 0.25, fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined }}>{value}</Typography>
      )}
    </Box>
  );
}

function SectionCard({ title, children }) {
  return (
    <Paper sx={{ p: 2.5, mb: 2 }}>
      <Typography variant="h4" sx={{ mb: 1.5, color: BLUEPRINT.steel }}>{title}</Typography>
      <Box sx={{ borderTop: `1px solid ${BLUEPRINT.paperBorder}`, pt: 1.5 }}>
        {children}
      </Box>
    </Paper>
  );
}

/** Editable list of plain strings (assumptions, constraints, environments...). */
function EditableList({ items, editMode, onChangeItem, bulletColor }) {
  const list = items || [];
  if (!editMode && list.length === 0) return null;
  return (
    <Box sx={{ mt: 1 }}>
      {list.map((item, i) => (
        editMode ? (
          <EditableField key={i} editMode value={item} onChange={(v) => onChangeItem(i, v)} sx={{ mb: 0.75 }} />
        ) : (
          <Typography key={i} variant="body2">&middot; {item}</Typography>
        )
      ))}
    </Box>
  );
}

function RailStat({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75, borderBottom: `1px solid ${BLUEPRINT.paperBorder}` }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>{label}</Typography>
      <Mono variant="caption" sx={{ fontWeight: 600 }}>{value}</Mono>
    </Box>
  );
}

/** Right-hand rail: traceability/confidence info contextual to whichever tab is active. */
function RightRail({ tab, tdd, completeness, warnings, coverageCounts }) {
  const content = (() => {
    switch (tab) {
      case 0:
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Generation Confidence</Typography>
            {completeness !== null ? (
              <ScoreScale
                value={completeness}
                thresholds={[{ value: 40, label: "≥40" }, { value: 70, label: "≥70" }]}
                passColor={completeness >= 70 ? BLUEPRINT.success : completeness >= 40 ? BLUEPRINT.accent : BLUEPRINT.error}
              />
            ) : (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>No score available.</Typography>
            )}
            {warnings.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 0.75 }}>Warnings</Typography>
                {warnings.map((w, i) => (
                  <Typography key={i} variant="caption" sx={{ display: "block", color: BLUEPRINT.accent, mb: 0.5 }}>
                    &middot; {w}
                  </Typography>
                ))}
              </Box>
            )}
          </>
        );
      case 1:
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Architecture Summary</Typography>
            <RailStat label="Components" value={tdd.system_architecture?.components?.length || 0} />
            <RailStat label="Pattern" value={tdd.system_architecture?.architectural_pattern ? "SET" : "—"} />
          </>
        );
      case 2: {
        const tables = tdd.data_model?.tables || [];
        const totalCols = tables.reduce((a, t) => a + (t.columns?.length || 0), 0);
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Data Model Summary</Typography>
            <RailStat label="Tables" value={tables.length} />
            <RailStat label="Total Columns" value={totalCols} />
          </>
        );
      }
      case 3: {
        const endpoints = tdd.api_design?.endpoints || [];
        const traced = endpoints.filter((e) => e.fdd_requirement);
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Requirement Sources</Typography>
            <RailStat label="Endpoints" value={endpoints.length} />
            <RailStat label="Traced to FDD" value={`${traced.length}/${endpoints.length}`} />
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5, mb: 1 }}>
              Hover an endpoint's FDD tag to trace its source requirement.
            </Typography>
            {traced.map((ep, i) => (
              <TraceTarget key={i} id={`api-${endpoints.indexOf(ep)}`} sx={{ mb: 1, p: 1, border: `1px solid ${BLUEPRINT.paperBorder}` }}>
                <Mono variant="caption" sx={{ display: "block", fontWeight: 600 }}>{ep.method} {ep.path}</Mono>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{(ep.fdd_requirement || "").slice(0, 90)}</Typography>
              </TraceTarget>
            ))}
          </>
        );
      }
      case 4: {
        const fe = tdd.component_architecture?.frontend_components?.length || 0;
        const be = tdd.component_architecture?.backend_services?.length || 0;
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Component Summary</Typography>
            <RailStat label="Frontend Components" value={fe} />
            <RailStat label="Backend Services" value={be} />
          </>
        );
      }
      case 5:
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>NFR Summary</Typography>
            <RailStat label="Categories" value={Object.keys(tdd.non_functional_requirements || {}).length} />
          </>
        );
      case 6:
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Deployment Summary</Typography>
            <RailStat label="Environments" value={tdd.deployment_architecture?.environments?.length || 0} />
          </>
        );
      case 7:
        return (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Coverage Breakdown</Typography>
            <RailStat label="Full" value={coverageCounts.full} />
            <RailStat label="Partial" value={coverageCounts.partial} />
            <RailStat label="None" value={coverageCounts.none} />
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
              Hover a requirement row to trace which APIs, tables, and components it produced.
            </Typography>
          </>
        );
      default:
        return (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            No contextual data for this section.
          </Typography>
        );
    }
  })();

  return (
    <Box sx={{ width: 240, flexShrink: 0, pl: 2.5 }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5, color: "text.secondary", fontSize: "0.66rem" }}>
        {TAB_LABELS[tab]} &middot; Reference
      </Typography>
      {content}
    </Box>
  );
}

export default function TDDViewer({ tddData, documentId, onReset }) {
  const [tab, setTab] = useState(0);
  const containerRef = useRef(null);

  // ── Edit mode state ──────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [draftTdd, setDraftTdd] = useState(null);
  const [savedOverride, setSavedOverride] = useState(null); // { tdd, completenessScore, validationWarnings }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const baseTdd = savedOverride?.tdd || tddData?.tdd || {};
  const tdd = editMode ? draftTdd : baseTdd;
  const completeness = savedOverride ? savedOverride.completenessScore : (tddData?.completenessScore ?? null);
  const warnings = savedOverride ? savedOverride.validationWarnings : (tddData?.validationWarnings || []);

  const update = (path, value) => setDraftTdd((prev) => setAtPath(prev, path, value));

  const handleStartEdit = () => {
    setDraftTdd(JSON.parse(JSON.stringify(baseTdd)));
    setSaveError("");
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setDraftTdd(null);
    setEditMode(false);
    setSaveError("");
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await axios.put(`${API_BASE}/tdd/${documentId}`, { tdd: draftTdd });
      setSavedOverride({
        tdd: res.data.tdd,
        completenessScore: res.data.completenessScore,
        validationWarnings: res.data.validationWarnings,
      });
      setEditMode(false);
      setDraftTdd(null);
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const traceabilityMatrix = tdd.traceability_matrix || [];
  const coverageCounts = traceabilityMatrix.reduce(
    (acc, r) => {
      const c = (r.coverage || "").toLowerCase();
      if (c === "full") acc.full += 1;
      else if (c === "partial") acc.partial += 1;
      else acc.none += 1;
      return acc;
    },
    { full: 0, partial: 0, none: 0 }
  );

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify({ ...tddData, tdd: baseTdd }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${documentId}_tdd.json`; a.click();
  };

  const handleDownloadMarkdown = () => {
    window.open(`${API_BASE.replace("/api", "")}/api/tdd/${documentId}/markdown`, "_blank");
  };

  const handleOpenHTML = () => {
    window.open(`${API_BASE.replace("/api", "")}/api/tdd/${documentId}/html`, "_blank");
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`${API_BASE.replace("/api", "")}/api/tdd/${documentId}/pdf`);
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentId}_tdd.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("PDF generation failed. Check the server logs.");
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: completeness !== null ? 2 : 0 }}>
          <Box>
            <Typography variant="h3">Technical Design Document</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              Document ID <Mono component="span">{documentId}</Mono>
              {editMode && (
                <Mono component="span" sx={{ ml: 1.5, color: BLUEPRINT.accent, fontWeight: 600 }}>EDITING</Mono>
              )}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button size="small" variant="outlined" startIcon={<Download size={14} strokeWidth={1.5} />} onClick={handleDownloadJSON} disabled={editMode}>JSON</Button>
            <Button size="small" variant="outlined" startIcon={<Download size={14} strokeWidth={1.5} />} onClick={handleDownloadMarkdown} disabled={editMode}>Markdown</Button>
            <Button size="small" variant="outlined" startIcon={<Download size={14} strokeWidth={1.5} />} onClick={handleOpenHTML} disabled={editMode}>HTML</Button>
            <Button size="small" variant="outlined" startIcon={<Download size={14} strokeWidth={1.5} />} onClick={handleDownloadPDF} disabled={editMode}>PDF</Button>
            {editMode ? (
              <>
                <Button size="small" variant="outlined" color="error" startIcon={<X size={14} strokeWidth={1.5} />} onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" color="success" startIcon={<Save size={14} strokeWidth={1.5} />} onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button size="small" variant="outlined" startIcon={<Pencil size={14} strokeWidth={1.5} />} onClick={handleStartEdit}>
                Edit
              </Button>
            )}
            <Button size="small" variant="outlined" startIcon={<RotateCw size={14} strokeWidth={1.5} />} onClick={onReset} disabled={editMode}>New FDD</Button>
          </Box>
        </Box>
        {completeness !== null && (
          <ScoreScale
            label="TDD Completeness"
            value={completeness}
            thresholds={[{ value: 40, label: "≥40" }, { value: 70, label: "≥70" }]}
            passColor={completeness >= 70 ? BLUEPRINT.success : completeness >= 40 ? BLUEPRINT.accent : BLUEPRINT.error}
          />
        )}
      </Paper>

      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      {tdd.parse_error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          AI response had formatting issues. Showing partial output. Raw: {tdd.raw_response?.slice(0, 200)}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        {TAB_LABELS.map((label) => <Tab key={label} label={label} />)}
      </Tabs>

      {/* Content + persistent right rail */}
      <Box ref={containerRef} sx={{ position: "relative", display: "flex", mt: 0.5 }}>
        <TraceOverlay containerRef={containerRef} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Tab 0: Introduction */}
          <TabPanel value={tab} index={0}>
            {tdd.introduction ? (
              <SectionCard title="Introduction">
                <KVRow label="Purpose" value={tdd.introduction.purpose} editMode={editMode} multiline onChange={(v) => update(["introduction", "purpose"], v)} />
                <KVRow label="Scope" value={tdd.introduction.scope} editMode={editMode} multiline onChange={(v) => update(["introduction", "scope"], v)} />

                {(tdd.introduction.assumptions?.length > 0 || editMode) && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle1">Assumptions</Typography>
                    <EditableList
                      items={tdd.introduction.assumptions}
                      editMode={editMode}
                      onChangeItem={(i, v) => update(["introduction", "assumptions", i], v)}
                    />
                  </Box>
                )}
                {(tdd.introduction.constraints?.length > 0 || editMode) && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle1">Constraints</Typography>
                    <EditableList
                      items={tdd.introduction.constraints}
                      editMode={editMode}
                      onChangeItem={(i, v) => update(["introduction", "constraints", i], v)}
                    />
                  </Box>
                )}
                {(tdd.introduction.tech_stack && Object.keys(tdd.introduction.tech_stack).length > 0) && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 0.75 }}>Tech Stack</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {Object.entries(tdd.introduction.tech_stack).map(([k, v]) => (
                        <Box key={k} sx={{ px: 1, py: 0.5, border: `1px solid ${BLUEPRINT.paperBorder}`, minWidth: editMode ? 170 : "auto" }}>
                          <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", mr: 0.5, display: editMode ? "block" : "inline" }}>{k}</Typography>
                          <EditableField editMode={editMode} value={v} mono onChange={(val) => update(["introduction", "tech_stack", k], val)} sx={{ fontWeight: 600 }} />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </SectionCard>
            ) : <Typography sx={{ color: "text.secondary" }}>No introduction data.</Typography>}
          </TabPanel>

          {/* Tab 1: System Architecture */}
          <TabPanel value={tab} index={1}>
            {tdd.system_architecture ? (
              <>
                <SectionCard title="System Architecture">
                  <KVRow label="Pattern" value={tdd.system_architecture.architectural_pattern} editMode={editMode} onChange={(v) => update(["system_architecture", "architectural_pattern"], v)} />
                  <KVRow label="Overview" value={tdd.system_architecture.overview} editMode={editMode} multiline onChange={(v) => update(["system_architecture", "overview"], v)} />
                  <KVRow label="Communication" value={tdd.system_architecture.communication} editMode={editMode} multiline onChange={(v) => update(["system_architecture", "communication"], v)} />
                </SectionCard>

                {(tdd.system_architecture.components?.length > 0) && (
                  <SectionCard title="Components">
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Technology</TableCell>
                            <TableCell>Responsibility</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tdd.system_architecture.components.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell sx={{ minWidth: editMode ? 130 : "auto" }}>
                                <EditableField editMode={editMode} value={c.name} onChange={(v) => update(["system_architecture", "components", i, "name"], v)} sx={{ fontWeight: 600 }} />
                              </TableCell>
                              <TableCell sx={{ minWidth: editMode ? 110 : "auto" }}>
                                <EditableField editMode={editMode} value={c.type} onChange={(v) => update(["system_architecture", "components", i, "type"], v)} />
                              </TableCell>
                              <TableCell sx={{ minWidth: editMode ? 130 : "auto" }}>
                                <EditableField editMode={editMode} value={c.technology} mono onChange={(v) => update(["system_architecture", "components", i, "technology"], v)} />
                              </TableCell>
                              <TableCell sx={{ minWidth: editMode ? 220 : "auto" }}>
                                <EditableField editMode={editMode} value={c.responsibility} multiline onChange={(v) => update(["system_architecture", "components", i, "responsibility"], v)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </SectionCard>
                )}

                {(tdd.system_architecture.mermaid_diagram || editMode) && (
                  <SectionCard title="Architecture Diagram">
                    {editMode ? (
                      <EditableField
                        editMode multiline mono minRows={8}
                        value={tdd.system_architecture.mermaid_diagram}
                        onChange={(v) => update(["system_architecture", "mermaid_diagram"], v)}
                        placeholder="flowchart TD..."
                      />
                    ) : (
                      <MermaidDiagram code={tdd.system_architecture.mermaid_diagram} title="System Architecture" />
                    )}
                  </SectionCard>
                )}
              </>
            ) : <Typography sx={{ color: "text.secondary" }}>No architecture data.</Typography>}
          </TabPanel>

          {/* Tab 2: Data Model */}
          <TabPanel value={tab} index={2}>
            {tdd.data_model ? (
              <>
                {tdd.data_model.tables?.map((table, i) => (
                  <Accordion key={i} sx={{ mb: 1 }} defaultExpanded={editMode}>
                    <AccordionSummary expandIcon={<ChevronDown size={16} strokeWidth={1.5} />}>
                      <Typography sx={{ fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{table.name}</Typography>
                      <Mono variant="caption" sx={{ color: "text.secondary", ml: 2 }}>{table.columns?.length || 0} columns</Mono>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ mb: 1 }}>
                        <EditableField
                          editMode={editMode} multiline
                          value={table.purpose}
                          onChange={(v) => update(["data_model", "tables", i, "purpose"], v)}
                          placeholder="What this table stores..."
                        />
                      </Box>
                      {table.columns?.length > 0 && (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Column</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Constraints</TableCell>
                                <TableCell>Description</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {table.columns.map((col, j) => (
                                <TableRow key={j}>
                                  <TableCell sx={{ minWidth: editMode ? 120 : "auto" }}>
                                    <EditableField editMode={editMode} mono value={col.name} onChange={(v) => update(["data_model", "tables", i, "columns", j, "name"], v)} sx={{ fontWeight: 600 }} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: editMode ? 110 : "auto" }}>
                                    <EditableField editMode={editMode} mono value={col.type} onChange={(v) => update(["data_model", "tables", i, "columns", j, "type"], v)} sx={{ color: "text.secondary" }} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: editMode ? 150 : "auto" }}>
                                    <EditableField editMode={editMode} value={col.constraints} onChange={(v) => update(["data_model", "tables", i, "columns", j, "constraints"], v)} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: editMode ? 200 : "auto" }}>
                                    <EditableField editMode={editMode} multiline value={col.description} onChange={(v) => update(["data_model", "tables", i, "columns", j, "description"], v)} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                      {(table.relationships?.length > 0 || editMode) && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Relationships</Typography>
                          {editMode ? (
                            <EditableList
                              items={table.relationships}
                              editMode={editMode}
                              onChangeItem={(j, v) => update(["data_model", "tables", i, "relationships", j], v)}
                            />
                          ) : (
                            table.relationships.map((r, j) => (
                              <Mono key={j} variant="caption" sx={{ ml: j > 0 ? 0.5 : 0, px: 0.75, border: `1px solid ${BLUEPRINT.paperBorder}` }}>{r}</Mono>
                            ))
                          )}
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </>
            ) : <Typography sx={{ color: "text.secondary" }}>No data model data.</Typography>}
          </TabPanel>

          {/* Tab 3: API Design */}
          <TabPanel value={tab} index={3}>
            {tdd.api_design ? (
              <>
                <SectionCard title="API Design">
                  <KVRow label="Base URL" value={tdd.api_design.base_url} editMode={editMode} mono onChange={(v) => update(["api_design", "base_url"], v)} />
                  <KVRow label="Authentication" value={tdd.api_design.authentication} editMode={editMode} onChange={(v) => update(["api_design", "authentication"], v)} />
                  <KVRow label="Overview" value={tdd.api_design.overview} editMode={editMode} multiline onChange={(v) => update(["api_design", "overview"], v)} />
                </SectionCard>
                {tdd.api_design.endpoints?.map((ep, i) => (
                  <Paper key={i} sx={{ p: 2, mb: 1.5, borderLeft: `3px solid ${METHOD_COLOR[ep.method] || BLUEPRINT.steel}` }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                      {editMode ? (
                        <Select
                          size="small"
                          value={HTTP_METHODS.includes(ep.method) ? ep.method : "GET"}
                          onChange={(e) => update(["api_design", "endpoints", i, "method"], e.target.value)}
                          sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", fontWeight: 700 }}
                        >
                          {HTTP_METHODS.map((m) => <MenuItem key={m} value={m} sx={{ fontFamily: "'IBM Plex Mono', monospace" }}>{m}</MenuItem>)}
                        </Select>
                      ) : (
                        <Mono variant="caption" sx={{
                          fontWeight: 700, px: 0.75, py: 0.25, border: `1px solid ${METHOD_COLOR[ep.method] || BLUEPRINT.steel}`,
                          color: METHOD_COLOR[ep.method] || BLUEPRINT.steel,
                        }}>
                          {ep.method}
                        </Mono>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <EditableField editMode={editMode} mono value={ep.path} onChange={(v) => update(["api_design", "endpoints", i, "path"], v)} sx={{ fontWeight: 600 }} />
                      </Box>
                    </Box>
                    <EditableField editMode={editMode} multiline value={ep.description} onChange={(v) => update(["api_design", "endpoints", i, "description"], v)} />
                    {(ep.request_body || editMode) && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>Request: </Typography>
                        <EditableField editMode={editMode} value={ep.request_body} variant="caption" onChange={(v) => update(["api_design", "endpoints", i, "request_body"], v)} />
                      </Box>
                    )}
                    {(ep.response || editMode) && (
                      <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>Response: </Typography>
                        <EditableField editMode={editMode} value={ep.response} variant="caption" onChange={(v) => update(["api_design", "endpoints", i, "response"], v)} />
                      </Box>
                    )}
                    {ep.fdd_requirement && (
                      <TraceSource id={`api-${i}`} sx={{ display: "inline-block", mt: 1, px: 0.75, py: 0.25, border: `1px solid ${BLUEPRINT.paperBorderStrong}` }}>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          FDD &middot; {ep.fdd_requirement.slice(0, 80)}
                        </Typography>
                      </TraceSource>
                    )}
                  </Paper>
                ))}
              </>
            ) : <Typography sx={{ color: "text.secondary" }}>No API design data.</Typography>}
          </TabPanel>

          {/* Tab 4: Components */}
          <TabPanel value={tab} index={4}>
            {tdd.component_architecture ? (
              <>
                <SectionCard title="Component Architecture">
                  <KVRow label="Overview" value={tdd.component_architecture.overview} editMode={editMode} multiline onChange={(v) => update(["component_architecture", "overview"], v)} />
                </SectionCard>
                {(tdd.component_architecture.frontend_components?.length > 0) && (
                  <SectionCard title="Frontend Components">
                    {tdd.component_architecture.frontend_components.map((c, i) => (
                      <Box key={i} sx={{ mb: 1.5, pb: 1.5, borderBottom: i < tdd.component_architecture.frontend_components.length - 1 ? `1px solid ${BLUEPRINT.paperBorder}` : "none" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <EditableField editMode={editMode} value={c.name} onChange={(v) => update(["component_architecture", "frontend_components", i, "name"], v)} sx={{ fontWeight: 600 }} />
                          <Mono component="span" variant="caption" sx={{ color: "text.secondary" }}>{c.type}</Mono>
                        </Box>
                        <EditableField editMode={editMode} multiline value={c.responsibility} variant="caption" onChange={(v) => update(["component_architecture", "frontend_components", i, "responsibility"], v)} sx={{ color: "text.secondary" }} />
                        {(c.props || editMode) && (
                          <Box>
                            <Typography variant="caption" sx={{ color: BLUEPRINT.steel }}>Props: </Typography>
                            <EditableField editMode={editMode} value={c.props} variant="caption" onChange={(v) => update(["component_architecture", "frontend_components", i, "props"], v)} sx={{ color: BLUEPRINT.steel }} />
                          </Box>
                        )}
                      </Box>
                    ))}
                  </SectionCard>
                )}
                {(tdd.component_architecture.backend_services?.length > 0) && (
                  <SectionCard title="Backend Services">
                    {tdd.component_architecture.backend_services.map((s, i) => (
                      <Box key={i} sx={{ mb: 1.5, pb: 1.5, borderBottom: i < tdd.component_architecture.backend_services.length - 1 ? `1px solid ${BLUEPRINT.paperBorder}` : "none" }}>
                        <EditableField editMode={editMode} value={s.name} onChange={(v) => update(["component_architecture", "backend_services", i, "name"], v)} sx={{ fontWeight: 600 }} />
                        <EditableField editMode={editMode} multiline value={s.responsibility} variant="caption" onChange={(v) => update(["component_architecture", "backend_services", i, "responsibility"], v)} sx={{ color: "text.secondary" }} />
                        {s.methods?.length > 0 && (
                          <Box sx={{ mt: 0.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {s.methods.map((m, j) => (
                              <Mono key={j} variant="caption" sx={{ px: 0.5, border: `1px solid ${BLUEPRINT.paperBorder}` }}>{m}</Mono>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </SectionCard>
                )}
              </>
            ) : <Typography sx={{ color: "text.secondary" }}>No component data.</Typography>}
          </TabPanel>

          {/* Tab 5: NFRs */}
          <TabPanel value={tab} index={5}>
            {tdd.non_functional_requirements ? (
              <Paper sx={{ p: 0 }}>
                {Object.entries(tdd.non_functional_requirements).map(([k, v], i, arr) => (
                  <Box key={k} sx={{
                    display: "flex", gap: 3, p: 2,
                    borderBottom: i < arr.length - 1 ? `1px solid ${BLUEPRINT.paperBorder}` : "none",
                  }}>
                    <Typography variant="subtitle1" sx={{ width: 160, flexShrink: 0 }}>{k.replace(/_/g, " ")}</Typography>
                    <Box sx={{ flex: 1 }}>
                      <EditableField editMode={editMode} multiline value={v} onChange={(val) => update(["non_functional_requirements", k], val)} />
                    </Box>
                  </Box>
                ))}
              </Paper>
            ) : <Typography sx={{ color: "text.secondary" }}>No NFR data.</Typography>}
          </TabPanel>

          {/* Tab 6: Deployment */}
          <TabPanel value={tab} index={6}>
            {tdd.deployment_architecture ? (
              <>
                <SectionCard title="Deployment Architecture">
                  <KVRow label="Overview" value={tdd.deployment_architecture.overview} editMode={editMode} multiline onChange={(v) => update(["deployment_architecture", "overview"], v)} />
                  <KVRow label="Infrastructure" value={tdd.deployment_architecture.infrastructure} editMode={editMode} multiline onChange={(v) => update(["deployment_architecture", "infrastructure"], v)} />
                  <KVRow label="CI/CD" value={tdd.deployment_architecture.ci_cd} editMode={editMode} multiline onChange={(v) => update(["deployment_architecture", "ci_cd"], v)} />
                  <KVRow label="Monitoring" value={tdd.deployment_architecture.monitoring} editMode={editMode} multiline onChange={(v) => update(["deployment_architecture", "monitoring"], v)} />
                  {(tdd.deployment_architecture.environments?.length > 0 || editMode) && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle1" sx={{ mb: 0.75 }}>Environments</Typography>
                      {editMode ? (
                        <EditableList
                          items={tdd.deployment_architecture.environments}
                          editMode={editMode}
                          onChangeItem={(i, v) => update(["deployment_architecture", "environments", i], v)}
                        />
                      ) : (
                        <Box sx={{ display: "flex", gap: 1 }}>
                          {tdd.deployment_architecture.environments.map((e, i) => (
                            <Mono key={i} variant="caption" sx={{ px: 0.75, py: 0.25, border: `1px solid ${BLUEPRINT.paperBorder}` }}>{e}</Mono>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </SectionCard>
                {(tdd.deployment_architecture.mermaid_diagram || editMode) && (
                  <SectionCard title="Deployment Diagram">
                    {editMode ? (
                      <EditableField
                        editMode multiline mono minRows={8}
                        value={tdd.deployment_architecture.mermaid_diagram}
                        onChange={(v) => update(["deployment_architecture", "mermaid_diagram"], v)}
                        placeholder="flowchart TD..."
                      />
                    ) : (
                      <MermaidDiagram code={tdd.deployment_architecture.mermaid_diagram} title="Deployment Architecture" />
                    )}
                  </SectionCard>
                )}
              </>
            ) : <Typography sx={{ color: "text.secondary" }}>No deployment data.</Typography>}
          </TabPanel>

          {/* Tab 7: Traceability Matrix */}
          <TabPanel value={tab} index={7}>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>FDD Requirement</TableCell>
                    <TableCell>APIs</TableCell>
                    <TableCell>DB Tables</TableCell>
                    <TableCell>Components</TableCell>
                    <TableCell>Coverage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {traceabilityMatrix.map((row, i) => (
                    <TableRow key={i} sx={{ verticalAlign: "top" }}>
                      <TableCell sx={{ fontSize: "0.78rem", minWidth: editMode ? 220 : "auto" }}>
                        <TraceSource id={`trace-${i}`} sx={{ p: 0.5 }}>
                          {editMode ? (
                            <EditableField
                              editMode multiline
                              value={row.fdd_requirement}
                              onChange={(v) => update(["traceability_matrix", i, "fdd_requirement"], v)}
                            />
                          ) : (
                            (row.fdd_requirement || "").slice(0, 100)
                          )}
                        </TraceSource>
                      </TableCell>
                      <TableCell sx={{ minWidth: editMode ? 160 : "auto" }}>
                        {(row.tdd_apis || []).map((api, j) => (
                          <TraceTarget key={j} id={`trace-${i}`} sx={{ mb: 0.5, display: editMode ? "block" : "inline-block" }}>
                            {editMode ? (
                              <EditableField editMode mono value={api} onChange={(v) => update(["traceability_matrix", i, "tdd_apis", j], v)} sx={{ mb: 0.5 }} />
                            ) : (
                              <Mono variant="caption" sx={{ px: 0.5, py: 0.1, border: `1px solid ${BLUEPRINT.steel}`, color: BLUEPRINT.steel, display: "block" }}>{api}</Mono>
                            )}
                          </TraceTarget>
                        ))}
                      </TableCell>
                      <TableCell sx={{ minWidth: editMode ? 140 : "auto" }}>
                        {(row.tdd_tables || []).map((t, j) => (
                          <TraceTarget key={j} id={`trace-${i}`} sx={{ mb: 0.5, display: editMode ? "block" : "inline-block" }}>
                            {editMode ? (
                              <EditableField editMode mono value={t} onChange={(v) => update(["traceability_matrix", i, "tdd_tables", j], v)} sx={{ mb: 0.5 }} />
                            ) : (
                              <Mono variant="caption" sx={{ px: 0.5, py: 0.1, border: `1px solid ${BLUEPRINT.paperBorderStrong}`, display: "block" }}>{t}</Mono>
                            )}
                          </TraceTarget>
                        ))}
                      </TableCell>
                      <TableCell sx={{ minWidth: editMode ? 140 : "auto" }}>
                        {(row.tdd_components || []).map((c, j) => (
                          <TraceTarget key={j} id={`trace-${i}`} sx={{ mb: 0.5, display: editMode ? "block" : "inline-block" }}>
                            {editMode ? (
                              <EditableField editMode mono value={c} onChange={(v) => update(["traceability_matrix", i, "tdd_components", j], v)} sx={{ mb: 0.5 }} />
                            ) : (
                              <Mono variant="caption" sx={{ px: 0.5, py: 0.1, border: `1px solid ${BLUEPRINT.paperBorderStrong}`, display: "block" }}>{c}</Mono>
                            )}
                          </TraceTarget>
                        ))}
                      </TableCell>
                      <TableCell sx={{ minWidth: editMode ? 110 : "auto" }}>
                        {editMode ? (
                          <Select
                            size="small"
                            value={["full", "partial", "none"].includes(row.coverage) ? row.coverage : "partial"}
                            onChange={(e) => update(["traceability_matrix", i, "coverage"], e.target.value)}
                            sx={{ fontSize: "0.7rem" }}
                          >
                            <MenuItem value="full">full</MenuItem>
                            <MenuItem value="partial">partial</MenuItem>
                            <MenuItem value="none">none</MenuItem>
                          </Select>
                        ) : (
                          <Typography variant="caption" sx={{
                            fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem",
                            color: row.coverage === "full" ? BLUEPRINT.success : BLUEPRINT.accent,
                          }}>
                            {row.coverage}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Tab 8: OpenAPI Spec */}
          <TabPanel value={tab} index={8}>
            <OpenAPIViewer documentId={documentId} />
          </TabPanel>

          {/* Tab 9: Diagrams */}
          <TabPanel value={tab} index={9}>
            <DiagramViewer documentId={documentId} tdd={tdd} components={{}} />
          </TabPanel>

          {/* Tab 10: Testing Dashboard */}
          <TabPanel value={tab} index={10}>
            <TestingDashboard documentId={documentId} tdd={tdd} components={{}} />
          </TabPanel>
        </Box>

        {/* Persistent right rail */}
        <Box sx={{ borderLeft: `1px solid ${BLUEPRINT.paperBorder}`, display: { xs: "none", lg: "block" } }}>
          <RightRail tab={tab} tdd={tdd} completeness={completeness} warnings={warnings} coverageCounts={coverageCounts} />
        </Box>
      </Box>
    </Box>
  );
}
