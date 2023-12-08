import * as React from 'react';

// Material UI
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import DialogActions from '@mui/material/DialogActions';
import {CustomInput} from '../../custom_env_inputs/custom_input_mapping';
import {DialogContent, DialogTitle, Typography} from '@mui/material';

// Types
import {Feedback, FeedbackType} from '../../types';

// Our components
import Space from '../spaces/space_mapping';

// Axios
import axios, {AxiosResponse} from 'axios';

// Styling
import {useTheme} from '@mui/material/styles';

type DemoModalProps = {
  open: boolean;
  onClose: () => void;
  onCloseSubmit: (feedback: Feedback) => void;
  custom_input: string;
  activeEnvId: string;
  sessionId: string;
  inputProps: object;
  seed: number;
};

type StepDetails = {
  reward: number;
  done: boolean;
  infos: any;
};

export default function DemoModal(props: DemoModalProps) {
  const [initDemo, setInitDemo] = React.useState<boolean>(false);
  const [processId, setProcessId] = React.useState<number>(-1);
  const [demoNumber, setDemoNumber] = React.useState<number>(0);
  const [renderURL, setRenderURL] = React.useState<string>('');
  const [episodeDone, setEpisodeDone] = React.useState<boolean>(false);
  const [stepDetails, setStepDetails] = React.useState<StepDetails>({
    reward: 0,
    done: false,
    infos: {},
  });
  const [stepCount, setStepCount] = React.useState<number>(0);
  const [actionSpace, setActionSpace] = React.useState<
    {shape: number[]; label: string} & {[key: string]: any}
  >({shape: [], label: ''});
  const theme = useTheme();

  React.useEffect(() => {
    if (initDemo) {
      axios
        .post('/data/initialize_demo_session', {
          env_id: props.activeEnvId,
          seed: props.seed,
          session_id: props.sessionId,
        })
        .then((response: AxiosResponse) => {
          setProcessId(response.data.pid);
          setStepDetails(response.data.step);
          setDemoNumber(response.data.demo_number);
          setEpisodeDone(false);
          setActionSpace(response.data.action_space);
        });
    }
  }, [initDemo, props.activeEnvId, props.sessionId]);

  // Get Render URL from the backend
  React.useEffect(() => {
    if (processId !== -1) {
      axios({
        method: 'get',
        url: 'data/get_demo_image?session_id=' + props.sessionId,
        responseType: 'blob',
      }).then(response => {
        const url = URL.createObjectURL(response.data);
        setRenderURL(url);
      });
    }
  }, [processId, props.sessionId, stepCount]);

  const performAction = (action: number | number[]) => {
    axios
      .post('/data/demo_step', {
        session_id: props.sessionId,
        action: action,
      })
      .then((response: AxiosResponse) => {
        setStepDetails(response.data.step);
        setStepCount(stepCount + 1);
        if (response.data.step.done) {
          setEpisodeDone(true);
        }
      });
  };

  // Function to close the demo session in the backend (when the modal is closed)
  React.useEffect(() => {
    if (!props.open && processId !== -1) {
      axios
        .post('/data/end_demo_session', {
          session_id: props.sessionId,
          pid: processId,
        })
        .then((response: AxiosResponse) => {
          setProcessId(-1);
          setInitDemo(false);
          setRenderURL('');
          setStepCount(0);
        });
    }
  }, [props.open, processId, props.sessionId]);

  return (
    <Dialog open={props.open} onClose={props.onClose}>
      {/* Draw a cornered region in purple, like a folder corner and add the label Correction"*/}
      <DialogTitle>Demo Generation</DialogTitle>
      <DialogContent>
        {!initDemo && (
          <Button
            onClick={() => setInitDemo(true)}
            sx={{color: theme.palette.primary.main}}
          >
            Start Demonstration
          </Button>
        )}
        <Grid container spacing={1}>
          <Grid item xs="auto">
            {initDemo && renderURL && (
              <img
                src={renderURL}
                alt="render"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            )}
            {initDemo && !renderURL && <p>Loading...</p>}
          </Grid>
          {initDemo && !episodeDone && (
            <Grid item xs>
              <CustomInput
                space={actionSpace}
                custom_input={props.custom_input}
                inputProps={props.inputProps}
                setFeedback={performAction}
                needSubmit={false}
                canNextStep={true}
              />
            </Grid>
          )}
          {initDemo && episodeDone && (
            <Grid item xs={12}>
              <p>Episode Done</p>
            </Grid>
          )}
          {stepDetails.infos?.mission && (
            <Grid
              item
              xs={12}
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: theme.palette.background.l1,
                m: 1,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography>{`Mission: ${stepDetails.infos.mission}`}</Typography>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          sx={{color: 'green'}}
          disabled={!episodeDone}
          onClick={() => {
            props.onCloseSubmit({
              feedback_type: FeedbackType.Demonstrative,
              targets: [
                {
                  target_id:
                    props.activeEnvId +
                    '_generated_-1-1' +
                    demoNumber.toString(),
                  reference: {
                    env_name: props.activeEnvId,
                    benchmark_type: 'generated',
                    benchmark_id: -1,
                    checkpoint_step: -1,
                    episode_num: demoNumber,
                  },
                  origin: 'generated',
                  timestamp: Date.now(),
                },
              ],
              granularity: 'episode',
              timestamp: Date.now(),
              session_id: props.sessionId,
            } as Feedback);
            props.onClose();
          }}
        >
          Submit Demonstration
        </Button>
      </DialogActions>
    </Dialog>
  );
}
