import React from 'react';
import { Box, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DemoIcon from '../../../icons/demo-icon';

interface DemoSectionProps {
  showDemo: boolean;
  onDemoClick: () => void;
  hasDemoFeedback: boolean;
}

const DemoSection: React.FC<DemoSectionProps> = ({ showDemo, onDemoClick, hasDemoFeedback }) => {
  const theme = useTheme();

  if (!showDemo) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gridArea: 'demo',
      }}
    >
      <Box
        sx={{
          p: 1,
          m: 1,
          backgroundColor: theme.palette.background.l1,
          overflow: 'hidden',
        }}
      >
        <Button
          variant="contained"
          onClick={onDemoClick}
          sx={{
            boxShadow: hasDemoFeedback
              ? `0px 0px 20px 0px ${theme.palette.primary.main}`
              : 'none',
          }}
          endIcon={<DemoIcon color={theme.palette.primary.contrastText} />}
        >
          Demo
        </Button>
      </Box>
    </Box>
  );
};

export default DemoSection;