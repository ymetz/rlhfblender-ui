import React from 'react';
import { Box } from '@mui/material';
import { Line, Bar, LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { GridRows, GridColumns } from '@visx/grid';
import { scaleLinear } from '@visx/scale';
import { withTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { max, extent, bisector } from 'd3-array';
import { localPoint } from '@visx/event';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { ParentSize } from '@visx/responsive';

  
// Accessors - with safety checks
const getStep = d => (d && d.step !== undefined) ? d.step : 0;
const getReward = d => (d && d.reward !== undefined) ? d.reward : 0;
const getUncertainty = d => (d && d.uncertainty !== undefined) ? d.uncertainty : 0;
const bisectData = bisector(d => getStep(d)).left;

// Colors
const backgroundColor = '#ffffff';
const gridColor = '#f0f0f0';
const rewardColor = '#F5B700'; // Gold
const uncertaintyColor = '#4071AD'; // Light blue
const tooltipStyles = {
  ...defaultStyles,
  background: 'white',
  border: '1px solid #ddd',
  color: 'black',
  fontSize: '12px',
  padding: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  borderRadius: '4px'
};

// Chart component
const Chart = withTooltip(
  ({
    data,
    width,
    height,
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  }) => {
    // Margins - adjusted to give more room at the bottom
    const margin = { top: 20, right: 40, bottom: 40, left: 60 };
    
    // Bounds
    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    
    // Scales
    const xScale = scaleLinear({
      range: [0, innerWidth],
      domain: extent(data, getStep),
      nice: true,
    });

    const rewardScale = scaleLinear({
      range: [innerHeight, 0],
      domain: [0, Math.max(max(data, getReward) * 1.1, 1.0)],
      nice: true,
    });

    const uncertaintyScale = scaleLinear({
      range: [innerHeight, 0],
      domain: [0, Math.max(max(data, getUncertainty) * 1.1, 0.5)],
      nice: true,
    });

    // Tooltip handler
    const handleTooltip = (event) => {
      const { x } = localPoint(event) || { x: 0 };
      const x0 = xScale.invert(x - margin.left);
      const index = bisectData(data, x0);
      
      if (index <= 0 || index >= data.length) {
        return; // Protect against out-of-bounds indices
      }
      
      const d0 = data[index - 1];
      const d1 = data[index];
      
      let d = d0;
      if (d1 && getStep(d1)) {
        d = x0 - getStep(d0) > getStep(d1) - x0 ? d1 : d0;
      }

      showTooltip({
        tooltipData: d,
        tooltipLeft: xScale(getStep(d)) + margin.left,
        tooltipTop: rewardScale(getReward(d)) + margin.top,
      });
    };

    // If no data or dimensions, return null
    if (innerWidth < 0 || innerHeight < 0 || !data || data.length === 0) return null;

    return (
      <>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <svg width={width} height={height - 10}>
            <rect
              x={0}
              y={0}
              width={width}
              height={height - 25}
              fill={backgroundColor}
              rx={6}
            />
            
            <Group left={margin.left} top={margin.top}>
              {/* Grid */}
              <GridRows
                scale={rewardScale}
                width={innerWidth}
                strokeDasharray="2,2"
                stroke={gridColor}
                strokeOpacity={0.6}
                pointerEvents="none"
                numTicks={5}
              />
              <GridColumns
                scale={xScale}
                height={innerHeight}
                strokeDasharray="2,2"
                stroke={gridColor}
                strokeOpacity={0.6}
                pointerEvents="none"
                numTicks={5}
              />
              
              {/* Axes */}
              <AxisLeft
                scale={rewardScale}
                label="Reward Model"
                labelProps={{
                  fill: '#333',
                  fontSize: 14,
                  textAnchor: 'middle',
                  fontFamily: 'sans-serif'
                }}
                stroke="#333"
                tickStroke="#333"
                tickLabelProps={() => ({
                  fill: '#333',
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  textAnchor: 'end',
                  dy: '0.33em'
                })}
                numTicks={5}
              />
              
              <AxisBottom
                top={innerHeight}
                scale={xScale}
                label="Checkpoint Step"
                labelProps={{
                  fill: '#333',
                  fontSize: 14, 
                  textAnchor: 'middle',
                  fontFamily: 'sans-serif'
                }}
                stroke="#333"
                tickStroke="#333"
                tickLabelProps={() => ({
                  fill: '#333',
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  textAnchor: 'middle',
                  dy: '0.33em'
                })}
                tickFormat={val => `${Math.round(val / 1000)}K`}
                numTicks={5}
              />
              
              {/* Reward Line */}
              <LinePath
                data={data}
                x={d => xScale(getStep(d))}
                y={d => rewardScale(getReward(d))}
                stroke={rewardColor}
                strokeWidth={2.5}
                curve={curveMonotoneX}
              />
              
              {/* Uncertainty Line */}
              <LinePath
                data={data}
                x={d => xScale(getStep(d))}
                y={d => uncertaintyScale(getUncertainty(d))}
                stroke={uncertaintyColor}
                strokeWidth={2.5}
                curve={curveMonotoneX}
              />
              
              {/* Tooltip overlay */}
              <Bar
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onTouchStart={handleTooltip}
                onTouchMove={handleTooltip}
                onMouseMove={handleTooltip}
                onMouseLeave={() => hideTooltip()}
              />
              
              {/* Tooltip indicator */}
              {tooltipData && (
                <>
                  <Line
                    from={{ x: xScale(getStep(tooltipData)), y: 0 }}
                    to={{ x: xScale(getStep(tooltipData)), y: innerHeight }}
                    stroke="#333"
                    strokeWidth={1}
                    pointerEvents="none"
                    strokeDasharray="4,2"
                  />
                  <circle
                    cx={xScale(getStep(tooltipData))}
                    cy={rewardScale(getReward(tooltipData))}
                    r={5}
                    fill={rewardColor}
                    stroke="white"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                  <circle
                    cx={xScale(getStep(tooltipData))}
                    cy={uncertaintyScale(getUncertainty(tooltipData))}
                    r={5}
                    fill={uncertaintyColor}
                    stroke="white"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                </>
              )}
            </Group>
            
            {/* Chart Title */}
            <text
              x={width / 2}
              y={15}
              textAnchor="middle"
              fontFamily="sans-serif"
              fontSize={16}
              fontWeight="bold"
              fill="#333"
            >
              Training Progress with Uncertainty
            </text>
          </svg>
          
          {/* Legend below the chart */}
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            height: 25,
            display: 'flex', 
            flexDirection: 'row',
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: 30
          }}>
            {/* Reward legend item */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 3, backgroundColor: rewardColor, borderRadius: 2 }}></div>
              <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#333' }}>Predicted Reward</span>
            </div>
            
            {/* Uncertainty legend item */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 3, backgroundColor: uncertaintyColor, borderRadius: 2 }}></div>
              <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#333' }}>Uncertainty</span>
            </div>
          </div>
          
          {/* Tooltip */}
          {tooltipData && (
            <TooltipWithBounds
              key={Math.random()}
              top={tooltipTop - 40}
              left={tooltipLeft + 12}
              style={tooltipStyles}
            >
              <div style={{ fontWeight: 'bold' }}>Checkpoint: {Math.round(getStep(tooltipData) / 1000)}K</div>
              <div style={{ color: rewardColor, fontWeight: 'bold' }}>
                Reward: {getReward(tooltipData).toFixed(3)}
              </div>
              <div style={{ color: uncertaintyColor, fontWeight: 'bold' }}>
                Uncertainty: {getUncertainty(tooltipData).toFixed(3)}
              </div>
            </TooltipWithBounds>
          )}
        </div>
      </>
    );
  }
);

// Main component that follows the pattern from reference code
const ImprovedProgressChart = ({ steps, rewards, uncertainties, title }) => {
  // Generate default data if none provided
  const chartData =
    rewards && uncertainties
      ? steps.map((step, index) => ({
          step: step,
          reward: rewards[index] || 0,
          uncertainty: uncertainties[index] || 0
        })) : [
          {step: 0, reward: 0, uncertainty: 0},
        ];

  console.log("Chart Data:", chartData);
  
  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        maxHeight: '100%', // Important to prevent growth
        overflow: 'hidden'  // Prevent overflow
      }}
    >
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <Chart 
            data={chartData}
            title={title || "Training Progress with Uncertainty"}
            width={width} 
            height={height}
          />
        )}
      </ParentSize>
    </Box>
  );
};

export default ImprovedProgressChart;