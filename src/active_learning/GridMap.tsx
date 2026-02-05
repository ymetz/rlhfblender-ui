import React, { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { scaleLinear } from '@visx/scale';
import { extent } from 'd3-array';
import { interpolateRdBu } from 'd3-scale-chromatic';
import { withTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';

interface TrajectoryEpisode {
  episode: number;
  points: number[][];
}

interface ValueRange {
  min: number;
  max: number;
}

interface DifferenceStatsPayload {
  grid: {
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
    fraction_decrease: number;
  };
  current_mean_uncertainty: number;
  previous_mean_uncertainty: number;
}

interface ProjectionBounds {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

interface GridUncertaintyMapProps {
  differenceImage: string | null;
  differenceRange?: ValueRange;
  differenceStats?: DifferenceStatsPayload;
  gridCoordinates: number[][];
  gridDifferences: number[];
  gridCurrentValues: number[];
  gridPreviousValues: number[];
  projectionBounds?: ProjectionBounds;
  currentTrajectories: TrajectoryEpisode[];
  previousTrajectories: TrajectoryEpisode[];
  loading?: boolean;
  error?: string | null;
  title: string;
  width?: number;
  height?: number;
}

interface TooltipData {
  x: number;
  y: number;
  difference: number;
  current: number;
  previous: number;
}

const background = '#ffffff';
const MAX_TRAJECTORIES = 80;

const tooltipStyles = {
  ...defaultStyles,
  background,
  border: '1px solid #ddd',
  color: '#111',
  fontSize: '11px',
  padding: '7px',
};

const findClosestPoint = (
  x: number,
  y: number,
  gridCoordinates: number[][],
): { index: number; distance: number } | null => {
  if (!gridCoordinates || gridCoordinates.length === 0) return null;

  let closestIndex = 0;
  let closestDistance = Infinity;

  for (let i = 0; i < gridCoordinates.length; i += 1) {
    const [gx, gy] = gridCoordinates[i];
    const dx = gx - x;
    const dy = gy - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  return { index: closestIndex, distance: closestDistance };
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const GridMap = withTooltip<GridUncertaintyMapProps, TooltipData>((props) => {
  const {
    differenceImage,
    differenceRange,
    differenceStats,
    gridCoordinates,
    gridDifferences,
    gridCurrentValues,
    gridPreviousValues,
    projectionBounds,
    currentTrajectories,
    previousTrajectories,
    loading = false,
    error,
    title,
    width = 0,
    height = 0,
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  } = props;

  const [processedDifferenceUrl, setProcessedDifferenceUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!differenceImage) {
      setProcessedDifferenceUrl(null);
      setImageLoaded(false);
      return;
    }

    if (differenceImage.startsWith('data:')) {
      setProcessedDifferenceUrl(differenceImage);
    } else {
      setProcessedDifferenceUrl(`data:image/png;base64,${differenceImage}`);
    }
  }, [differenceImage]);

  useEffect(() => {
    if (!processedDifferenceUrl) return;

    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(false);
    img.src = processedDifferenceUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [processedDifferenceUrl]);

  const aggregatedCoordinates = useMemo(() => {
    const coords: number[][] = [];
    if (Array.isArray(gridCoordinates) && gridCoordinates.length) {
      coords.push(...gridCoordinates);
    }
    const pushPoints = (episodes: TrajectoryEpisode[]) => {
      episodes.forEach((traj) => {
        if (Array.isArray(traj.points)) {
          coords.push(...traj.points);
        }
      });
    };
    if (Array.isArray(currentTrajectories)) pushPoints(currentTrajectories);
    if (Array.isArray(previousTrajectories)) pushPoints(previousTrajectories);
    return coords;
  }, [gridCoordinates, currentTrajectories, previousTrajectories]);

  const hasDomain = projectionBounds || aggregatedCoordinates.length > 0;

  const effectiveRange = useMemo<ValueRange | null>(() => {
    if (differenceRange) return differenceRange;
    if (differenceStats) {
      const { min, max } = differenceStats.grid;
      if (Number.isFinite(min) && Number.isFinite(max)) {
        const spread = Math.max(Math.abs(min), Math.abs(max));
        if (spread === 0) {
          return { min: -1e-6, max: 1e-6 };
        }
        return { min: -spread, max: spread };
      }
    }
    return null;
  }, [differenceRange, differenceStats]);

  const margin = { top: 30, right: 16, bottom: 130, left: 30 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xDomain = useMemo<[number, number]>(() => {
    if (projectionBounds) {
      return [projectionBounds.x_min, projectionBounds.x_max];
    }
    const computed = extent(aggregatedCoordinates, (d) => d[0]) as [number | undefined, number | undefined];
    if (computed[0] === undefined || computed[1] === undefined) {
      return [0, 1];
    }
    const padding = (computed[1] - computed[0]) * 0.05 || 1;
    return [computed[0] - padding, computed[1] + padding];
  }, [projectionBounds, aggregatedCoordinates]);

  const yDomain = useMemo<[number, number]>(() => {
    if (projectionBounds) {
      return [projectionBounds.y_min, projectionBounds.y_max];
    }
    const computed = extent(aggregatedCoordinates, (d) => d[1]) as [number | undefined, number | undefined];
    if (computed[0] === undefined || computed[1] === undefined) {
      return [0, 1];
    }
    const padding = (computed[1] - computed[0]) * 0.05 || 1;
    return [computed[0] - padding, computed[1] + padding];
  }, [projectionBounds, aggregatedCoordinates]);

  const xScale = useMemo(() => scaleLinear({ domain: xDomain, range: [margin.left, innerWidth + margin.left] }), [xDomain, innerWidth, margin.left]);
  const yScale = useMemo(() => scaleLinear({ domain: yDomain, range: [innerHeight + margin.top, margin.top] }), [yDomain, innerHeight, margin.top]);

  const limitedPrevious = useMemo(
    () => previousTrajectories.slice(0, MAX_TRAJECTORIES),
    [previousTrajectories],
  );
  const limitedCurrent = useMemo(
    () => currentTrajectories.slice(0, MAX_TRAJECTORIES),
    [currentTrajectories],
  );

  const legendSteps = useMemo(() => {
    if (!effectiveRange) return [] as number[];
    const steps = 7;
    const values: number[] = [];
    const increment = (effectiveRange.max - effectiveRange.min) / (steps - 1 || 1);
    for (let i = 0; i < steps; i += 1) {
      values.push(effectiveRange.min + increment * i);
    }
    return values;
  }, [effectiveRange]);

  const buildPath = (points: number[][]): string => {
    if (!points || points.length < 2) return '';
    const segments: string[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const [px, py] = points[i];
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      const command = segments.length === 0 ? 'M' : 'L';
      segments.push(`${command}${xScale(px)},${yScale(py)}`);
    }
    return segments.join(' ');
  };

  const renderStatus = (message: string) => (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={width} height={height} fill={background} rx={6} />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        fontSize={14}
        fill="#666"
        fontFamily="Arial, sans-serif"
      >
        {message}
      </text>
    </svg>
  );

  if (!hasDomain) {
    if (loading) return renderStatus('Loading uncertainty change…');
    if (error) return renderStatus(error);
    return renderStatus('No uncertainty data available yet.');
  }

  if (loading) {
    return renderStatus('Loading uncertainty change…');
  }

  if (error) {
    return renderStatus(error);
  }

  const hasGridData =
    Array.isArray(gridCoordinates)
    && gridCoordinates.length > 0
    && gridCoordinates.length === gridDifferences.length
    && gridCoordinates.length === gridCurrentValues.length
    && gridCoordinates.length === gridPreviousValues.length;

  const handleTooltip = (
    event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>,
  ) => {
    if (!hasGridData) return;
    const point = localPoint(event);
    if (!point) return;

    const dataX = xScale.invert(point.x);
    const dataY = yScale.invert(point.y);
    const closest = findClosestPoint(dataX, dataY, gridCoordinates);
    if (!closest) return;

    const { index, distance } = closest;
    const threshold = Math.min((innerWidth / Math.sqrt(gridCoordinates.length)) * 1.2, 10);
    if (distance > threshold) {
      hideTooltip();
      return;
    }

    const gridPoint = gridCoordinates[index];
    showTooltip({
      tooltipData: {
        x: gridPoint[0],
        y: gridPoint[1],
        difference: gridDifferences[index],
        current: gridCurrentValues[index],
        previous: gridPreviousValues[index],
      },
      tooltipLeft: xScale(gridPoint[0]),
      tooltipTop: yScale(gridPoint[1]),
    });
  };

  const legendWidth = innerWidth;
  const legendStepWidth = legendSteps.length ? legendWidth / legendSteps.length : legendWidth;
  const legendOriginY = innerHeight + margin.top + 18;
  const policyLegendX = margin.left;
  const policyLegendY = legendOriginY + 60;

  return (
    <>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={width} height={height} fill={background} rx={6} />

        <defs>
          <clipPath id="uncertainty-map-area">
            <rect x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>

        {processedDifferenceUrl && imageLoaded && (
          <image
            href={processedDifferenceUrl}
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            preserveAspectRatio="none"
            clipPath="url(#uncertainty-map-area)"
            opacity={1}
          />
        )}

        {limitedPrevious.map((trajectory) => {
          const path = buildPath(trajectory.points);
          if (!path) return null;
          return (
            <path
              key={`previous-${trajectory.episode}`}
              d={path}
              fill="none"
              stroke="rgba(220, 0, 78, 0.6)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              clipPath="url(#uncertainty-map-area)"
            />
          );
        })}

        {limitedCurrent.map((trajectory) => {
          const path = buildPath(trajectory.points);
          if (!path) return null;
          return (
            <path
              key={`current-${trajectory.episode}`}
              d={path}
              fill="none"
              stroke="rgba(25, 118, 210, 0.8)"
              strokeWidth={1.7}
              clipPath="url(#uncertainty-map-area)"
            />
          );
        })}

        <text
          x={width / 2}
          y={margin.top / 1.8}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize={15}
          fill="#111"
          fontWeight="bold"
        >
          {title}
        </text>

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

        {effectiveRange && legendSteps.length > 0 && (
          <g transform={`translate(${margin.left}, ${legendOriginY})`}>
            {legendSteps.map((value, idx) => {
              const t = clamp01((value - effectiveRange.min) / (effectiveRange.max - effectiveRange.min || 1));
              const color = interpolateRdBu(1 - t);
              return (
                <g key={`legend-${value}`} transform={`translate(${idx * legendStepWidth}, 0)`}>
                  <rect x={0} y={0} width={legendStepWidth} height={10} fill={color} />
                  <text
                    x={legendStepWidth / 2}
                    y={22}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#444"
                  >
                    {value.toFixed(3)}
                  </text>
                </g>
              );
            })}
            <text x={0} y={40} fontSize={11} fill="#2e537dff">↓ uncertainty</text>
            <text
              x={legendWidth}
              y={40}
              fontSize={11}
              fill="#c62828"
              textAnchor="end"
            >
              ↑ uncertainty
            </text>
          </g>
        )}

        <g transform={`translate(${policyLegendX}, ${policyLegendY})`}>
          <g transform="translate(10, 0)">
            <line
              x1={0}
              y1={0}
              x2={20}
              y2={0}
              stroke="rgba(220, 0, 78, 0.6)"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <text x={28} y={4} fontSize={11} fill="#880e4f">Previous policy trajectories</text>
          </g>
          <g transform="translate(200, 0)">
            <line x1={0} y1={0} x2={20} y2={0} stroke="rgba(25, 118, 210, 0.8)" strokeWidth={2} />
            <text x={28} y={4} fontSize={11} fill="#1a237e">Updated policy trajectories</text>
          </g>
        </g>
      </svg>

      {tooltipData && (
        <TooltipWithBounds
          top={tooltipTop - 12}
          left={tooltipLeft + 12}
          style={tooltipStyles}
        >
          <div>
            <strong>Δ uncertainty:</strong> {tooltipData.difference.toFixed(5)}
          </div>
          <div>Current: {tooltipData.current.toFixed(5)}</div>
          <div>Previous: {tooltipData.previous.toFixed(5)}</div>
          <div>
            (x, y) = ({tooltipData.x.toFixed(3)}, {tooltipData.y.toFixed(3)})
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
});

const GridUncertaintyMap: React.FC<Omit<GridUncertaintyMapProps, 'width' | 'height'>> = ({
  differenceImage,
  differenceRange,
  differenceStats,
  gridCoordinates,
  gridDifferences,
  gridCurrentValues,
  gridPreviousValues,
  projectionBounds,
  currentTrajectories,
  previousTrajectories,
  loading,
  error,
  title,
}) => (
  <Box
    sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      maxHeight: '100%',
      overflow: 'hidden',
    }}
  >
    <ParentSize>
      {({ width, height }) => (
        <GridMap
          differenceImage={differenceImage}
          differenceRange={differenceRange}
          differenceStats={differenceStats}
          gridCoordinates={gridCoordinates}
          gridDifferences={gridDifferences}
          gridCurrentValues={gridCurrentValues}
          gridPreviousValues={gridPreviousValues}
          projectionBounds={projectionBounds}
          currentTrajectories={currentTrajectories}
          previousTrajectories={previousTrajectories}
          loading={loading}
          error={error}
          title={title}
          width={width}
          height={height}
        />
      )}
    </ParentSize>
  </Box>
);

export default GridUncertaintyMap;
