import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

type ExperimentCompletionScreenProps = {
  completionCode: string;
};

const ExperimentCompletionScreen: React.FC<
  ExperimentCompletionScreenProps
> = ({ completionCode }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(completionCode);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <Box
      component="main"
      aria-labelledby="experiment-complete-title"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
        backgroundImage: (theme) =>
          `radial-gradient(circle at 50% 20%, ${theme.palette.success.main}18, transparent 38%)`,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: "min(680px, 100%)",
          p: { xs: 3, md: 6 },
          textAlign: "center",
          borderRadius: 3,
        }}
      >
        <CheckCircleOutlineIcon color="success" sx={{ fontSize: 72, mb: 2 }} />
        <Typography
          id="experiment-complete-title"
          component="h1"
          variant="h3"
          sx={{ fontWeight: 700 }}
        >
          Study complete
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          Your feedback and questionnaire responses were submitted
          successfully.
        </Typography>

        <Typography variant="overline" color="text.secondary" sx={{ mt: 4 }}>
          Completion code
        </Typography>
        <Box
          sx={{
            mt: 1,
            mx: "auto",
            p: 2,
            maxWidth: 440,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Typography
            component="code"
            variant="h4"
            sx={{
              fontWeight: 700,
              letterSpacing: 2,
              overflowWrap: "anywhere",
            }}
          >
            {completionCode}
          </Typography>
          <Tooltip title={copied ? "Copied!" : "Copy completion code"} arrow>
            <IconButton
              onClick={handleCopy}
              aria-label="Copy completion code"
              color="primary"
            >
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Alert severity="info" sx={{ mt: 3, textAlign: "left" }}>
          Copy this code into Prolific or Mechanical Turk to confirm that you
          completed the study. You may then close this page.
        </Alert>
        {copyError && (
          <Alert severity="warning" sx={{ mt: 2, textAlign: "left" }}>
            Automatic copying is unavailable. Select and copy the code manually.
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default ExperimentCompletionScreen;
