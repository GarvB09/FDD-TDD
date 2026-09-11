import React from "react";
import { Box, Typography } from "@mui/material";
import { FONT_MONO, BLUEPRINT } from "../../theme";

/**
 * Horizontal scale with annotated threshold ticks (e.g. >= 80%) and a marker
 * for the current value — an explicit alternative to a colored progress bar.
 * Color still encodes pass/fail, but the numeric value and tick labels carry
 * the same information in text for anyone who can't perceive color.
 */
export default function ScoreScale({ value, max = 100, thresholds = [], label, valueLabel, passColor }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = passColor || BLUEPRINT.steel;

  return (
    <Box sx={{ width: "100%" }}>
      {label && (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{label}</Typography>
          <Typography variant="caption" sx={{ fontFamily: FONT_MONO, fontWeight: 600, color }}>
            {valueLabel ?? `${value}${max === 100 ? "%" : `/${max}`}`}
          </Typography>
        </Box>
      )}
      <Box sx={{ position: "relative", height: 6, backgroundColor: BLUEPRINT.bgSunken, border: `1px solid ${BLUEPRINT.paperBorder}` }}>
        <Box sx={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, backgroundColor: color, transition: "width 0.2s ease" }} />
        {thresholds.map((t, i) => (
          <Box
            key={i}
            aria-hidden="true"
            sx={{
              position: "absolute",
              top: -3,
              left: `${(t.value / max) * 100}%`,
              width: "1px",
              height: 12,
              backgroundColor: BLUEPRINT.text,
              opacity: 0.4,
            }}
          />
        ))}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: -4,
            left: `calc(${pct}% - 5px)`,
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            border: `2px solid ${color}`,
          }}
        />
      </Box>
      {thresholds.length > 0 && (
        <Box sx={{ position: "relative", height: 14, mt: 0.5 }}>
          {thresholds.map((t, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{
                position: "absolute",
                left: `${(t.value / max) * 100}%`,
                transform: "translateX(-50%)",
                fontFamily: FONT_MONO,
                fontSize: "0.62rem",
                color: "text.secondary",
                whiteSpace: "nowrap",
              }}
            >
              {t.label ?? `≥${t.value}`}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
