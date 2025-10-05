import React from 'react';
import { Box } from '@mui/material';
import { BarStack } from '@visx/shape';
import { Group } from '@visx/group';
import { Grid } from '@visx/grid';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear } from '@visx/scale'; // Removed scaleOrdinal - not used
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';

// Define the data structure (input)
interface DataItem {
  category: string;
  total: number;
  current: number;
}

// Define props for the component
interface FeedbackCountsProps {
  data?: DataItem[];
  title?: string;
}

// Default data if none is provided
const defaultData: DataItem[] = [
  { category: 'Rating', total: 18, current: 5 },
  { category: 'Comparison', total: 12, current: 3 },
  { category: 'Correction', total: 15, current: 6 },
  { category: 'Demo', total: 14, current: 4 },
  { category: 'Cluster', total: 16, current: 7 },
];

// Tooltip styles with sans-serif font
const tooltipStyles = {
  ...defaultStyles,
  background: 'white',
  border: '1px solid #ddd',
  color: 'black',
  fontSize: '12px',
  fontFamily: 'sans-serif',
  padding: '8px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
};

// Keys for the *actual* stacked segments - reversed order to put current on top
const keys = ['rest', 'current'] as const; // 'rest' first so 'current' appears on top
type StackKey = typeof keys[number]; // Type for our keys: 'current' | 'rest'

const categoryColors: Record<string, string> = {
  'Rating': '#64b5f6',      // Muted Blue
  'Comparison': '#e57373',  // Muted Red
  'Correction': '#ffd54f',  // Muted Yellow/Amber
  'Demo': '#81c784', // Muted Green
  'Cluster': '#ba68c8',     // Muted Purple
};

// Fallback color
const fallbackColor = '#757575'; // Grey

// Define the structure of the processed data for BarStack
interface ProcessedDataItem extends DataItem {
  rest: number;
}

// Define interface for tooltip data
interface TooltipData {
  category: string;
  current: number;
  total: number;
  rest: number;
}

