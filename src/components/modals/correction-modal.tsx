import * as React from 'react';

// Material UI
import {
  Button,
  Dialog,
  Grid,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Custom Components
import { CustomInput } from '../../custom_env_inputs/custom_input_mapping';

// Types
import { Feedback, FeedbackType } from '../../types';
import { EpisodeFromID } from '../../id';

// Axios
import axios from 'axios';

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

export default function CorrectionModal(props: CorrectionModalProps) {
  const theme = useTheme();
  const [feedback, setFeedback] = React.useState<Feedback>({
    targets: [
      {
        target_id: props.episodeId || '',
        reference: EpisodeFromID(props.episodeId || ''),
        step: props.step,
        origin: 'offline',
        timestamp: Date.now(),
      },
    ],
    feedback_type: FeedbackType.Corrective,
    granularity: 'state',
    timestamp: Date.now(),
    session_id: props.sessionId,
  });
  const [stepDetails, setStepDetails] = React.useState<StepDetails | null>(null);

  React.useEffect(() => {
    if (props.episodeId) {
      axios
        .post('/data/get_single_step_details', {
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

  return (
    <Dialog
      open={props.open}
      onClose={() => {
        setStepDetails(null);
        props.onClose();
      }}
    >
      <DialogTitle>Correction for: {props.episodeId} - {props.step}</DialogTitle>
      <DialogContent>
        <Grid container spacing={1}>
          <Grid item xs="auto">
            <img src={props.frame} alt="frame" style={{ width: '100%', height: '100%' }} />
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
        <Button onClick={() => {
          setStepDetails(null);
          props.onClose();
        }}>
          Cancel
        </Button>
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
