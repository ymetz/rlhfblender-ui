import React from 'react';
import { Box } from '@mui/material';
import { AreaClosed, Line, Bar } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { GridRows, GridColumns } from '@visx/grid';
import { scaleLinear } from '@visx/scale';
import { withTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { LinearGradient } from '@visx/gradient';
import { max, extent, bisector } from 'd3-array';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';

// Accessors
const getX = (d) => d.x;
const getY = (d) => d.y;
const bisectData = bisector((d) => d.x).left;

// Custom styling
const background = '#ffffff';
const background2 = '#ffffff';
const accentColor = '#4071ad';
const accentColorDark = '#4071ad';
const tooltipStyles = {
  ...defaultStyles,
  background,
  border: '1px solid white',
  color: 'black',
  fontSize: '10px',
  padding: '5px',
};

// Chart content separate from sizing logic
const Chart = withTooltip(
  ({
    data,
    title,
    width,
    height,
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  }) => {
    // Margins for the chart
    const margin = { top: 20, right: 10, bottom: 20, left: 30 };
    
    // Calculate bounds
    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    
    // Don't render if we don't have valid dimensions or data
    if (innerWidth < 0 || innerHeight < 0 || !data || data.length === 0) {
      return null;
    }

    // Scales
    const xScale = scaleLinear({
      range: [margin.left, innerWidth + margin.left],
      domain: extent(data, getX),
      nice: true,
    });

    const yScale = scaleLinear({
      range: [innerHeight + margin.top, margin.top],
      domain: [0, max(data, getY) * 1.1], // Add some padding
      nice: true,
    });

    // Tooltip handler
    const handleTooltip = (event) => {
      const { x } = localPoint(event) || { x: 0 };
      const x0 = xScale.invert(x);
      const index = bisectData(data, x0, 1);
      
      if (index < 1) return;
      
      const d0 = data[index - 1];
      const d1 = data[index] || d0;
      let d = d0;
      
      if (d1 && getX(d1)) {
        d = x0 - getX(d0) > getX(d1) - x0 ? d1 : d0;
      }
      
      showTooltip({
        tooltipData: d,
        tooltipLeft: x,
        tooltipTop: yScale(getY(d)),
      });
    };

    return (
      <>
        <svg width={width} height={height} overflow="visible">
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#area-background-gradient)"
            rx={6}
          />
          <LinearGradient id="area-background-gradient" from={background} to={background2} />
          <LinearGradient id="area-gradient" from={accentColor} to={accentColor} toOpacity={0.1} />
          
          {/* Grid */}
          <GridRows
            left={margin.left}
            scale={yScale}
            width={innerWidth}
            strokeDasharray="1,3"
            stroke={accentColor}
            strokeOpacity={0.2}
            pointerEvents="none"
            numTicks={3}
          />
          <GridColumns
            top={margin.top}
            scale={xScale}
            height={innerHeight}
            strokeDasharray="1,3"
            stroke={accentColor}
            strokeOpacity={0.2}
            pointerEvents="none"
            numTicks={Math.min(data.length, 5)}
          />
          
          {/* Area Chart */}
          <AreaClosed
            data={data}
            x={(d) => xScale(getX(d))}
            y={(d) => yScale(getY(d))}
            yScale={yScale}
            strokeWidth={1.5}
            stroke="url(#area-gradient)"
            fill="url(#area-gradient)"
            curve={curveMonotoneX}
          />
          
          {/* Tooltip overlay */}
          <Bar
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            rx={6}
            onTouchStart={handleTooltip}
            onTouchMove={handleTooltip}
            onMouseMove={handleTooltip}
            onMouseLeave={() => hideTooltip()}
          />
          
          {/* Tooltip indicator */}
          {tooltipData && (
            <g>
              <Line
                from={{ x: tooltipLeft, y: margin.top }}
                to={{ x: tooltipLeft, y: innerHeight + margin.top }}
                stroke={accentColorDark}
                strokeWidth={1}
                pointerEvents="none"
                strokeDasharray="3,2"
              />
              <circle
                cx={tooltipLeft}
                cy={tooltipTop}
                r={3}
                fill={accentColorDark}
                stroke="white"
                strokeWidth={1}
                pointerEvents="none"
              />
            </g>
          )}
          
          {/* Axes */}
          <g transform={`translate(0, ${innerHeight + margin.top})`}>
            {data.filter((d, i) => i % 2 === 0 || data.length <= 5).map((d) => (
              <text
                key={`x-${d.x}`}
                x={xScale(getX(d))}
                y={12}
                fontSize={8}
                textAnchor="middle"
                fill="white"
              >
                {d.x}
              </text>
            ))}
          </g>
          <g transform={`translate(${margin.left - 2}, 0)`}>
            {yScale.ticks(3).map((tick) => (
              <text
                key={`y-${tick}`}
                x={-4}
                y={yScale(tick)}
                dy=".32em"
                fontSize={8}
                textAnchor="end"
                fill="white"
              >
                {tick}
              </text>
            ))}
          </g>
          
          {/* Title */}
          <text
            x={width / 2}
            y={margin.top}
            textAnchor="middle"
            fontSize={margin.top}
            fill="black"
            fontWeight="bold"
            fontFamily='ans-serif'
          >
            {title}
          </text>
        </svg>
        
        {/* Tooltip */}
        {tooltipData && (
          <TooltipWithBounds
            key={Math.random()}
            top={tooltipTop - 12}
            left={tooltipLeft + 12}
            style={tooltipStyles}
          >
            {`value: ${getY(tooltipData)}`}
          </TooltipWithBounds>
        )}
      </>
    );
  }
);

// Main component that uses ParentSize
const ProgressChart = ({ data, title }) => {
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
      <ParentSize>
        {({ width, height }) => (
          <Chart 
            data={data} 
            title={title} 
            width={width} 
            height={height}
          />
        )}
      </ParentSize>
    </Box>
  );
};

export default ProgressChart;