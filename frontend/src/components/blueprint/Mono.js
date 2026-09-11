import React, { forwardRef } from "react";
import { Typography } from "@mui/material";
import { FONT_MONO } from "../../theme";

// forwardRef so Mono can be used as the direct child of components that
// need to attach a ref to it (e.g. MUI's Tooltip).
const Mono = forwardRef(function Mono({ children, sx, component = "span", variant = "body2", ...props }, ref) {
  return (
    <Typography
      ref={ref}
      component={component}
      variant={variant}
      sx={{ fontFamily: FONT_MONO, ...sx }}
      {...props}
    >
      {children}
    </Typography>
  );
});

export default Mono;
