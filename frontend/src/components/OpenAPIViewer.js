import React, { useState } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Alert, Tooltip,
} from "@mui/material";
import { ChevronDown, Download, FileJson } from "lucide-react";
import axios from "axios";
import Mono from "./blueprint/Mono";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

const METHOD_COLOR = {
  get: BLUEPRINT.success,
  post: BLUEPRINT.steel,
  put: BLUEPRINT.accent,
  patch: BLUEPRINT.steelDark,
  delete: BLUEPRINT.error,
};

function Tag({ children, color = BLUEPRINT.paperBorderStrong, mono = true }) {
  const Comp = mono ? Mono : Typography;
  return (
    <Comp variant="caption" sx={{ px: 0.75, py: 0.25, border: `1px solid ${color}`, color, display: "inline-block", mr: 0.5, mb: 0.5 }}>
      {children}
    </Comp>
  );
}

function EndpointRow({ method, path: epPath, operation }) {
  const color = METHOD_COLOR[method] || METHOD_COLOR.get;
  const params = operation.parameters || [];
  const responses = operation.responses || {};

  return (
    <Accordion sx={{ mb: 0.5 }}>
      <AccordionSummary expandIcon={<ChevronDown size={16} strokeWidth={1.5} />} sx={{ borderLeft: `3px solid ${color}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%", minWidth: 0, overflow: "hidden" }}>
          <Mono variant="caption" sx={{ fontWeight: 700, minWidth: 52, flexShrink: 0, color, border: `1px solid ${color}`, px: 0.5, textAlign: "center" }}>
            {method.toUpperCase()}
          </Mono>
          <Tooltip title={epPath}>
            <Mono sx={{
              fontWeight: 600, fontSize: "0.8rem", flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {epPath}
            </Mono>
          </Tooltip>
          <Typography variant="caption" sx={{
            color: "text.secondary", flexShrink: 0, pr: 1,
            maxWidth: { xs: "30%", sm: "40%" },
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {operation.summary}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {operation.description && (
          <Typography variant="body2" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{operation.description}</Typography>
        )}

        {operation.security?.length === 0 && (
          <Tag color={BLUEPRINT.success} mono={false}>No Auth Required</Tag>
        )}

        {params.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Path Parameters</Typography>
            {params.map((p, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mt: 0.5, alignItems: "center" }}>
                <Mono variant="caption" sx={{ px: 0.5, border: `1px solid ${BLUEPRINT.steel}`, color: BLUEPRINT.steel }}>{p.name}</Mono>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{p.schema?.type} &middot; {p.description}</Typography>
                {p.required && <Tag color={BLUEPRINT.error} mono={false}>required</Tag>}
              </Box>
            ))}
          </Box>
        )}

        {operation.requestBody && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Request Body</Typography>
            <Box sx={{ backgroundColor: BLUEPRINT.bg, border: `1px solid ${BLUEPRINT.paperBorder}`, p: 1.5 }}>
              <Mono variant="caption" sx={{ whiteSpace: "pre" }}>
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(
                      operation.requestBody?.content?.["application/json"]?.schema?.properties ||
                      operation.requestBody?.content?.["multipart/form-data"]?.schema?.properties || {}
                    ).map(([k, v]) => [k, `<${v.type}>`])
                  ), null, 2
                )}
              </Mono>
            </Box>
          </Box>
        )}

        <Box>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Responses</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {Object.entries(responses).map(([code, resp]) => (
              <Tag key={code} color={code.startsWith("2") ? BLUEPRINT.success : code.startsWith("4") ? BLUEPRINT.accent : BLUEPRINT.error}>
                {code}: {resp.description}
              </Tag>
            ))}
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default function OpenAPIViewer({ documentId }) {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSpec = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE}/tdd/${documentId}/openapi`);
      setSpec(res.data.openapi_spec);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate OpenAPI spec.");
    } finally {
      setLoading(false);
    }
  };

  const downloadSpec = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentId}_openapi.json`;
    a.click();
  };

  if (!spec && !loading) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <FileJson size={32} strokeWidth={1.25} color={BLUEPRINT.textFaint} style={{ marginBottom: 12 }} />
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Generate an OpenAPI 3.0 specification from your TDD's API design.
          Compatible with Swagger UI, Redoc, and Postman.
        </Typography>
        <Button variant="contained" onClick={loadSpec}>Generate OpenAPI Spec</Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", py: 5 }}>
        <CircularProgress size={22} sx={{ mb: 2, color: BLUEPRINT.steel }} />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>Generating OpenAPI 3.0 spec...</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  const tags = {};
  for (const [epPath, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = (operation.tags || ["General"])[0];
      if (!tags[tag]) tags[tag] = [];
      tags[tag].push({ method, path: epPath, operation });
    }
  }

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h4">{spec.info?.title}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            OpenAPI <Mono component="span" variant="caption">{spec.openapi}</Mono> &middot;{" "}
            <Mono component="span" variant="caption">{Object.values(spec.paths || {}).reduce((acc, m) => acc + Object.keys(m).length, 0)}</Mono> endpoints
          </Typography>
          {spec.servers?.map((s, i) => (
            <Tag key={i}>{s.description}: {s.url}</Tag>
          ))}
        </Box>
        <Button size="small" startIcon={<Download size={14} strokeWidth={1.5} />} variant="outlined" onClick={downloadSpec}>
          openapi.json
        </Button>
      </Paper>

      <Paper sx={{ p: 1.5, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Tag color={BLUEPRINT.steel} mono={false}>JWT Bearer</Tag>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {spec.components?.securitySchemes?.BearerAuth?.description}
        </Typography>
      </Paper>

      {Object.entries(tags).map(([tag, endpoints]) => (
        <Box key={tag} sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ mb: 1, color: BLUEPRINT.steel, borderBottom: `1px solid ${BLUEPRINT.paperBorder}`, pb: 0.75 }}>
            {tag} <Mono component="span" variant="caption" sx={{ color: "text.secondary", ml: 1 }}>{endpoints.length}</Mono>
          </Typography>
          {endpoints.map((ep, i) => <EndpointRow key={i} {...ep} />)}
        </Box>
      ))}

      {Object.keys(spec.components?.schemas || {}).length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" sx={{ mb: 1, color: BLUEPRINT.steelDark, borderBottom: `1px solid ${BLUEPRINT.paperBorder}`, pb: 0.75 }}>
            Data Schemas
          </Typography>
          {Object.entries(spec.components.schemas).map(([name, schema]) => (
            <Accordion key={name} sx={{ mb: 0.5 }}>
              <AccordionSummary expandIcon={<ChevronDown size={16} strokeWidth={1.5} />}>
                <Typography sx={{ fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{name}</Typography>
                <Mono variant="caption" sx={{ color: "text.secondary", ml: 2 }}>
                  {Object.keys(schema.properties || {}).length} fields
                </Mono>
              </AccordionSummary>
              <AccordionDetails>
                {schema.description && <Typography variant="caption" sx={{ color: "text.secondary" }}>{schema.description}</Typography>}
                <Box sx={{ backgroundColor: BLUEPRINT.bg, border: `1px solid ${BLUEPRINT.paperBorder}`, p: 1.5, mt: 1 }}>
                  <Mono variant="caption" sx={{ whiteSpace: "pre" }}>
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(schema.properties || {}).map(([k, v]) => [k, v.format ? `${v.type} (${v.format})` : v.type])
                      ), null, 2
                    )}
                  </Mono>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
}
