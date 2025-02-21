import * as React from "react";

// Material UI
import {
  Button,
  Dialog,
  Grid,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

// Custom Components
import { CustomInput } from "../../custom_env_inputs/custom_input_mapping";

// Types
import { Feedback, FeedbackType, GymSpaceInfo } from "../../types";

// Axios
import axios from "axios";

type DemoModalProps = {
  open: boolean;
  onClose: () => void;
  onCloseSubmit: (feedback: Feedback) => void;
  custom_input: string;
  activeExpId: number;
  activeEnvId: string;
  sessionId: string;
  inputProps: object;
  seed: number;
};

type StepDetails = {
  reward: number;
  done: boolean;
  infos: { mission?: string };
};

const MAX_IMAGE_SIZE = 500; // Maximum width or height in pixels

export default function DemoModal(props: DemoModalProps) {
  const [initDemo, setInitDemo] = React.useState(false);
  const [processId, setProcessId] = React.useState(-1);
  const [demoNumber, setDemoNumber] = React.useState(0);
  const [renderURL, setRenderURL] = React.useState("");
  const [episodeDone, setEpisodeDone] = React.useState(false);
  const [stepDetails, setStepDetails] = React.useState<StepDetails>({
    reward: 0,
    done: false,
    infos: {},
  });
  const [mission, setMission] = React.useState("");
  const [stepCount, setStepCount] = React.useState(0);
  const [actionSpace, setActionSpace] = React.useState({
    label: "",
    dtype: "int",
    shape: [0],
    labels: {},
  } as GymSpaceInfo);
  const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });
  const theme = useTheme();

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
    if (initDemo) {
      axios
        .post("/data/initialize_demo_session", {
          exp_id: props.activeExpId,
          env_id: props.activeEnvId,
          seed: props.seed,
          session_id: props.sessionId,
        })
        .then((response) => {
          setProcessId(response.data.pid);
          setStepDetails(response.data.step);
          setDemoNumber(response.data.demo_number);
          setEpisodeDone(false);
          setActionSpace(response.data.action_space);
          if (response.data.step.infos.mission) {
            setMission(response.data.step.infos.mission);
          }
        });
    }
  }, [initDemo, props.activeEnvId, props.activeExpId, props.seed, props.sessionId]);

  React.useEffect(() => {
    if (processId !== -1) {
      axios
        .get(`data/get_demo_image?session_id=${props.sessionId}`, {
          responseType: "blob",
        })
        .then((response) => {
          const url = URL.createObjectURL(response.data);
          setRenderURL(url);
        });
    }
  }, [processId, props.sessionId, stepCount]);

  const performAction = (action: number | number[]) => {
    axios
      .post("/data/demo_step", {
        session_id: props.sessionId,
        action,
      })
      .then((response) => {
        setStepDetails(response.data.step);
        setStepCount(stepCount + 1);
        setEpisodeDone(response.data.step.done);
        if (response.data.step.infos.mission) {
          setMission(response.data.step.infos.mission);
        }
      });
  };

  React.useEffect(() => {
    if (!props.open && processId !== -1) {
      axios
        .post("/data/end_demo_session", {
          session_id: props.sessionId,
          pid: processId,
        })
        .then(() => {
          setProcessId(-1);
          setInitDemo(false);
          setRenderURL("");
          setStepCount(0);
          setMission("");
          setImageSize({ width: 0, height: 0 });
        });
    }
  }, [props.open, processId, props.sessionId]);

  return (
    <Dialog
      open={props.open}
      onClose={() => {
        setInitDemo(false);
        props.onClose();
      }}
    >
      <DialogTitle>Demo Generation</DialogTitle>
      <DialogContent>
        {!initDemo && (
          <Button
            onClick={() => setInitDemo(true)}
            sx={{ color: theme.palette.primary.main }}
          >
            Start Demonstration
          </Button>
        )}
        <Grid container spacing={1}>
          <Grid item xs="auto">
            {initDemo && renderURL ? (
              <img
                src={renderURL}
                alt="render"
                onLoad={handleImageLoad}
                style={{
                  width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                  height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <Typography variant="body2" color="textSecondary">
                Loading...
              </Typography>
            )}
          </Grid>
          {initDemo && !episodeDone && (
            <Grid item xs>
              <CustomInput
                space={actionSpace}
                custom_input={props.custom_input}
                inputProps={props.inputProps}
                setFeedback={performAction}
              />
            </Grid>
          )}
          {initDemo && episodeDone && (
            <Grid item xs={12}>
              <Typography variant="body2">Episode Done</Typography>
            </Grid>
          )}
          {mission && (
            <Grid
              item
              xs={12}
              sx={{
                width: "100%",
                backgroundColor: theme.palette.background.l1,
                m: 1,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography>{`Mission: ${mission}`}</Typography>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          sx={{ color: theme.palette.success.main }}
          disabled={!episodeDone}
          onClick={() => {
            props.onCloseSubmit({
              feedback_type: FeedbackType.Demonstrative,
              targets: [
                {
                  target_id: `${props.activeEnvId}_generated_-1-1${demoNumber}`,
                  reference: {
                    env_name: props.activeEnvId,
                    benchmark_type: "generated",
                    benchmark_id: -1,
                    checkpoint_step: -1,
                    episode_num: demoNumber,
                  },
                  origin: "generated",
                  timestamp: Date.now(),
                },
              ],
              granularity: "episode",
              timestamp: Date.now(),
              session_id: props.sessionId,
            });
            setInitDemo(false);
            props.onClose();
          }}
        >
          Submit Demonstration
        </Button>
      </DialogActions>
    </Dialog>
  );
}