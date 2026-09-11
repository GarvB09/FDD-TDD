import React from "react";
import { Box } from "@mui/material";

/**
 * Faint drafting-grid background (minor 8px lines, major 64px lines).
 * Used behind rendered diagrams so they read as drafted output, not an embedded image.
 */
export default function BlueprintGrid({ children, minor = 8, major = 64, sx, ...props }) {
  return (
    <Box
      sx={{
        position: "relative",
        backgroundColor: "#FFFFFF",
        backgroundImage: `
          linear-gradient(rgba(44,95,124,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(44,95,124,0.08) 1px, transparent 1px),
          linear-gradient(rgba(44,95,124,0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(44,95,124,0.16) 1px, transparent 1px)
        `,
        backgroundSize: `${minor}px ${minor}px, ${minor}px ${minor}px, ${major}px ${major}px, ${major}px ${major}px`,
        backgroundPosition: "-1px -1px, -1px -1px, -1px -1px, -1px -1px",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
