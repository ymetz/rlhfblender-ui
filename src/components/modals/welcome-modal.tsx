import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import {Typography} from '@mui/material';

type WelcomeModalProps = {
  open: boolean;
  onClose: () => void;
  content: string;
};

export default function WelcomeModal(props: WelcomeModalProps) {
  return (
    <div>
      <Dialog open={props.open} onClose={props.onClose}>
        <DialogTitle>Welcome at the RLHF Blender Web Demo</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>Find the paper here:</DialogContentText>
          <DialogContentText>{props.content}</DialogContentText>
        </DialogContent>
        <DialogContentText>
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
        <DialogActions>
          <Button onClick={props.onClose}>Agree</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
