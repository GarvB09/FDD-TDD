import React from "react";
import { TextField, Typography } from "@mui/material";
import { FONT_MONO, BLUEPRINT } from "../../theme";

/**
 * Renders either plain text (view mode) or a bound MUI TextField (edit mode),
 * so a section can flip between "view" and "edit" without swapping components.
 */
export default function EditableField({
  editMode,
  value,
  onChange,
  multiline = false,
  minRows = 2,
  mono = false,
  variant = "body2",
  placeholder = "",
  sx,
}) {
  if (!editMode) {
    return (
      <Typography
        component="span"
        variant={variant}
        sx={{
          display: multiline ? "block" : "inline",
          whiteSpace: multiline ? "pre-wrap" : "normal",
          fontFamily: mono ? FONT_MONO : undefined,
          ...sx,
        }}
      >
        {value || <Typography component="span" sx={{ color: BLUEPRINT.textFaint, fontStyle: "italic" }}>&mdash;</Typography>}
      </Typography>
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      multiline={multiline}
      minRows={multiline ? minRows : undefined}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{
        "& .MuiInputBase-input, & .MuiInputBase-inputMultiline": {
          fontFamily: mono ? FONT_MONO : undefined,
          fontSize: variant === "caption" ? "0.75rem" : "0.85rem",
        },
        ...sx,
      }}
    />
  );
}
