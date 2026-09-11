import React, { useState } from "react";
import {
  Box, Paper, Typography, Button, Grid, Alert,
  CircularProgress, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import { ChevronDown, Cpu, ArrowLeft } from "lucide-react";
import axios from "axios";
import Mono from "./blueprint/Mono";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

function Tag({ children, variant = "default" }) {
  const colors = {
    default: { border: BLUEPRINT.paperBorderStrong, text: "text.secondary" },
    steel: { border: BLUEPRINT.steel, text: BLUEPRINT.steel },
    accent: { border: BLUEPRINT.accent, text: BLUEPRINT.accent },
  }[variant];
  return (
    <Box sx={{
      display: "inline-block", px: 1, py: 0.4, mr: 0.75, mb: 0.75,
      border: `1px solid ${colors.border}`, fontSize: "0.72rem",
      fontFamily: "'IBM Plex Sans', sans-serif", color: colors.text,
    }}>
      {children}
    </Box>
  );
}

const TagSection = ({ title, items, variant }) => {
  if (!items || items.length === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {title} <Mono component="span" sx={{ color: "text.secondary" }}>({items.length})</Mono>
      </Typography>
      <Box>
        {items.slice(0, 20).map((item, i) => (
          <Tag key={i} variant={variant}>
            {typeof item === "string" ? item.slice(0, 60) : JSON.stringify(item).slice(0, 60)}
          </Tag>
        ))}
      </Box>
    </Box>
  );
};

export default function ExtractedComponents({ data, onGenerate, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { components, documentId, originalName, textLength } = data || {};
  const stats = components?.stats || {};

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      // Longer than the backend's own 180s timeout to the AI service, so a
      // slow-but-successful generation (e.g. Groq rate-limit retries) isn't
      // cut off here first.
      const res = await axios.post(`${API_BASE}/generate-tdd`, { documentId }, { timeout: 200000 });
      onGenerate(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "TDD generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 920, mx: "auto" }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" sx={{ wordBreak: "break-all" }}>{originalName}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              Document ID <Mono component="span">{documentId}</Mono> &middot;{" "}
              <Mono component="span">{textLength?.toLocaleString()}</Mono> characters extracted
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
            {Object.entries(stats).map(([k, v]) => (
              <Box key={k} sx={{
                px: 1, py: 0.5, border: `1px solid ${v > 0 ? BLUEPRINT.steel : BLUEPRINT.paperBorder}`,
                textAlign: "center", minWidth: 64,
              }}>
                <Mono sx={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: v > 0 ? BLUEPRINT.steel : "text.secondary" }}>{v}</Mono>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", textTransform: "uppercase" }}>
                  {k.replace("_found", "").replace(/_/g, " ")}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      {/* NLP Results */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Functional Requirements</Typography>
            {(components?.functional_requirements || []).slice(0, 8).map((req, i) => (
              <Box key={i} sx={{
                p: 1.25, mb: 1, borderLeft: `2px solid ${BLUEPRINT.steel}`, backgroundColor: BLUEPRINT.bg,
              }}>
                <Typography variant="body2">{req}</Typography>
              </Box>
            ))}
            {!components?.functional_requirements?.length && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                No requirements extracted. The document may lack explicit "shall/must/will" statements.
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Workflows</Typography>
            {(components?.workflows || []).slice(0, 6).map((wf, i) => (
              <Box key={i} sx={{
                p: 1.25, mb: 1, borderLeft: `2px solid ${BLUEPRINT.steelLight}`, backgroundColor: BLUEPRINT.bg,
              }}>
                <Typography variant="body2">{wf}</Typography>
              </Box>
            ))}
            {!components?.workflows?.length && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>No workflows extracted.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Entities / Actors / Rules */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Extracted Entities</Typography>
        <TagSection title="Actors / Roles" items={components?.actors} variant="steel" />
        <TagSection title="Data Entities" items={components?.data_entities} variant="default" />
        <TagSection title="Features" items={components?.features} variant="accent" />
        <TagSection title="Business Rules" items={components?.business_rules} variant="default" />
      </Paper>

      {/* Document Sections */}
      {components?.document_sections?.length > 0 && (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ChevronDown size={16} strokeWidth={1.5} />}>
            <Typography variant="subtitle2">
              Document Sections <Mono component="span" sx={{ color: "text.secondary" }}>({components.document_sections.length})</Mono>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {components.document_sections.slice(0, 12).map((s, i) => (
              <Box key={i} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ color: BLUEPRINT.steel }}>{s.heading}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.content?.slice(0, 200)}</Typography>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Paper sx={{ p: 3, mb: 2, textAlign: "center", borderColor: BLUEPRINT.steel }}>
          <CircularProgress size={22} sx={{ mb: 2, color: BLUEPRINT.steel }} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Analyzing your FDD and generating the Technical Design Document. This may take 30–90 seconds.
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: "flex", gap: 2 }}>
        <Button startIcon={<ArrowLeft size={16} strokeWidth={1.5} />} onClick={onBack} disabled={loading} variant="outlined">
          Upload New
        </Button>
        <Button
          variant="contained"
          size="large"
          fullWidth
          color="warning"
          startIcon={<Cpu size={18} strokeWidth={1.5} />}
          onClick={handleGenerate}
          disabled={loading}
          sx={{ py: 1.3 }}
        >
          {loading ? "Generating TDD…" : "Generate Technical Design Document"}
        </Button>
      </Box>
    </Box>
  );
}
