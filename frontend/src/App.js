import React, { useState } from "react";
import { ThemeProvider, CssBaseline, Box, Typography } from "@mui/material";
import { Compass } from "lucide-react";
import theme, { BLUEPRINT, FONT_MONO } from "./theme";
import { TraceabilityProvider } from "./components/blueprint/Traceability";
import UploadStep from "./components/UploadStep";
import ExtractedComponents from "./components/ExtractedComponents";
import TDDViewer from "./components/TDDViewer";
import Stepper from "./components/PipelineStepper";

export default function App() {
  const [step, setStep] = useState(0);
  const [uploadData, setUploadData] = useState(null);
  const [tddData, setTddData] = useState(null);

  const handleUploadComplete = (data) => { setUploadData(data); setStep(1); };
  const handleTDDGenerated = (data) => { setTddData(data); setStep(2); };
  const handleReset = () => { setStep(0); setUploadData(null); setTddData(null); };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TraceabilityProvider>
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
          <Box sx={{ maxWidth: 1240, mx: "auto", px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>

            {/* Title block */}
            <Box sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderBottom: `2px solid ${BLUEPRINT.text}`,
              pb: 2,
              mb: 3,
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Compass size={26} strokeWidth={1.5} color={BLUEPRINT.steel} />
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 0.25 }}>
                    AI-Assisted Document Conversion
                  </Typography>
                  <Typography variant="h1" sx={{ fontSize: { xs: "1.4rem", md: "1.7rem" } }}>
                    FDD &rarr; TDD Converter
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem", color: "text.secondary", lineHeight: 1.6 }}>
                  DOC {uploadData?.documentId ? uploadData.documentId.slice(0, 12) : "—"}<br />
                  DATE {today}<br />
                  REV 1.0
                </Typography>
              </Box>
            </Box>

            <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 640, mb: 4 }}>
              Converts Functional Design Documents into structured Technical Design Documents —
              system architecture, data model, API design, and full requirement traceability.
            </Typography>

            {/* Stepper */}
            <Stepper activeStep={step} />

            {/* Content */}
            <Box sx={{ mt: 3 }}>
              {step === 0 && <UploadStep onComplete={handleUploadComplete} />}
              {step === 1 && (
                <ExtractedComponents data={uploadData} onGenerate={handleTDDGenerated} onBack={handleReset} />
              )}
              {step === 2 && (
                <TDDViewer tddData={tddData} documentId={uploadData?.documentId} onReset={handleReset} />
              )}
            </Box>

            {/* Footer */}
            <Box sx={{ textAlign: "center", mt: 6, pt: 2, borderTop: `1px solid ${BLUEPRINT.paperBorder}` }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                FDD &rarr; TDD Converter — Sheet 1/1
              </Typography>
            </Box>

          </Box>
        </Box>
      </TraceabilityProvider>
    </ThemeProvider>
  );
}
