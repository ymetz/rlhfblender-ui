import React from 'react';
import { Box } from '@mui/material';
import { LinePath, XAxis, YAxis, Grid } from '@visx/visx';
import { scaleLinear } from '@visx/scale';
import { extent } from 'd3-array';

const ProgressChart = ({ data, title }) => {
  // Set up dimensions
  const width = '100%';
  const height = '100%';
  const margin = { top: 20, right: 20, bottom: 30, left: 30 };

  // Create scales
  const xMax = 100 - margin.left - margin.right;
  const yMax = 100 - margin.top - margin.bottom;
  
  // Define accessors
  const getX = d => d.x;
  const getY = d => d.y;
  
  // Create scales from data
  const xScale = scaleLinear({
    domain: extent(data, getX),
    range: [0, xMax],
  });
  
  const yScale = scaleLinear({
    domain: extent(data, getY),
    range: [yMax, 0],
  });
  
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* This would be a visx chart in a real implementation */}
      <Box 
        sx={{ 
          width: '100%', 
          height: '100%', 
          background: 'linear-gradient(45deg, #f0f0f0 25%, #e0e0e0 25%, #e0e0e0 50%, #f0f0f0 50%, #f0f0f0 75%, #e0e0e0 75%)',
          backgroundSize: '20px 20px',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Dummy Chart Visualization */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box 
            sx={{ 
              width: '80%', 
              height: '2px', 
              background: 'linear-gradient(90deg, #2196f3, #4caf50)'
            }} 
          />
          {/* Draw dots to represent data points */}
          {data.map((d, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                left: `${10 + (d.x / 5) * 80}%`,
                top: `${100 - (d.y / 12) * 80}%`,
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#2196f3',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </Box>
        {/* Chart Label */}
        <Box 
          sx={{ 
            position: 'absolute', 
            bottom: 5, 
            left: '50%', 
            transform: 'translateX(-50%)',
            fontSize: '0.75rem',
            color: '#666',
          }}
        >
          {title}
        </Box>
      </Box>
    </Box>
  );
};

export default ProgressChart;