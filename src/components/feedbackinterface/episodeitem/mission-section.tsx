import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface MissionSectionProps {
    mission?: string;
  }
  
  const MissionSection: React.FC<MissionSectionProps> = ({
    mission,
  }) => {
    const theme = useTheme();
  
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: '10px',
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
      </Box>
    );
  };

export default MissionSection;