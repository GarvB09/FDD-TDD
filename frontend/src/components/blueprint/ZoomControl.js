import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { BLUEPRINT } from "../../theme";

/**
 * Thin-stroke zoom/pan control, styled as a drafting tool (a bordered strip of
 * square buttons) rather than a floating rounded FAB.
 */
export default function ZoomControl({ onZoomIn, onZoomOut, onReset, sx }) {
  const items = [
    { icon: <ZoomOut size={14} strokeWidth={1.5} />, onClick: onZoomOut, label: "Zoom out" },
    { icon: <Maximize2 size={14} strokeWidth={1.5} />, onClick: onReset, label: "Reset view" },
    { icon: <ZoomIn size={14} strokeWidth={1.5} />, onClick: onZoomIn, label: "Zoom in" },
  ];
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 10,
        right: 10,
        zIndex: 6,
        display: "flex",
        border: `1px solid ${BLUEPRINT.paperBorderStrong}`,
        backgroundColor: "#FFFFFF",
        ...sx,
      }}
    >
      {items.map((b, i) => (
        <Tooltip key={i} title={b.label}>
          <IconButton
            size="small"
            onClick={b.onClick}
            aria-label={b.label}
            sx={{
              borderRadius: 0,
              borderRight: i < items.length - 1 ? `1px solid ${BLUEPRINT.paperBorder}` : "none",
              color: BLUEPRINT.steel,
              width: 28,
              height: 28,
              "&:hover": { backgroundColor: BLUEPRINT.bg },
            }}
          >
            {b.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
}
