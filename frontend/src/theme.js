import { createTheme } from "@mui/material/styles";

export const FONT_DISPLAY = "'Space Grotesk', sans-serif";
export const FONT_BODY = "'Inter', sans-serif";
export const FONT_LABEL = "'IBM Plex Sans', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";

export const BLUEPRINT = {
  paper: "#FFFFFF",
  paperBorder: "#D8D2C4",
  paperBorderStrong: "#BDB5A0",
  bg: "#F7F5EF",
  bgSunken: "#EFEBDF",
  text: "#1A1A1A",
  textMuted: "#5B584E",
  textFaint: "#8A8677",
  steel: "#2C5F7C",
  steelDark: "#1E4257",
  steelLight: "#4A7C9C",
  accent: "#C8551E",
  error: "#A13327",
  success: "#3A7355",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: BLUEPRINT.steel, dark: BLUEPRINT.steelDark, light: BLUEPRINT.steelLight, contrastText: "#FFFFFF" },
    secondary: { main: BLUEPRINT.steelDark, contrastText: "#FFFFFF" },
    warning: { main: BLUEPRINT.accent, contrastText: "#FFFFFF" },
    error: { main: BLUEPRINT.error, contrastText: "#FFFFFF" },
    success: { main: BLUEPRINT.success, contrastText: "#FFFFFF" },
    background: { default: BLUEPRINT.bg, paper: BLUEPRINT.paper },
    text: { primary: BLUEPRINT.text, secondary: BLUEPRINT.textMuted },
    divider: BLUEPRINT.paperBorder,
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: FONT_BODY,
    h1: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "1.85rem", letterSpacing: "-0.01em", lineHeight: 1.25 },
    h2: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "1.5rem", lineHeight: 1.3 },
    h3: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "1.2rem", lineHeight: 1.3 },
    h4: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "1.05rem", lineHeight: 1.35 },
    h5: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.4 },
    h6: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.4 },
    subtitle1: { fontFamily: FONT_LABEL, fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: BLUEPRINT.textMuted },
    subtitle2: { fontFamily: FONT_LABEL, fontWeight: 600, fontSize: "0.78rem", letterSpacing: "0.02em" },
    body1: { fontFamily: FONT_BODY, fontSize: "0.9rem", lineHeight: 1.6 },
    body2: { fontFamily: FONT_BODY, fontSize: "0.825rem", lineHeight: 1.55 },
    caption: { fontFamily: FONT_BODY, fontSize: "0.72rem" },
    button: { fontFamily: FONT_LABEL, fontWeight: 600, textTransform: "none", letterSpacing: "0.01em", fontSize: "0.82rem" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: BLUEPRINT.bg },
        "*:focus-visible": {
          outline: `2px solid ${BLUEPRINT.steel}`,
          outlineOffset: "2px",
        },
        code: { fontFamily: FONT_MONO },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${BLUEPRINT.paperBorder}`,
          boxShadow: "none",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${BLUEPRINT.paperBorder}`, boxShadow: "none" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 2, boxShadow: "none" },
        outlined: { borderColor: BLUEPRINT.paperBorderStrong },
        outlinedPrimary: { borderColor: BLUEPRINT.steel },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 2 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 2, fontFamily: FONT_LABEL, fontWeight: 500 },
        outlined: { borderColor: BLUEPRINT.paperBorderStrong },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 38, borderBottom: `1px solid ${BLUEPRINT.paperBorder}` },
        indicator: { height: 2, backgroundColor: BLUEPRINT.steel },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "uppercase",
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: "0.68rem",
          letterSpacing: "0.09em",
          minHeight: 38,
          minWidth: "auto",
          padding: "8px 14px",
          color: BLUEPRINT.textFaint,
          "&.Mui-selected": { color: BLUEPRINT.text },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#E4DFD3", fontSize: "0.8rem", padding: "8px 12px" },
        head: {
          fontFamily: FONT_LABEL,
          fontWeight: 600,
          fontSize: "0.66rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: BLUEPRINT.textMuted,
          backgroundColor: "#FBFAF5",
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: `1px solid ${BLUEPRINT.paperBorder}`,
          borderRadius: "2px !important",
          "&:before": { display: "none" },
          "&.Mui-expanded": { margin: 0 },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: { root: { minHeight: 44, "&.Mui-expanded": { minHeight: 44 } } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 0, height: 4, backgroundColor: BLUEPRINT.bgSunken },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 2, backgroundColor: BLUEPRINT.paper },
        notchedOutline: { borderColor: BLUEPRINT.paperBorderStrong },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { height: 3, padding: "10px 0" },
        thumb: { width: 14, height: 14, borderRadius: "50%", boxShadow: "none", "&:hover, &.Mui-focusVisible": { boxShadow: `0 0 0 6px rgba(44,95,124,0.16)` } },
        track: { border: "none" },
        rail: { backgroundColor: BLUEPRINT.bgSunken, opacity: 1 },
        markLabel: { fontFamily: FONT_MONO, fontSize: "0.68rem", color: BLUEPRINT.textMuted },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 2, border: "1px solid" },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: BLUEPRINT.paperBorder } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontFamily: FONT_BODY, fontSize: "0.7rem", backgroundColor: BLUEPRINT.text },
      },
    },
  },
});

export default theme;
