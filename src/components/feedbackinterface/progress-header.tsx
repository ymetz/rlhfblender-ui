import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Send from '@mui/icons-material/Send';
import Progressbar from './progressbar';
import UserInstruction from './user-instruction';

interface ProgressHeaderProps {
  showProgressBar: boolean;
  numEpisodes: number;
  currentStep: number;
  progressSteps: number;
  onSubmit: () => void;
  onSubmitHover: (isHovering: boolean) => void;
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({
  showProgressBar,
  currentStep,
  progressSteps,
  onSubmit,
  onSubmitHover,
}) => {
  const theme = useTheme();

  return (
    <Box 
      sx={{ 
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.l1,
        padding: 2,
        gap: 1
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%'
      }}>
        {showProgressBar && (
          <Box
            id="progress-section"
            sx={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              marginRight: 2
            }}
          >
            <Typography
              sx={{
                color: theme.palette.text.secondary,
                marginRight: 2,
                minWidth: 'fit-content'
              }}
            >
              Experiment Progress:
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Progressbar
                maxSteps={progressSteps ?? 1}
                currentStep={currentStep}
              />
            </Box>
          </Box>
        )}
        <Box>
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
      <Box sx={{ 
        borderTop: `1px solid ${theme.palette.divider}`,
        paddingTop: 1,
        display: 'flex',
        justifyContent: 'center'

      }}>
        <UserInstruction />
      </Box>
    </Box>
  );
};