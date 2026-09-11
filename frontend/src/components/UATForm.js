import React, { useState } from "react";
import {
  Box, Paper, Typography, Slider, Button, TextField, Alert,
  RadioGroup, FormControlLabel, Radio, FormLabel, FormControl,
} from "@mui/material";
import Mono from "./blueprint/Mono";
import ScoreScale from "./blueprint/ScoreScale";
import { BLUEPRINT } from "../theme";

const UAT_QUESTIONS = [
  { id: "usability",   label: "Usability",      desc: "How easy was the system to use?" },
  { id: "quality",      label: "Output Quality", desc: "How good was the generated TDD quality?" },
  { id: "usefulness",   label: "Usefulness",     desc: "How useful is this tool for your work?" },
  { id: "accuracy",     label: "Accuracy",       desc: "How accurate were the technical details?" },
  { id: "time_saving",  label: "Time Saving",    desc: "How much time did this save you?" },
  { id: "adoption",     label: "Would Adopt",    desc: "Would you use this tool in your projects?" },
];

const USER_ROLES = ["Developer", "Software Architect", "Business Analyst", "Project Manager", "QA Engineer", "Other"];

function scoreColor(score) {
  if (score >= 7) return BLUEPRINT.success;
  if (score >= 5) return BLUEPRINT.accent;
  return BLUEPRINT.error;
}

export default function UATForm({ documentId }) {
  const [scores, setScores] = useState(Object.fromEntries(UAT_QUESTIONS.map((q) => [q.id, 7])));
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [feedback, setFeedback] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState("yes");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allResponses, setAllResponses] = useState([]);

  const avgScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / UAT_QUESTIONS.length * 10) / 10;

  const handleSubmit = () => {
    if (!userName || !userRole) {
      alert("Please enter your name and role.");
      return;
    }
    setLoading(true);
    const response = {
      documentId, userName, userRole, scores, averageScore: avgScore, wouldRecommend, feedback,
      timestamp: new Date().toISOString(),
      status: avgScore >= 7 ? "PASS" : "BELOW TARGET",
    };
    const existing = JSON.parse(localStorage.getItem(`uat_${documentId}`) || "[]");
    existing.push(response);
    localStorage.setItem(`uat_${documentId}`, JSON.stringify(existing));
    setAllResponses(existing);
    setSubmitted(true);
    setLoading(false);
  };

  const loadResponses = () => {
    setAllResponses(JSON.parse(localStorage.getItem(`uat_${documentId}`) || "[]"));
  };

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>User Acceptance Testing</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          Rate your experience with the FDD→TDD system (1–10).
        </Typography>
        <Box sx={{ maxWidth: 320 }}>
          <ScoreScale
            label="Your Score"
            value={avgScore}
            max={10}
            valueLabel={`${avgScore}/10`}
            thresholds={[{ value: 7, label: "≥7" }]}
            passColor={scoreColor(avgScore)}
          />
        </Box>
      </Paper>

      {/* User Info */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Your Information</Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField sx={{ flex: 1, minWidth: 220 }} size="small" label="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <TextField
            select sx={{ flex: 1, minWidth: 220 }} size="small" label="Your Role"
            value={userRole} onChange={(e) => setUserRole(e.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="">Select role...</option>
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </TextField>
        </Box>
      </Paper>

      {/* Rating Questions */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Satisfaction Ratings &middot; 1 = Very Poor, 10 = Excellent</Typography>
        {UAT_QUESTIONS.map((q) => (
          <Box key={q.id} sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Box>
                <Typography variant="subtitle2">{q.label}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{q.desc}</Typography>
              </Box>
              <Mono sx={{ fontWeight: 700, color: scoreColor(scores[q.id]), minWidth: 44, textAlign: "right" }}>
                {scores[q.id]}/10
              </Mono>
            </Box>
            <Slider
              value={scores[q.id]} min={1} max={10} step={1}
              onChange={(_, val) => setScores((prev) => ({ ...prev, [q.id]: val }))}
              marks={[{ value: 1, label: "1" }, { value: 5, label: "5" }, { value: 7, label: "7" }, { value: 10, label: "10" }]}
              sx={{ color: scoreColor(scores[q.id]) }}
            />
          </Box>
        ))}
      </Paper>

      {/* Would Recommend */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <FormControl>
          <FormLabel sx={{ fontWeight: 600, color: "text.primary", mb: 1, fontSize: "0.85rem" }}>
            Would you recommend this tool to your team?
          </FormLabel>
          <RadioGroup row value={wouldRecommend} onChange={(e) => setWouldRecommend(e.target.value)}>
            <FormControlLabel value="yes" control={<Radio />} label="Yes, definitely" />
            <FormControlLabel value="maybe" control={<Radio />} label="Maybe" />
            <FormControlLabel value="no" control={<Radio />} label="No" />
          </RadioGroup>
        </FormControl>
      </Paper>

      {/* Open Feedback */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Open Feedback</Typography>
        <TextField fullWidth multiline rows={4}
          placeholder="What did you like? What could be improved? Any missing features?"
          value={feedback} onChange={(e) => setFeedback(e.target.value)}
        />
      </Paper>

      {submitted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Feedback submitted. Your score: {avgScore}/10 — {avgScore >= 7 ? "Satisfactory" : "Below target"}
        </Alert>
      )}

      <Button variant="contained" size="large" fullWidth onClick={handleSubmit} disabled={loading || submitted} sx={{ mb: 3, py: 1.4 }}>
        {loading ? "Submitting…" : submitted ? "Feedback Submitted" : "Submit UAT Feedback"}
      </Button>

      <Button variant="outlined" size="small" onClick={loadResponses} sx={{ mb: 2 }}>
        View All Responses ({JSON.parse(localStorage.getItem(`uat_${documentId}`) || "[]").length})
      </Button>

      {allResponses.length > 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>UAT Summary</Typography>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, p: 2, mb: 2, border: `1px solid ${BLUEPRINT.paperBorder}`, backgroundColor: BLUEPRINT.bg }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Total Responses</Typography>
              <Mono variant="h5" sx={{ fontWeight: 700 }}>{allResponses.length}</Mono>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Average Score</Typography>
              <Mono variant="h5" sx={{ fontWeight: 700, color: scoreColor(allResponses.reduce((a, b) => a + b.averageScore, 0) / allResponses.length) }}>
                {Math.round(allResponses.reduce((a, b) => a + b.averageScore, 0) / allResponses.length * 10) / 10}/10
              </Mono>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Would Recommend</Typography>
              <Mono variant="h5" sx={{ fontWeight: 700, color: BLUEPRINT.success }}>
                {Math.round(allResponses.filter((r) => r.wouldRecommend === "yes").length / allResponses.length * 100)}%
              </Mono>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Target Status</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {(allResponses.reduce((a, b) => a + b.averageScore, 0) / allResponses.length) >= 7 ? "PASS" : "FAIL"}
              </Typography>
            </Box>
          </Box>

          {allResponses.map((r, i) => (
            <Box key={i} sx={{ mb: 1.5, pb: 1.5, borderBottom: `1px solid ${BLUEPRINT.paperBorder}` }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="subtitle2">{r.userName} — {r.userRole}</Typography>
                <Mono sx={{ fontWeight: 700, color: scoreColor(r.averageScore) }}>{r.averageScore}/10</Mono>
              </Box>
              <Mono variant="caption" sx={{ color: "text.secondary" }}>{r.timestamp} | Recommend: {r.wouldRecommend}</Mono>
              {r.feedback && <Typography variant="body2" sx={{ mt: 0.5 }}>&ldquo;{r.feedback}&rdquo;</Typography>}
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
