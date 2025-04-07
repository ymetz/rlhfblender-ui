import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

// Import dummy components
import ProgressChart from './ProgressChart';
import ProjectionComponent from './ProjectionComponent';
import SelectionView from './SelectionView';
import FeedbackInput from './FeedbackInput';

const ActiveLearningInterface = () => {


  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100%',
        minHeight: '600px',
      }}
    >
      {/* Left sidebar - 20% width with 2 charts stacked */}
      <Box
        sx={{
          width: '20%',
          display: 'flex',
          flexDirection: 'column',
          p: 1,
        }}
      >
        <Paper
          elevation={2}
          sx={{
            flex: 1,
            mb: 1,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h6" gutterBottom>Progress Chart 1</Typography>
          <Box sx={{ flex: 1 }}>
            <ProgressChart
              data={[
                { x: 1, y: 5 },
                { x: 2, y: 10 },
                { x: 3, y: 7 },
                { x: 4, y: 12 },
                { x: 5, y: 9 },
              ]}
              title="Rewards"
            />
          </Box>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            flex: 1,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h6" gutterBottom>Progress Chart 2</Typography>
          <Box sx={{ flex: 1 }}>
            <ProgressChart
              data={[
                { x: 1, y: 8 },
                { x: 2, y: 3 },
                { x: 3, y: 9 },
                { x: 4, y: 6 },
                { x: 5, y: 11 },
              ]}
              title="Uncertainty"
            />
          </Box>
        </Paper>
      </Box>

      {/* Middle section - 50% width with WebGL component */}
      <Box
        sx={{
          width: '50%',
          p: 1,
        }}
      >
        <Paper
          elevation={2}
          sx={{
            height: '100%',
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h6" gutterBottom>WebGL Viewer</Typography>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ProjectionComponent
                width="100%"
                height="100%"
            />
          </Box>
        </Paper>
      </Box>

      {/* Right section - 30% width with 2 rows */}
      <Box
        sx={{
          width: '30%',
          display: 'flex',
          flexDirection: 'column',
          p: 1,
        }}
      >
        <Paper
          elevation={2}
          sx={{
            flex: 1,
            mb: 1,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h6" gutterBottom>Feedback Panel</Typography>
          <SelectionView />
        </Paper>

        <Paper
          elevation={2}
          sx={{
            flex: 1,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Typography variant="h6" gutterBottom>Control Panel</Typography>
          <FeedbackInput />
        </Paper>
      </Box>
    </Box>
  );
};

export default ActiveLearningInterface;