// The chart component with tooltip support
const BarChart = ({
  data = defaultData,
  title = 'Feedback Counts',
  width,
  height,
}: { // Explicitly type props for BarChart internal component
  data?: DataItem[];
  title?: string;
  width: number;
  height: number;
}) => {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip<TooltipData>(); // Use our tooltip data interface

  // Define margins - adjusted for better spacing
  const margin = { top: 30, right: 10, bottom: 40, left: 50 };

  // Calculate bounds
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  // Don't render if we don't have valid dimensions
  if (width < 10 || height < 10 || xMax <= 0 || yMax <= 0) return null;

  // Process data to calculate the 'rest' segment for stacking
  const processedData: ProcessedDataItem[] = data.map(d => ({
    ...d,
    rest: Math.max(0, d.total - d.current),
  }));

  // Scales
  const xScale = scaleBand<string>({
    domain: processedData.map(d => d.category),
    padding: 0.2,
    range: [0, xMax],
  });

  // Find max value for y-axis (use original total)
  const maxValue = Math.max(0, ...data.map(d => d.total)); // Ensure maxValue is >= 0
  const yDomainMax = maxValue === 0 ? 5 : Math.max(1, Math.ceil(maxValue * 1.1));

  const yScale = scaleLinear<number>({
    domain: [0, yDomainMax],
    range: [yMax, 0],
  });

  const tickStep = Math.max(1, Math.ceil(yDomainMax / 5));
  const tickValues: number[] = [];
  for (let tick = 0; tick <= yDomainMax; tick += tickStep) {
    tickValues.push(tick);
  }
  if (tickValues[tickValues.length - 1] !== yDomainMax) {
    tickValues.push(yDomainMax);
  }

  // Tooltip handler - fixed to properly display tooltip
  const handleTooltip = (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
    const { x, y } = localPoint(event) || { x: 0, y: 0 };
    
    // Calculate x position relative to chart area
    const chartX = x - margin.left;
    
    // Find which category band we're in
    const xArray = xScale.domain();
    const index = Math.max(
      0,
      Math.min(
        xArray.length - 1,
        Math.floor(chartX / xScale.step())
      )
    );
    
    if (index < 0 || index >= data.length) {
      hideTooltip();
      return;
    }
    
    const category = xArray[index];
    const categoryData = data.find(d => d.category === category);
    
    if (!categoryData) {
      hideTooltip();
      return;
    }
    
    showTooltip({
      tooltipData: {
        category: categoryData.category,
        current: categoryData.current,
        total: categoryData.total,
        rest: categoryData.total - categoryData.current,
      },
      tooltipLeft: x,
      tooltipTop: y - 10, // Slight offset to avoid cursor overlap
    });
  };

  return (
    <>
      <svg width={width} height={height}>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#ffffff"
          rx={6}
        />

        <Group left={margin.left} top={margin.top}>
          {/* Grid lines */}
          <Grid
            xScale={xScale}
            yScale={yScale}
            width={xMax}
            height={yMax}
            stroke="#e0e0e0"
            strokeOpacity={0.6}
            numTicksRows={Math.max(1, tickValues.length - 1)}
          />

          {/* Bar stack with darker colors for the rest/base and lighter for current on top */}
          <BarStack<ProcessedDataItem, StackKey>
            data={processedData}
            keys={keys}
            x={d => d.category}
            xScale={xScale}
            yScale={yScale}
            color={(key, index) => {
              // Get the category from the data
              const category = processedData[index]?.category || '';
              const baseColor = categoryColors[category] || fallbackColor;
              
              // Reverse the coloring: rest (bottom) gets full color, current (top) gets lighter color
              return key === 'rest' ? baseColor : `${baseColor}80`;
            }}
          >
            {barStacks =>
              barStacks.map(barStack =>
                barStack.bars.map(bar => (
                  <rect
                    key={`bar-stack-${barStack.key}-${bar.index}`}
                    x={bar.x}
                    y={bar.y}
                    height={Math.max(0, bar.height)} // Ensure no negative heights
                    width={bar.width}
                    fill={bar.color}
                    onMouseLeave={hideTooltip}
                    onMouseMove={handleTooltip}
                    onTouchStart={handleTooltip}
                  />
                ))
              )
            }
          </BarStack>
          
          {/* X-axis - with sans-serif font */}
          <AxisBottom
            scale={xScale}
            top={yMax}
            tickLabelProps={() => ({
              fill: '#333',
              fontSize: 10,
              fontFamily: 'sans-serif',
              textAnchor: 'middle',
              dy: '0.33em',
            })}
            hideAxisLine
            hideTicks
          />
          
          {/* Y-axis - with sans-serif font */}
          <AxisLeft
            scale={yScale}
            tickValues={tickValues}
            tickFormat={(value) => `${Math.round(value as number)}`}
            tickLabelProps={() => ({
              fill: '#333',
              fontSize: 10,
              fontFamily: 'sans-serif',
              textAnchor: 'end',
              dy: '0.33em',
            })}
            hideAxisLine
            hideTicks
          />
        </Group>
        
        {/* Title - with sans-serif font */}
        <text
          x={width / 2}
          y={15}
          textAnchor="middle"
          fontSize={14}
          fontFamily="sans-serif"
          fill="black"
          fontWeight="bold"
        >
          {title}
        </text>
        
        {/* Legend - with sans-serif font */}
        <Group top={height - 15} left={width / 2 - 100}>
          {/* First legend item - Other Sessions (dark) */}
          <Group left={0}>
            <rect
              width={12}
              height={12}
              fill={categoryColors['Rating'] || '#64b5f6'} // Full color for other sessions
              rx={2}
            />
            <text
              x={16}
              y={10}
              fontSize={10}
              fontFamily="sans-serif"
              fill="#333"
              dominantBaseline="middle"
            >
              Previous Phases
            </text>
          </Group>
          
          {/* Second legend item - Current Session (light) */}
          <Group left={120}>
            <rect
              width={12}
              height={12}
              fill={`${categoryColors['Rating']}80` || '#64b5f680'} // Lighter color for current
              rx={2}
            />
            <text
              x={16}
              y={10}
              fontSize={10}
              fontFamily="sans-serif"
              fill="#333"
              dominantBaseline="middle"
            >
              Current Phase
            </text>
          </Group>
        </Group>
      </svg>

      {/* Tooltip - updated to match new color scheme */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div>
            <strong style={{ color: categoryColors[tooltipData.category] || fallbackColor }}>
              {tooltipData.category}
            </strong>
            <div>Current Phase: <span style={{ color: `${categoryColors[tooltipData.category] || fallbackColor}80` }}>{tooltipData.current}</span></div>
            <div>Other Phases: <span style={{ color: categoryColors[tooltipData.category] || fallbackColor }}>{tooltipData.rest}</span></div>
            <div>All Sessions: {tooltipData.total}</div>
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
};

// Main component
const FeedbackCounts: React.FC<FeedbackCountsProps> = ({ data = defaultData, title = 'Feedback Counts' }) => {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        maxHeight: '100%',
        overflow: 'hidden'
      }}
    >
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <BarChart
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

export default FeedbackCounts;
