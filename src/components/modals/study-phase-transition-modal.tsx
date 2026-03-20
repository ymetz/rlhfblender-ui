import React from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from "@mui/material";

type StudyPhaseTransitionModalProps = {
  open: boolean;
  stage: "intro" | "between" | "complete";
  phaseLabel?: string;
  phaseDescription?: string;
  phaseIndex?: number;
  totalPhases: number;
  surveyUrl: string;
  loading?: boolean;
  errorMessage?: string | null;
  onContinue: () => void;
};

const StudyPhaseTransitionModal: React.FC<StudyPhaseTransitionModalProps> = ({
  open,
  stage,
  phaseLabel,
  phaseDescription,
  phaseIndex,
  totalPhases,
  surveyUrl,
  loading = false,
  errorMessage = null,
  onContinue,
}) => {
  const titleByStage: Record<"intro" | "between" | "complete", string> = {
    intro: "Comparative Study",
    between: "Next Phase",
    complete: "Study Complete",
  };

  const actionLabelByStage: Record<"intro" | "between" | "complete", string> = {
    intro: phaseIndex ? `Start Phase ${phaseIndex}` : "Start",
    between: phaseIndex ? `Start Phase ${phaseIndex}` : "Continue",
    complete: "Finish",
  };

  const showPhaseDetails = stage !== "complete" && Boolean(phaseLabel);

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown={loading}
      maxWidth="sm"
      fullWidth
      onClose={(_, reason) => {
        if (loading || reason === "backdropClick") {
          return;
        }
      }}
    >
      <DialogTitle>{titleByStage[stage]}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {showPhaseDetails && (
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 0.8 }}>
                {phaseIndex ? `Phase ${phaseIndex} of ${totalPhases}` : "Upcoming Phase"}
              </Typography>
              <Typography variant="h6">{phaseLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                {phaseDescription}
              </Typography>
            </Box>
          )}

          {stage === "complete" ? (
            <Typography variant="body1">
              You have completed all phases. Please submit the final survey response if you have not done so yet.
            </Typography>
          ) : (
            <Typography variant="body1">
              Before starting this phase, please continue the parallel survey and record your impressions there.
            </Typography>
          )}

          <Typography variant="body2">
            Survey link:{" "}
            <Link href={surveyUrl} target="_blank" rel="noopener noreferrer">
              Open Google Form
            </Link>
          </Typography>

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onContinue} variant="contained" disabled={loading}>
          {actionLabelByStage[stage]}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StudyPhaseTransitionModal;
