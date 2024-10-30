import React, { useState } from 'react';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type WelcomeModalProps = {
  open: boolean;
  onClose: () => void;
  studyCode: string;
};

export default function StudyCodeModal(props: WelcomeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.studyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset the tooltip after 2 seconds
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const getBaseURL = () => {
    return window.location.href.split('?')[0];
  }

  return (
    <div>
      <Dialog open={props.open} onClose={props.onClose}>
        <DialogTitle>Study Code</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            <Typography gutterBottom sx={{ padding: '10px' }}>
              Your Study Code:
            </Typography>
            <Typography gutterBottom sx={{ padding: '10px', display: 'flex', alignItems: 'center' }}>
              {props.studyCode}
              <Tooltip title={copied ? "Copied!" : "Copy to clipboard"} arrow>
                <IconButton onClick={handleCopy}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Typography>
            <Typography gutterBottom sx={{ padding: '10px' }}>
                You can fine the study under the following link: <a href={getBaseURL() + '?study=' + props.studyCode}>{getBaseURL() + '?study=' + props.studyCode}</a>
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={props.onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}