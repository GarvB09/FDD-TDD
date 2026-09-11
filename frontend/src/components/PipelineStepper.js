import React from "react";
import { Box, Typography } from "@mui/material";
import { FONT_MONO, BLUEPRINT } from "../theme";

const steps = [
  { label: "Upload FDD", desc: "PDF or DOCX" },
  { label: "Review Extraction", desc: "NLP components" },
  { label: "Generated TDD", desc: "Full document" },
];

export default function PipelineStepper({ activeStep }) {
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", border: `1px solid ${BLUEPRINT.paperBorder}`, backgroundColor: "background.paper" }}>
      {steps.map((s, i) => {
        const state = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
        return (
          <Box
            key={s.label}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 2,
              py: 1.25,
              borderRight: i < steps.length - 1 ? `1px solid ${BLUEPRINT.paperBorder}` : "none",
              borderBottom: `2px solid ${state === "active" ? BLUEPRINT.steel : state === "done" ? BLUEPRINT.success : "transparent"}`,
              backgroundColor: state === "active" ? "rgba(44,95,124,0.05)" : "transparent",
            }}
          >
            <Box sx={{
              width: 22, height: 22, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1.5px solid ${state === "pending" ? BLUEPRINT.paperBorderStrong : state === "done" ? BLUEPRINT.success : BLUEPRINT.steel}`,
              color: state === "pending" ? BLUEPRINT.textFaint : state === "done" ? BLUEPRINT.success : BLUEPRINT.steel,
              backgroundColor: "#FFFFFF",
            }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.68rem", fontWeight: 600 }}>
                {state === "done" ? "✓" : i + 1}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{
                fontSize: "0.78rem", fontWeight: 600,
                color: state === "pending" ? "text.secondary" : "text.primary",
                whiteSpace: "nowrap",
              }}>
                {s.label}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }}>
                {s.desc}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
