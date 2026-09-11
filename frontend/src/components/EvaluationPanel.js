import React, { useState } from "react";
import { Box, Paper, Typography, Slider, Button, TextField, Alert } from "@mui/material";
import axios from "axios";
import Mono from "./blueprint/Mono";
import ScoreScale from "./blueprint/ScoreScale";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

const CRITERIA = [
  { id: "correctness",  label: "Technical Correctness", desc: "Are the technical decisions accurate and valid?" },
  { id: "alignment",    label: "FDD Alignment",         desc: "Does TDD fully address all FDD requirements?" },
  { id: "architecture", label: "Architecture Quality",  desc: "Is the system architecture well-designed?" },
  { id: "data_model",   label: "Data Model Quality",    desc: "Are tables, columns and relationships correct?" },
  { id: "api_design",   label: "API Design Quality",    desc: "Are endpoints RESTful, complete and well-defined?" },
  { id: "completeness", label: "Overall Completeness",  desc: "Are all required TDD sections present?" },
  { id: "clarity",      label: "Clarity & Readability", desc: "Is the TDD clear and easy to understand?" },
];

function scoreColor(score) {
  if (score >= 8) return BLUEPRINT.success;
  if (score >= 6) return BLUEPRINT.accent;
  return BLUEPRINT.error;
}

export default function EvaluationPanel({ documentId, tdd }) {
  const [scores, setScores] = useState(Object.fromEntries(CRITERIA.map((c) => [c.id, 7])));
  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatorRole, setEvaluatorRole] = useState("");
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedEvaluations, setSavedEvaluations] = useState([]);

  const avgScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / CRITERIA.length * 10) / 10;

  const handleSubmit = async () => {
    if (!evaluatorName || !evaluatorRole) {
      alert("Please enter your name and role.");
      return;
    }
    setLoading(true);
    const evaluation = {
      documentId, evaluatorName, evaluatorRole, scores, averageScore: avgScore, comments,
      timestamp: new Date().toISOString(),
      status: avgScore >= 8 ? "PASS" : "NEEDS IMPROVEMENT",
    };

    try {
      await axios.post(`${API_BASE}/evaluations`, evaluation);
    } catch {
      // Save locally if endpoint not available
    }

    const existing = JSON.parse(localStorage.getItem(`eval_${documentId}`) || "[]");
    existing.push(evaluation);
    localStorage.setItem(`eval_${documentId}`, JSON.stringify(existing));
    setSavedEvaluations(existing);
    setSubmitted(true);
    setLoading(false);
  };

  const loadEvaluations = () => {
    setSavedEvaluations(JSON.parse(localStorage.getItem(`eval_${documentId}`) || "[]"));
  };

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>Architect Evaluation Form</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          Rate the generated TDD on each criterion (1–10).
        </Typography>
        <Box sx={{ maxWidth: 320 }}>
          <ScoreScale
            label="Current Average"
            value={avgScore}
            max={10}
            valueLabel={`${avgScore}/10`}
            thresholds={[{ value: 8, label: "≥8" }]}
            passColor={scoreColor(avgScore)}
          />
        </Box>
      </Paper>

      {/* Evaluator Info */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Evaluator Information</Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField sx={{ flex: 1, minWidth: 220 }} size="small" label="Your Name" value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)} />
          <TextField sx={{ flex: 1, minWidth: 220 }} size="small" label="Your Role" placeholder="e.g. Software Architect, Developer" value={evaluatorRole} onChange={(e) => setEvaluatorRole(e.target.value)} />
        </Box>
      </Paper>

      {/* Scoring Criteria */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Scoring Criteria &middot; 1 = Poor, 10 = Excellent</Typography>
        {CRITERIA.map((criterion) => (
          <Box key={criterion.id} sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Box>
                <Typography variant="subtitle2">{criterion.label}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{criterion.desc}</Typography>
              </Box>
              <Mono sx={{ fontWeight: 700, color: scoreColor(scores[criterion.id]), minWidth: 44, textAlign: "right" }}>
                {scores[criterion.id]}/10
              </Mono>
            </Box>
            <Slider
              value={scores[criterion.id]}
              min={1} max={10} step={1}
              onChange={(_, val) => setScores((prev) => ({ ...prev, [criterion.id]: val }))}
              marks={[{ value: 1, label: "1" }, { value: 5, label: "5" }, { value: 8, label: "8" }, { value: 10, label: "10" }]}
              sx={{ color: scoreColor(scores[criterion.id]) }}
            />
          </Box>
        ))}
      </Paper>

      {/* Comments */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Additional Comments</Typography>
        <TextField
          fullWidth multiline rows={4}
          placeholder="Any specific feedback on accuracy, missing components, or improvements..."
          value={comments} onChange={(e) => setComments(e.target.value)}
        />
      </Paper>

      {submitted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Evaluation submitted. Average score: {avgScore}/10
        </Alert>
      )}

      <Button variant="contained" size="large" fullWidth onClick={handleSubmit} disabled={loading || submitted} sx={{ mb: 3, py: 1.4 }}>
        {loading ? "Submitting…" : submitted ? "Evaluation Submitted" : "Submit Evaluation"}
      </Button>

      <Button variant="outlined" size="small" onClick={loadEvaluations} sx={{ mb: 2 }}>
        Load Previous Evaluations ({JSON.parse(localStorage.getItem(`eval_${documentId}`) || "[]").length})
      </Button>

      {savedEvaluations.length > 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>All Evaluations Summary</Typography>
          {savedEvaluations.map((ev, i) => (
            <Box key={i} sx={{ mb: 1.5, pb: 1.5, borderBottom: `1px solid ${BLUEPRINT.paperBorder}` }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="subtitle2">{ev.evaluatorName} — {ev.evaluatorRole}</Typography>
                <Mono sx={{ fontWeight: 700, color: scoreColor(ev.averageScore) }}>{ev.averageScore}/10</Mono>
              </Box>
              <Mono variant="caption" sx={{ color: "text.secondary" }}>{ev.timestamp}</Mono>
              {ev.comments && <Typography variant="body2" sx={{ mt: 0.5 }}>{ev.comments}</Typography>}
            </Box>
          ))}
          <Box sx={{ mt: 2, p: 1.5, border: `1px solid ${BLUEPRINT.paperBorder}`, backgroundColor: BLUEPRINT.bg }}>
            <Typography variant="subtitle2">
              Team Average:{" "}
              <Mono component="span" sx={{ fontWeight: 700 }}>
                {Math.round(savedEvaluations.reduce((a, b) => a + b.averageScore, 0) / savedEvaluations.length * 10) / 10}/10
              </Mono>{" "}
              across <Mono component="span">{savedEvaluations.length}</Mono> evaluator(s)
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
