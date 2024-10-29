import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Send from '@mui/icons-material/Send';
import Progressbar from './progressbar';

interface ProgressHeaderProps {
  showProgressBar: boolean;
  numEpisodes: number;
  currentStep: number;
  maxRankingElements: number;
  onSubmit: () => void;
  onSubmitHover: (isHovering: boolean) => void;
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({
  showProgressBar,
  numEpisodes,
  currentStep,
  maxRankingElements,
  onSubmit,
  onSubmitHover,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
      {showProgressBar && (
        <Box
          id="progress-bar"
          sx={{
            display: 'flex',
            flex: 1,
            boxSizing: 'border-box',
            backgroundColor: theme.palette.background.l1,
            padding: 0.5,
          }}
        >
          <Typography
            sx={{
              color: theme.palette.text.secondary,
              m: 0.5,
              minWidth: '10vw',
            }}
          >
            Experiment Progress:
          </Typography>
          <Progressbar
            maxSteps={Math.ceil(numEpisodes / maxRankingElements) ?? 1}
            currentStep={currentStep}
          />
        </Box>
      )}
      <Box sx={{ p: 1, backgroundColor: theme.palette.background.l1 }}>
        <Button
          variant="contained"
          endIcon={<Send />}
          onClick={onSubmit}
          onMouseEnter={() => onSubmitHover(true)}
          onMouseLeave={() => onSubmitHover(false)}
        >
          Submit Feedback
        </Button>
      </Box>
    </Box>
  );
};
