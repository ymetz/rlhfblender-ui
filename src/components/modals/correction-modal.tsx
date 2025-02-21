import * as React from "react";
// Material UI
import {
  Button,
  Dialog,
  Grid,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
// Custom Components
import { CustomInput } from "../../custom_env_inputs/custom_input_mapping";
// Types
import { Feedback, FeedbackType } from "../../types";
import { EpisodeFromID } from "../../id";
// Axios
import axios from "axios";

type CorrectionModalProps = {
  open: boolean;
  episodeId?: string;
  step: number;
  frame: string;
  onClose: () => void;
  onCloseSubmit: (feedback: Feedback, step: number) => void;
  custom_input: string;
  sessionId: string;
  inputProps: object;
};

type StepDetails = {
  action_distribution: number[];
  action: number | number[];
  reward: number;
  infos: object;
  action_space: { shape: number[]; label: string } & { [key: string]: any };
};

const MAX_IMAGE_SIZE = 500; // Maximum width or height in pixels

export default function CorrectionModal(props: CorrectionModalProps) {
  const theme = useTheme();
  const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });
  const [feedback, setFeedback] = React.useState<Feedback>({
    targets: [
      {
        target_id: props.episodeId || "",
        reference: EpisodeFromID(props.episodeId || ""),
        step: props.step,
        origin: "offline",
        timestamp: Date.now(),
      },
    ],
    feedback_type: FeedbackType.Corrective,
    granularity: "state",
    timestamp: Date.now(),
    session_id: props.sessionId,
  });
  const [stepDetails, setStepDetails] = React.useState<StepDetails | null>(null);

  // Function to handle image load and calculate dimensions
  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    
    if (width > height) {
      // Landscape orientation
      if (width > MAX_IMAGE_SIZE) {
        width = MAX_IMAGE_SIZE;
        height = width / aspectRatio;
      }
    } else {
      // Portrait orientation
      if (height > MAX_IMAGE_SIZE) {
        height = MAX_IMAGE_SIZE;
        width = height * aspectRatio;
      }
    }
    
    setImageSize({ width, height });
  };

  React.useEffect(() => {
    if (props.episodeId) {
      axios
        .post("/data/get_single_step_details", {
          ...EpisodeFromID(props.episodeId),
          step: props.step,
        })
        .then((response) => {
          setStepDetails(response.data);
        })
        .catch((error) => console.error(error));
    }
  }, [props.episodeId, props.step]);

  const setFeedbackWithAction = (selectedAction: number | number[]) => {
    setFeedback((prevFeedback) => ({
      ...prevFeedback,
      action_preferences: [selectedAction, stepDetails?.action],
    }));
  };

  // Reset state when modal closes
  const handleClose = () => {
    setStepDetails(null);
    setImageSize({ width: 0, height: 0 });
    props.onClose();
  };

  return (
    <Dialog open={props.open} onClose={handleClose}>
      <DialogTitle>
        Correction for: {props.episodeId} - {props.step}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={1}>
          <Grid item xs="auto">
            <img
              src={props.frame}
              alt="frame"
              onLoad={handleImageLoad}
              style={{
                width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
                objectFit: 'contain'
              }}
            />
          </Grid>
          {stepDetails && (
            <Grid item xs>
              <CustomInput
                space={stepDetails.action_space}
                custom_input={props.custom_input}
                inputProps={props.inputProps}
                action={stepDetails.action}
                setFeedback={setFeedbackWithAction}
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          sx={{ color: theme.palette.success.main }}
          disabled={!feedback.action_preferences}
          onClick={() => {
            props.onCloseSubmit(feedback, props.step);
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}