import * as React from 'react';

// Material UI
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Grid from '@mui/material/Grid';
import DialogActions from '@mui/material/DialogActions';
import {CustomInput} from '../custom_env_inputs/custom_input_mapping';
import {DialogContent, DialogTitle} from '@mui/material';

// Types
import {Episode, Feedback} from '../types';
import {EpisodeFromID} from '../id';

// Our components
import Space from './spaces/space_mapping';

// Axios
import axios, {AxiosResponse} from 'axios';

type DemoModalProps = {
  open: boolean;
  episodeId: string;
  step: number;
  frame: string;
  onClose: () => void;
  onCloseSubmit: (feedback: Feedback, step: number) => void;
  custom_input: string;
  inputProps: object;
};

type StepDetails = {
  action_distribution: number[];
  action: number | number[];
  reward: number;
  infos: object;
  action_space: {shape: number[]; label: string} & {[key: string]: string};
};

export default function DemoModal(props: DemoModalProps) {
  const [feedback, setFeedback] = React.useState<Feedback>({
    target: {episode: EpisodeFromID(props.episodeId || ''), step: props.step},
    numeric_feedback: 0,
    timestamp: '',
  });
  const [stepDetails, setStepDetails] = React.useState<StepDetails>({
    action_distribution: [],
    action: 0,
    reward: 0,
    action_space: {shape: [], label: ''},
    infos: {},
  });

  // Retreive details for the particular step of the episode by calling "/get_single_step_details" with the episode ID and step number
  React.useEffect(() => {
    axios
      .post('/data/get_single_step_details', {
        ...EpisodeFromID(props.episodeId || ''),
        step: props.step,
      })
      .then((response: AxiosResponse) => {
        setStepDetails(response.data);
      })
      .catch(error => {
        console.log(error);
      });
  }, [props.episodeId, props.step]);

  return (
    <Dialog open={props.open} onClose={props.onClose}>
      <div
        style={{
          backgroundColor: 'purple',
          height: '10px',
          width: '100%',
          marginBottom: '10px',
        }}
      ></div>
      {/* Draw a cornered region in purple, like a folder corner and add the label Correction"*/}
      <DialogTitle>
        Correction for: {props.episodeId} - {props.step}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing="1">
          <Grid item xs={6}>
            <img src={props.frame} height="200px" alt="frame" />
          </Grid>
          <Grid item xs={6}>
            <Space
              space={stepDetails?.action_space || {}}
              spaceProps={{
                width: 200,
                height: 200,
                action: stepDetails?.action || 0,
                distribution: stepDetails?.action_distribution || [],
                actionSpace: stepDetails?.action_space,
              }}
            />
          </Grid>
          <Grid item xs={12} alignContent={'center'}>
            <CustomInput
              space={stepDetails?.action_space || {}}
              custom_input={props.custom_input}
              inputProps={props.inputProps}
              action={stepDetails?.action}
              setFeedback={setFeedback}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          sx={{color: 'green'}}
          onClick={() => props.onCloseSubmit(feedback, props.step)}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
