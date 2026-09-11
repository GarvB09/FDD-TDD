import React, { useState } from "react";
import { Box, Paper, Typography, Button, CircularProgress, Alert, Tab, Tabs } from "@mui/material";
import { Play } from "lucide-react";
import axios from "axios";
import EvaluationPanel from "./EvaluationPanel";
import UATForm from "./UATForm";
import Mono from "./blueprint/Mono";
import ScoreScale from "./blueprint/ScoreScale";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function MetricStat({ title, value, target, status }) {
  const pass = status?.includes("PASS");
  return (
    <Box sx={{ flex: 1, minWidth: 160, px: 2, py: 1.5, borderLeft: `1px solid ${BLUEPRINT.paperBorder}`, "&:first-of-type": { borderLeft: "none" } }}>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{title}</Typography>
      <Mono variant="h4" sx={{ fontWeight: 700, color: pass ? BLUEPRINT.success : BLUEPRINT.error, display: "block", my: 0.25 }}>
        {value}
      </Mono>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>Target {target}</Typography>
      <Typography variant="caption" sx={{
        display: "block", mt: 0.5, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.06em",
        color: pass ? BLUEPRINT.success : BLUEPRINT.error,
      }}>
        {status}
      </Typography>
    </Box>
  );
}

function ReportSection({ title, report }) {
  if (!report) return null;
  const score = report.overall_coverage ?? report.overall_score ?? report.effort_reduction_percent;
  const status = report.overall_status || "";
  const pass = status.includes("PASS");

  return (
    <Paper sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="h4">{title}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", color: pass ? BLUEPRINT.success : BLUEPRINT.error }}>
          {status}
        </Typography>
      </Box>
      <ScoreScale
        value={score}
        thresholds={[{ value: parseInt(report.target, 10) || 80, label: report.target ? `≥${report.target}`.replace("%", "") : "≥80" }]}
        passColor={score >= 80 ? BLUEPRINT.success : score >= 60 ? BLUEPRINT.accent : BLUEPRINT.error}
      />

      {report.missing_components?.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: BLUEPRINT.error, fontWeight: 600 }}>
            Missing: {report.missing_components.slice(0, 3).join(", ")}
            {report.missing_components.length > 3 && ` +${report.missing_components.length - 3} more`}
          </Typography>
        </Box>
      )}

      {report.comparison && (
        <Box sx={{ mt: 1.5, p: 1, border: `1px solid ${BLUEPRINT.paperBorder}`, backgroundColor: BLUEPRINT.bg }}>
          <Typography variant="caption">
            Manual: <Mono component="span" variant="caption">{report.comparison.manual}</Mono> &rarr; Automated:{" "}
            <Mono component="span" variant="caption">{report.comparison.automated}</Mono> ({report.comparison.speedup})
          </Typography>
        </Box>
      )}

      {report.total_requirements && (
        <Box sx={{ mt: 1.5, display: "flex", gap: 2 }}>
          <Typography variant="caption" sx={{ color: BLUEPRINT.success }}>Full: <Mono component="span" variant="caption">{report.fully_covered}</Mono></Typography>
          <Typography variant="caption" sx={{ color: BLUEPRINT.accent }}>Partial: <Mono component="span" variant="caption">{report.partially_covered}</Mono></Typography>
          <Typography variant="caption" sx={{ color: BLUEPRINT.error }}>None: <Mono component="span" variant="caption">{report.not_covered}</Mono></Typography>
        </Box>
      )}
    </Paper>
  );
}

export default function TestingDashboard({ documentId, tdd, components }) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState({ completeness: null, traceability: null, performance: null });

  const runAllTests = async () => {
    setLoading(true);
    setError("");
    try {
      const [compRes, tracRes, perfRes] = await Promise.all([
        axios.post(`${API_BASE}/reports/completeness/${documentId}`, { tdd }),
        axios.post(`${API_BASE}/reports/traceability/${documentId}`, { tdd, components }),
        axios.get(`${API_BASE}/reports/performance/${documentId}`),
      ]);
      setReports({
        completeness: compRes.data.report,
        traceability: tracRes.data.report,
        performance: perfRes.data.report,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to run tests. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const allPassed = reports.completeness && reports.traceability && reports.performance &&
    reports.completeness.overall_status?.includes("PASS") &&
    reports.traceability.overall_status?.includes("PASS") &&
    reports.performance.overall_status?.includes("PASS");

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
        <Tab label="Auto Tests" />
        <Tab label="Architect Evaluation" />
        <Tab label="UAT Feedback" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Paper sx={{ p: 2.5, mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Automated Test Suite</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Runs Completeness, Traceability, and Performance tests automatically.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {allPassed && (
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", color: BLUEPRINT.success }}>
                ALL TESTS PASSED
              </Typography>
            )}
            <Button variant="contained" startIcon={<Play size={16} strokeWidth={1.5} />} onClick={runAllTests} disabled={loading}>
              {loading ? "Running…" : "Run All Tests"}
            </Button>
          </Box>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {(reports.completeness || reports.traceability || reports.performance) && (
          <Paper sx={{ display: "flex", flexWrap: "wrap", mb: 3 }}>
            {reports.completeness && (
              <MetricStat title="Completeness" value={`${reports.completeness.overall_score}%`} target="≥80%" status={reports.completeness.overall_status} />
            )}
            {reports.traceability && (
              <MetricStat title="Traceability Coverage" value={`${reports.traceability.overall_coverage}%`} target="≥90%" status={reports.traceability.overall_status} />
            )}
            {reports.performance && (
              <MetricStat title="Effort Reduction" value={`${reports.performance.effort_reduction_percent}%`} target="≥70%" status={reports.performance.overall_status} />
            )}
          </Paper>
        )}

        <ReportSection title="Test 1: Completeness" report={reports.completeness} />
        <ReportSection title="Test 3: Traceability" report={reports.traceability} />
        <ReportSection title="Test 4: Performance" report={reports.performance} />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <EvaluationPanel documentId={documentId} tdd={tdd} />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <UATForm documentId={documentId} />
      </TabPanel>
    </Box>
  );
}
