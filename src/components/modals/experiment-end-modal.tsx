import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { Divider } from "@mui/material";

type ExperimentStartModalProps = {
  open: boolean;
};

export default function ExperimentStartModal(props: ExperimentStartModalProps) {
  return (
    <div>
      <Dialog open={props.open}>
        <DialogTitle>RLHF-Blender: Instructions</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            Thank you for participating in our study! Please follow this link to
            get to the post-experiment questionnaire. Finishing this
            questionaire should take no more than 5 minutes.
            <Divider />
            <Typography variant="h6">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLScE7s3EOEQL0p5Ky3B_S8gBYAx-FTCh4VucRNoY41an1nmMYw/viewform?usp=sf_link">
                Post-Experiment Questionnaire
              </a>
            </Typography>
            <Divider />
            You can close this page after finishing the questionnaire.
          </DialogContentText>
        </DialogContent>
      </Dialog>
    </div>
  );
}
