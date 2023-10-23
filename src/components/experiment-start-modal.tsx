import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import {Divider, Stack} from '@mui/material';

type ExperimentStartModalProps = {
  open: boolean;
  onClose: () => void;
  content: React.ReactNode | string | undefined;
  feedbackComponents: {[key: string]: boolean};
  toggleAppMode: () => void;
};

export default function ExperimentStartModal(props: ExperimentStartModalProps) {
  return (
    <div>
      <Dialog open={props.open} onClose={props.onClose}>
        <DialogTitle>RLHF-Blender: Instructions</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            Welcome to the experiment! Please watch the following video to get
            an introduction to the interface:
          </DialogContentText>
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/u5Ey8KojoiY?si=O3KxwcHiSe_P8tTs"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen="allowFullScreen"
          ></iframe>
          {props.content}
          <DialogContentText>
            <Divider></Divider>
            <DialogContent dividers>
              {/* based on the available feedbackComponents (props.feedbackComponents), add an explanation for each active one*/}
              <DialogContentText>
                You have the following options to provide feedback for
                interactive training
              </DialogContentText>
              <Stack direction="row" spacing={10}>
                {Object.entries(props.feedbackComponents ?? {})
                  ?.filter(([_, v]) => v)
                  .map(([key, _]) => {
                    return (
                      <div key={key}>
                        <Typography
                          gutterBottom
                          sx={{padding: '10px'}}
                          align="center"
                          fontWeight={600}
                        >
                          {key}
                        </Typography>
                        {/*Render an image with a description text for each feedback component*/}
                        <img
                          src={'/files/' + key + '.png'}
                          alt={key}
                          width="200"
                          height="200"
                        ></img>
                        <Typography
                          gutterBottom
                          sx={{padding: '10px'}}
                          align="center"
                        >
                          {key === 'rating'
                            ? 'Rate episodes by using the slider. This feedback is always given for entire episodes.'
                            : ''}
                          {key === 'ranking'
                            ? 'Drag & Drop Episodes to rank them. You can also rank multiple episodes equally.'
                            : ''}
                          {key === 'correction'
                            ? 'Select a specific step. You can open the correction window by clicking.'
                            : ''}
                          {key === 'featureSelection'
                            ? 'Open the feature selection window by clicking the pen in the rendering window. You can select relevant features via brushing.'
                            : ''}
                          {key === 'demonstration'
                            ? 'Demonstrate a sequence of steps by selecting an action and wait for the next step'
                            : ''}
                        </Typography>
                      </div>
                    );
                  })}
              </Stack>
            </DialogContent>
            <Divider></Divider>
            <Typography gutterBottom sx={{padding: '10px'}}>
              Data Protection and Privacy:
            </Typography>
            <Typography gutterBottom sx={{padding: '10px'}}>
              By clicking "Agree" you agree to participate in this study. With
              your participation in this study, you agree that your data will be
              used for research purposes only. Your data will be stored
              anonymously and will not be passed on to third parties. You can
              withdraw your consent at any time by contacting the study
              supervisor.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={props.onClose}>Agree</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
