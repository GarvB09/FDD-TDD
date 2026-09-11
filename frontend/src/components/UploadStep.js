import React, { useState, useRef } from "react";
import { Box, Button, Typography, Alert, LinearProgress, IconButton, Tooltip } from "@mui/material";
import { FileUp, File as FileIcon, X } from "lucide-react";
import axios from "axios";
import CornerMarks from "./blueprint/CornerMarks";
import Mono from "./blueprint/Mono";
import { BLUEPRINT } from "../theme";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadStep({ onComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const abortControllerRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "md"].includes(ext)) {
      setError("Only PDF, DOCX, and Markdown files are supported.");
      return;
    }
    setFile(f);
    setError("");
    setCancelled(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange({ target: { files: [f] } });
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setError("");
    setCancelled(false);
    setProgress(0);
    setStage("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setCancelled(false);
    setProgress(10);
    setStage("Uploading document...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("fdd", file);

      setProgress(30);
      setStage("Extracting text from document...");

      const res = await axios.post(`${API_BASE}/upload-fdd`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: controller.signal,
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / e.total) * 40) + 10;
          setProgress(pct);
        },
      });

      setProgress(80);
      setStage("Running NLP extraction...");
      await new Promise((r) => setTimeout(r, 500));

      setProgress(100);
      setStage("Done.");
      onComplete(res.data);
    } catch (err) {
      if (axios.isCancel(err) || err.code === "ERR_CANCELED") {
        setCancelled(true);
        setProgress(0);
        setStage("");
      } else {
        setError(err.response?.data?.error || err.message || "Upload failed.");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    abortControllerRef.current?.abort();
  };

  const ext = file?.name.split(".").pop().toUpperCase();

  return (
    <Box sx={{ maxWidth: 640, mx: "auto" }}>
      <Box
        sx={{
          position: "relative",
          p: 5,
          border: `1px solid ${dragOver || file ? BLUEPRINT.steel : BLUEPRINT.paperBorderStrong}`,
          backgroundColor: dragOver ? "rgba(44,95,124,0.05)" : "background.paper",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !loading && inputRef.current.click()}
        role="button"
        tabIndex={0}
      >
        <CornerMarks />

        {file ? (
          <FileIcon size={40} strokeWidth={1.25} color={BLUEPRINT.steel} />
        ) : (
          <FileUp size={40} strokeWidth={1.25} color={BLUEPRINT.textFaint} />
        )}

        <Typography variant="h4" sx={{ mt: 2, mb: 0.5, wordBreak: "break-all" }}>
          {file ? file.name : "Drag & drop your FDD here"}
        </Typography>

        {!file && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Supports PDF, DOCX, and Markdown &middot; Max 20MB
          </Typography>
        )}

        {file && !loading && (
          <Box sx={{
            display: "inline-flex", alignItems: "center", gap: 2, mt: 1.5, pl: 1.5, pr: 0.5, py: 0.5,
            border: `1px solid ${BLUEPRINT.paperBorder}`, backgroundColor: BLUEPRINT.bg,
          }}>
            <Mono variant="caption" sx={{ color: "text.secondary" }}>TYPE <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{ext}</Box></Mono>
            <Mono variant="caption" sx={{ color: "text.secondary" }}>SIZE <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{formatSize(file.size)}</Box></Mono>
            <Tooltip title="Remove file">
              <IconButton size="small" onClick={handleRemoveFile} aria-label="Remove selected file" sx={{ color: BLUEPRINT.textFaint, "&:hover": { color: BLUEPRINT.error } }}>
                <X size={14} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.md"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </Box>

      {loading && (
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{stage}</Typography>
            <Mono variant="caption" sx={{ color: "text.secondary" }}>{progress}%</Mono>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {cancelled && (
        <Box sx={{ mt: 2, p: 1.5, border: `1px solid ${BLUEPRINT.paperBorderStrong}`, backgroundColor: BLUEPRINT.bg }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Upload cancelled. Choose a different file, or try again.
          </Typography>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", gap: 1.5, mt: 3 }}>
          <Button variant="contained" size="large" fullWidth disabled sx={{ py: 1.4 }}>
            Processing…
          </Button>
          <Button
            variant="outlined"
            size="large"
            color="error"
            onClick={handleCancelUpload}
            sx={{ py: 1.4, px: 3, whiteSpace: "nowrap" }}
          >
            Cancel
          </Button>
        </Box>
      ) : (
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!file}
          onClick={handleUpload}
          sx={{ mt: 3, py: 1.4 }}
        >
          Upload & Extract Components
        </Button>
      )}

      <Box sx={{ mt: 3, p: 1.5, border: `1px solid ${BLUEPRINT.paperBorder}`, backgroundColor: "background.paper" }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>Pipeline: </Box>
          Upload &rarr; Parse Text &rarr; NLP Extraction &rarr; Component Review &rarr; AI Generation &rarr; TDD Output
        </Typography>
      </Box>
    </Box>
  );
}
