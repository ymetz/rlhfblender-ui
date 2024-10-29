import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TextFeedback from './text-feedback';
import { Feedback } from '../../../types';

interface MissionSectionProps {
    mission?: string;
    showTextFeedback: boolean;
    scheduleFeedback: (feedback: Feedback) => void;
    episodeId: string;
    sessionId: string;
  }
  
  const MissionSection: React.FC<MissionSectionProps> = ({
    mission,
    showTextFeedback,
    scheduleFeedback,
    episodeId,
    sessionId,
  }) => {
    const theme = useTheme();
  
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: '10px',
          backgroundColor: theme.palette.background.l0,
          border: `1px solid ${theme.palette.divider}`,
          m: 1,
          p: 1,
          overflow: 'hidden',
          gridArea: 'mission',
        }}
      >
        {mission && (
          <Typography color={theme.palette.text.primary}>
            Mission: {mission}
          </Typography>
        )}
        {showTextFeedback && (
          <TextFeedback
            scheduleFeedback={scheduleFeedback}
            episodeId={episodeId}
            sessionId={sessionId}
          />
        )}
      </Box>
    );
  };

export default MissionSection;