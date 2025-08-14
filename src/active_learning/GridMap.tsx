import React, { useMemo, useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { scaleLinear } from '@visx/scale';
import { interpolateRdYlBu } from 'd3-scale-chromatic';
import { extent } from 'd3-array';
import { withTooltip, TooltipWithBounds, defaultStyles, useTooltip } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { WithTooltipProvidedProps } from '@visx/tooltip/lib/enhancers/withTooltip';

interface GridUncertaintyMapProps {
  gridPredictionImage: string | null; // Base64 encoded image data for prediction
  gridUncertaintyImage: string | null; // Base64 encoded image data for uncertainties
  gridCoordinates?: number[][];  // Optional grid coordinates for hover effects
  gridUncertainties?: number[];  // Optional grid uncertainties for hover effects
  datapointCoordinates: number[][];  // Data points to overlay (as grey dots)
  title: string;
  imageOpacity?: number; // Optional opacity for the image
  width?: number; // Width of the chart
  height?: number; // Height of the chart
}

// Define tooltip data structure
interface TooltipData {
  x: number;
  y: number;
  uncertainty: number;
}

// Custom styling
const background = '#ffffff';
const tooltipStyles = {
  ...defaultStyles,
  background,
  border: '1px solid white',
  color: 'black',
  fontSize: '10px',
  padding: '5px',
};

// Find the closest point in the grid to a given position
const findClosestPoint = (
  x: number,
  y: number,
  gridCoordinates: number[][]
): { index: number; distance: number } | null => {
  if (!gridCoordinates || gridCoordinates.length === 0) return null;

  let closestIndex = 0;
  let closestDistance = Infinity;

  for (let i = 0; i < gridCoordinates.length; i++) {
    const [gx, gy] = gridCoordinates[i];
    const distance = Math.sqrt(Math.pow(gx - x, 2) + Math.pow(gy - y, 2));
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  return { index: closestIndex, distance: closestDistance };
};

// The main chart component with tooltip functionality
const GridMap = withTooltip<GridUncertaintyMapProps, TooltipData>(
  ({
    gridPredictionImage,
    gridUncertaintyImage,
    gridCoordinates,
    gridUncertainties,
    datapointCoordinates,
    title,
    width = 0,
    height = 0,
    imageOpacity = 0.8,
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  }: GridUncertaintyMapProps & WithTooltipProvidedProps<TooltipData>) => {
    // Image loading state
    const [imageLoaded, setImageLoaded] = useState(false);
    
    // Processed image URLs
    const [processedPredictionUrl, setProcessedPredictionUrl] = useState<string | null>(null);
    const [processedUncertaintyUrl, setProcessedUncertaintyUrl] = useState<string | null>(null);
    
    // Margins for the chart
    const margin = { top: 30, right: 10, bottom: 50, left: 30 };
    
    // Calculate bounds
    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);
    
    // Determine the data bounds
    // If we have grid coordinates, use them, otherwise use datapointCoordinates
    const boundCoordinates = gridCoordinates?.length ? gridCoordinates : datapointCoordinates;
    
    // Process base64 image data to a data URL
    useEffect(() => {
      if (gridPredictionImage) {
        // Check if it's already a data URL
        if (gridPredictionImage.startsWith('data:')) {
          setProcessedPredictionUrl(gridPredictionImage);
        } else {
          // Otherwise, convert the base64 string to a data URL
          setProcessedPredictionUrl(`data:image/png;base64,${gridPredictionImage}`);
        }
      } else {
        setProcessedPredictionUrl(null);
      }
      
      if (gridUncertaintyImage) {
        // Check if it's already a data URL
        if (gridUncertaintyImage.startsWith('data:')) {
          setProcessedUncertaintyUrl(gridUncertaintyImage);
        } else {
          // Otherwise, convert the base64 string to a data URL
          setProcessedUncertaintyUrl(`data:image/png;base64,${gridUncertaintyImage}`);
        }
      } else {
        setProcessedUncertaintyUrl(null);
      }
    }, [gridPredictionImage, gridUncertaintyImage]);

    // Compute scales based on the data - MOVED AFTER ALL HOOKS
    const xScale = useMemo(() => {
      if (!boundCoordinates || boundCoordinates.length === 0) {
        return scaleLinear({
          domain: [0, 1],
          range: [margin.left, innerWidth + margin.left],
        });
      }
      const xExtent = extent(boundCoordinates, d => d[0]) as [number, number];
      return scaleLinear({
        domain: [xExtent[0], xExtent[1]],
        range: [margin.left, innerWidth + margin.left],
      });
    }, [boundCoordinates, innerWidth, margin.left]);

    const yScale = useMemo(() => {
      if (!boundCoordinates || boundCoordinates.length === 0) {
        return scaleLinear({
          domain: [0, 1],
          range: [innerHeight + margin.top, margin.top],
        });
      }
      const yExtent = extent(boundCoordinates, d => d[1]) as [number, number];
      return scaleLinear({
        domain: [yExtent[0], yExtent[1]],
        range: [innerHeight + margin.top, margin.top],
      });
    }, [boundCoordinates, innerHeight, margin.top]);

    // Handle image loading
    useEffect(() => {
      if (processedUncertaintyUrl) {
        const img = new Image();
        img.onload = () => setImageLoaded(true);
        img.onerror = (e) => {
          console.error('Error loading uncertainty image:', e);
          setImageLoaded(false);
        };
        img.src = processedUncertaintyUrl;
      }
    }, [processedUncertaintyUrl]);

    // Determine which image to use (uncertainty is preferred)
    const imageToUse = processedUncertaintyUrl || processedPredictionUrl;

    // NOW we can do our early return, after all hooks are declared
    if (innerWidth < 0 || innerHeight < 0 || !boundCoordinates || boundCoordinates.length === 0) {
      return (
        <svg width={width} height={height}>
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={background}
            rx={6}
          />
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fontSize={14}
            fill="#666"
            fontFamily='Arial, sans-serif'
          >
            No data available
          </text>
        </svg>
      );
    }
    
    // Tooltip handler
    const handleTooltip = (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      // Only provide tooltips if we have grid coordinates and uncertainties
      if (!gridCoordinates || !gridUncertainties || gridCoordinates.length === 0) {
        return;
      }
      
      const { x, y } = localPoint(event) || { x: 0, y: 0 };
      
      // Convert screen coordinates to data coordinates
      const dataX = xScale.invert(x);
      const dataY = yScale.invert(y);
      
      // Find the closest grid point
      const closest = findClosestPoint(dataX, dataY, gridCoordinates);
      
      if (!closest) return;
      
      const { index, distance } = closest;
      // Calculate a reasonable hover threshold based on data density
      const threshold = Math.min(
        (innerWidth / Math.sqrt(gridCoordinates.length)) * 1.2,
        10 // Maximum hover distance
      );
      
      if (distance <= threshold) {
        const point = gridCoordinates[index];
        const uncertainty = gridUncertainties[index];
        
        showTooltip({
          tooltipData: {
            x: point[0],
            y: point[1],
            uncertainty,
          },
          tooltipLeft: xScale(point[0]),
          tooltipTop: yScale(point[1]),
        });
      } else {
        hideTooltip();
      }
    };

    return (
      <>
        <svg width={width} height={height}>
          {/* Background rectangle */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={background}
            rx={6}
          />
          
          {/* Clipping path for the image */}
          <defs>
            <clipPath id="chart-area">
              <rect
                x={margin.left}
                y={margin.top}
                width={innerWidth}
                height={innerHeight}
              />
            </clipPath>
          </defs>
          
          {/* Uncertainty image (if available) */}
          {imageToUse && (
            <image
              href={imageToUse}
              x={margin.left}
              y={margin.top}
              width={innerWidth}
              height={innerHeight}
              preserveAspectRatio="none"
              clipPath="url(#chart-area)"
              opacity={imageOpacity}
            />
          )}
          
          {/* Data points (overlay on the image) */}
          {/*datapointCoordinates?.map((point, i) => {
            if (!point || point.length < 2) return null;
            const [x, y] = point;
            
            return (
              <circle
                key={`datapoint-${i}`}
                cx={xScale(x)}
                cy={yScale(y)}
                r={4}
                fill="black"
                stroke="white"
                strokeWidth={1}
                opacity={0.05}
              />
            );
          })*/}

          {/* Axes */}
          <line
            x1={margin.left}
            y1={innerHeight + margin.top}
            x2={innerWidth + margin.left}
            y2={innerHeight + margin.top}
            stroke="#888"
            strokeWidth={1}
          />
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={innerHeight + margin.top}
            stroke="#888"
            strokeWidth={1}
          />
          
          {/* Title */}
          <text
            x={width / 2}
            y={margin.top / 2}
            textAnchor="middle"
            fontFamily='Arial, sans-serif'
            fontSize={14}
            fill="black"
            fontWeight="bold"
          >
            {title}
          </text>
          
          {/* Tooltip overlay */}
          <rect
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onTouchStart={handleTooltip}
            onTouchMove={handleTooltip}
            onMouseMove={handleTooltip}
            onMouseLeave={() => hideTooltip()}
          />
          
          {/* Color legend */}
          <g transform={`translate(${margin.left}, ${innerHeight + margin.top + 15})`}>
            {Array.from({ length: 5 }).map((_, i) => {
              const value = i / 4; // 0 to 1
              return (
                <rect
                  key={`legend-${i}`}
                  x={i * (innerWidth / 5)}
                  y={0}
                  width={innerWidth / 5}
                  height={8}
                  fill={interpolateRdYlBu(value)}
                />
              );
            })}
            <text
              x={0}
              y={20}
              fontSize={10}
              textAnchor="start"
              fill="black"
            >
              High Uncertainty
            </text>
            <text
              x={innerWidth}
              y={20}
              fontSize={10}
              textAnchor="end"
              fill="black"
            >
              Low Uncertainty
            </text>
          </g>
        </svg>
        
        {/* Tooltip */}
        {tooltipData && (
          <TooltipWithBounds
            key={Math.random()}
            top={tooltipTop - 12}
            left={tooltipLeft + 12}
            style={tooltipStyles}
          >
            <div>x: {tooltipData.x.toFixed(2)}</div>
            <div>y: {tooltipData.y.toFixed(2)}</div>
            <div>uncertainty: {tooltipData.uncertainty.toFixed(4)}</div>
          </TooltipWithBounds>
        )}
      </>
    );
  }
);

// Main component that uses ParentSize for responsive sizing
const GridUncertaintyMap: React.FC<Omit<GridUncertaintyMapProps, 'width' | 'height'>> = ({ 
  gridPredictionImage, 
  gridUncertaintyImage, 
  gridCoordinates,
  gridUncertainties,
  datapointCoordinates,
  title,
  imageOpacity
}) => {
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
      <ParentSize>
        {({ width, height }) => (
          <GridMap 
            gridPredictionImage={gridPredictionImage} 
            gridUncertaintyImage={gridUncertaintyImage}
            gridCoordinates={gridCoordinates}
            gridUncertainties={gridUncertainties}
            datapointCoordinates={datapointCoordinates}
            title={title}
            imageOpacity={imageOpacity} 
            width={width} 
            height={height}
          />
        )}
      </ParentSize>
    </Box>
  );
};

export default GridUncertaintyMap;