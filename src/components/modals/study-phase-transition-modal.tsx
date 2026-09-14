import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";

export type StudyPhaseKind =
  | "baseline"
  | "mixed"
  | "active-learning"
  | "standard";

type StudyPhaseTransitionModalProps = {
  open: boolean;
  phaseKind?: StudyPhaseKind;
  phaseLabel?: string;
  phaseDescription?: string;
  phaseIndex?: number;
  totalPhases: number;
  feedbackTypes?: string[];
  videoSrc?: string;
  loading?: boolean;
  errorMessage?: string | null;
  onContinue: () => void;
};

type PhaseGuidance = {
  interfaceTitle: string;
  interfaceSteps: string[];
  defaultFeedbackTypes: string[];
};

const PHASE_GUIDANCE: Record<StudyPhaseKind, PhaseGuidance> = {
  baseline: {
    interfaceTitle: "Pairwise comparison interface",
    interfaceSteps: [
      "Watch both agent trajectories from beginning to end.",
      "Compare how well each trajectory moves the object toward the target.",
      "Choose the better trajectory, then submit your selection.",
    ],
    defaultFeedbackTypes: ["ranking"],
  },
  mixed: {
    interfaceTitle: "Sequential feedback interface",
    interfaceSteps: [
      "Complete the feedback prompt currently shown on screen.",
      "The interface alternates between feedback types automatically.",
      "Submit each response before moving to the next set of behavior.",
    ],
    defaultFeedbackTypes: [
      "rating",
      "ranking",
      "demonstration",
      "correction",
      "clusterRating",
    ],
  },
  "active-learning": {
    interfaceTitle: "Visual interactive interface",
    interfaceSteps: [
      "Use the projection to explore episodes, individual states, or clusters.",
      "Review the selected behavior in the episode and timeline views.",
      "Choose a relevant feedback action in the panel and submit it.",
    ],
    defaultFeedbackTypes: [
      "rating",
      "comparison",
      "demonstration",
      "correction",
      "clusterRating",
    ],
  },
  standard: {
    interfaceTitle: "Feedback interface",
    interfaceSteps: [
      "Review the agent behavior presented on screen.",
      "Use the available controls to provide the requested feedback.",
      "Submit each response before continuing to the next item.",
    ],
    defaultFeedbackTypes: [],
  },
};

const FEEDBACK_LABELS: Record<string, string> = {
  rating: "Rating",
  ranking: "Pairwise comparison",
  comparison: "Best-of comparison",
  demonstration: "Demonstration",
  correction: "Correction",
  clusterRating: "Cluster rating",
  featureSelection: "Feature selection",
  text: "Text feedback",
};

const StudyPhaseTransitionModal: React.FC<StudyPhaseTransitionModalProps> = ({
  open,
  phaseKind = "standard",
  phaseLabel = "Feedback task",
  phaseDescription,
  phaseIndex,
  totalPhases,
  feedbackTypes,
  videoSrc,
  loading = false,
  errorMessage = null,
  onContinue,
}) => {
  if (!open) {
    return null;
  }

  const guidance = PHASE_GUIDANCE[phaseKind];
  const availableFeedbackTypes =
    feedbackTypes && feedbackTypes.length > 0
      ? feedbackTypes
      : guidance.defaultFeedbackTypes;
  const actionLabel = errorMessage
    ? "Retry loading phase"
    : phaseIndex
      ? `Begin phase ${phaseIndex}`
      : "Begin task";

  return (
    <Box
      component="main"
      aria-labelledby="phase-intro-title"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        bgcolor: "background.default",
        backgroundImage: (theme) =>
          `radial-gradient(circle at 12% 10%, ${theme.palette.primary.main}14, transparent 32%), radial-gradient(circle at 90% 90%, ${theme.palette.secondary.main}10, transparent 30%)`,
      }}
    >
      <Box
        sx={{
          width: "min(1180px, calc(100% - 32px))",
          minHeight: "100%",
          mx: "auto",
          py: { xs: 2, md: 3 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <>
            <Box>
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 700, letterSpacing: 1.2 }}
              >
                {phaseIndex
                  ? `Phase ${phaseIndex} of ${totalPhases}`
                  : "Task instructions"}
              </Typography>
              <Typography
                id="phase-intro-title"
                component="h1"
                variant="h3"
                sx={{ fontWeight: 700, mt: 0.5 }}
              >
                {phaseLabel}
              </Typography>
              {phaseDescription && (
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{ mt: 1, maxWidth: 820, fontWeight: 400 }}
                >
                  {phaseDescription}
                </Typography>
              )}
            </Box>

            {loading ? (
              <Paper
                variant="outlined"
                sx={{
                  minHeight: 360,
                  borderRadius: 3,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <CircularProgress />
                <Typography variant="h6">Preparing this phase…</Typography>
                <Typography variant="body2" color="text.secondary">
                  The task will be ready in a moment.
                </Typography>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(320px, 2fr)" },
                  gap: 3,
                  alignItems: "stretch",
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}
                >
                  <Typography variant="h6" gutterBottom>
                    Watch the phase walkthrough
                  </Typography>
                  <Box
                    sx={{
                      aspectRatio: "16 / 9",
                      borderRadius: 2,
                      overflow: "hidden",
                      bgcolor: "grey.900",
                      color: "common.white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {videoSrc ? (
                      <Box
                        component="video"
                        controls
                        preload="metadata"
                        sx={{ width: "100%", height: "100%" }}
                      >
                        <source src={videoSrc} type="video/mp4" />
                        Your browser does not support the video tag.
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: "center", px: 3 }}>
                        <PlayCircleOutlineIcon sx={{ fontSize: 76, opacity: 0.9 }} />
                        <Typography variant="h6">Instruction video placeholder</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.72, mt: 0.5 }}>
                          A short walkthrough for {phaseLabel} will appear here.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    The walkthrough explains the controls and shows one example
                    response for this phase.
                  </Typography>
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                  }}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Interface
                    </Typography>
                    <Typography variant="h6">{guidance.interfaceTitle}</Typography>
                  </Box>
                  <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                    {guidance.interfaceSteps.map((step) => (
                      <Typography
                        component="li"
                        variant="body2"
                        key={step}
                        sx={{ mb: 1.25, pl: 0.5, lineHeight: 1.55 }}
                      >
                        {step}
                      </Typography>
                    ))}
                  </Box>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Feedback available in this phase
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                      {availableFeedbackTypes.length > 0 ? (
                        availableFeedbackTypes.map((feedbackType) => (
                          <Chip
                            key={feedbackType}
                            label={FEEDBACK_LABELS[feedbackType] ?? feedbackType}
                            color="primary"
                            variant="outlined"
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Follow the feedback prompt shown in the task.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Box>
            )}

            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                zIndex: 1,
                display: "flex",
                justifyContent: "flex-end",
                py: 1,
                bgcolor: "background.default",
              }}
            >
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                disabled={loading}
                onClick={onContinue}
                sx={{ minWidth: 180 }}
              >
                {actionLabel}
              </Button>
            </Box>
        </>
      </Box>
    </Box>
  );
};

export default StudyPhaseTransitionModal;
