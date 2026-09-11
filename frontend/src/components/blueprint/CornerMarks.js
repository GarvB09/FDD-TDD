import React from "react";
import { Box } from "@mui/material";
import { BLUEPRINT } from "../../theme";

/**
 * Registration marks like the crop/alignment marks on a technical drawing sheet.
 * Purely decorative framing — never carries meaning on its own.
 */
export default function CornerMarks({ color = BLUEPRINT.steel, size = 16, inset = 10 }) {
  const corners = [
    { top: inset, left: inset, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
    { top: inset, right: inset, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
    { bottom: inset, left: inset, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
    { bottom: inset, right: inset, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <Box key={i} aria-hidden="true" sx={{ position: "absolute", width: size, height: size, ...c }} />
      ))}
    </>
  );
}
