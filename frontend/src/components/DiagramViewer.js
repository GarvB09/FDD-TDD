import React, { useState } from "react";
import { Box, Paper, Typography, Tab, Tabs, Button, CircularProgress, Alert } from "@mui/material";
import { Workflow } from "lucide-react";
import axios from "axios";
import MermaidDiagram from "./MermaidDiagram";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function DiagramViewer({ documentId, tdd, components }) {
  const [tab, setTab] = useState(0);
  const [diagrams, setDiagrams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDiagrams = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/diagrams/${documentId}`, { tdd, components });
      setDiagrams(res.data.diagrams);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate diagrams.");
    } finally {
      setLoading(false);
    }
  };

  if (!diagrams && !loading) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <Workflow size={32} strokeWidth={1.25} color={BLUEPRINT.textFaint} style={{ marginBottom: 12 }} />
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Generate ER diagram and Sequence diagrams from your TDD data model and workflows.
        </Typography>
        <Button variant="contained" size="large" onClick={loadDiagrams}>Generate Diagrams</Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <CircularProgress size={24} sx={{ mb: 2, color: BLUEPRINT.steel }} />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>Generating diagrams...</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  const sequenceDiagrams = diagrams?.sequence_diagrams || [];

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label="ER Diagram" />
        {sequenceDiagrams.map((seq, i) => <Tab key={i} label={`Sequence ${i + 1}`} />)}
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Entity Relationship Diagram</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
            Auto-generated from TDD data model tables and relationships.
          </Typography>
          <MermaidDiagram code={diagrams?.er_diagram} title="Database Entity Relationships" />
        </Paper>
      </TabPanel>

      {sequenceDiagrams.map((seq, i) => (
        <TabPanel key={i} value={tab} index={i + 1}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Sequence Diagram — {seq.title}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Auto-generated from FDD workflows and system actors.
            </Typography>
            <MermaidDiagram code={seq.diagram} title={seq.title} />
          </Paper>
        </TabPanel>
      ))}
    </Box>
  );
}
