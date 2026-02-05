import React from 'react';
import { Box, Typography } from '@mui/material';
import { Line, Bar, LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { GridRows, GridColumns } from '@visx/grid';
import { scaleLinear } from '@visx/scale';
import { withTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { max, extent, bisector } from 'd3-array';
import { localPoint } from '@visx/event';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom, AxisRight } from '@visx/axis';
import { ParentSize } from '@visx/responsive';

  
type ChartDatum = { step: number; reward: number; uncertainty: number };

// Accessors - with safety checks
const getStep = (d?: Partial<ChartDatum> | null) =>
  d && d.step !== undefined ? d.step : 0;
const getReward = (d?: Partial<ChartDatum> | null) =>
  d && d.reward !== undefined ? d.reward : 0;
const getUncertainty = (d?: Partial<ChartDatum> | null) =>
  d && d.uncertainty !== undefined ? d.uncertainty : 0;
const bisectData = bisector((d: ChartDatum) => getStep(d)).left;

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
const expandDomain = (
  domain: [number | undefined, number | undefined] | [undefined, undefined],
  paddingRatio = 0.1
): [number, number] => {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }
  if (min === max) {
    const safeMin = min ?? 0;
    const safeMax = max ?? 0;
    const pad = Math.abs(safeMin || 1) * paddingRatio || 1;
    return [safeMin - pad, safeMax + pad];
  }
  return [min as number, max as number];
};

const Chart = withTooltip(({
  data,
  title,
  width,
  height,
  showTooltip,
  hideTooltip,
  tooltipData,
  tooltipLeft = 0,
  tooltipTop = 0,
}: any) => {
    const margin = { top: 24, right: 60, bottom: 40, left: 60 };

    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);

    if (innerWidth <= 0 || innerHeight <= 0 || !data || data.length === 0) {
      return null;
    }

    const xDomain = expandDomain(extent(data, getStep) as [number | undefined, number | undefined]);
    const rewardDomain = expandDomain(extent(data, getReward) as [number | undefined, number | undefined]);
    const uncertaintyDomain = expandDomain(
      extent(data, getUncertainty) as [number | undefined, number | undefined]
    );

    const xScale = scaleLinear({ range: [0, innerWidth], domain: xDomain, nice: true });
    const rewardScale = scaleLinear({ range: [innerHeight, 0], domain: rewardDomain, nice: true });
    const uncertaintyScale = scaleLinear({ range: [innerHeight, 0], domain: uncertaintyDomain, nice: true });

    const handleTooltip = (event: any) => {
      const { x } = localPoint(event) || { x: 0 };
      const x0 = xScale.invert(x - margin.left);
      const index = bisectData(data, x0);

      if (index <= 0 || index >= data.length) {
        return;
      }

      const d0 = data[index - 1];
      const d1 = data[index];

      const d = d1 && getStep(d1) ? (x0 - getStep(d0) > getStep(d1) - x0 ? d1 : d0) : d0;

      showTooltip({
        tooltipData: d,
        tooltipLeft: xScale(getStep(d)) + margin.left,
        tooltipTop: rewardScale(getReward(d)) + margin.top,
      });
    };

    return (
      <>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <svg width={width} height={height - 10}>
            <rect x={0} y={0} width={width} height={height - 25} fill={backgroundColor} rx={6} />

            <Group left={margin.left} top={margin.top}>
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

              <AxisLeft
                scale={rewardScale}
                label="Reward"
                labelProps={{ fill: '#333', fontSize: 14, textAnchor: 'middle', fontFamily: 'sans-serif' }}
                stroke="#333"
                tickStroke="#333"
                tickLabelProps={() => ({
                  fill: '#333',
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  textAnchor: 'end',
                  dy: '0.33em',
                })}
                numTicks={5}
              />

              <AxisBottom
                top={innerHeight}
                scale={xScale}
                label="Checkpoint Step"
                labelProps={{ fill: '#333', fontSize: 14, textAnchor: 'middle', fontFamily: 'sans-serif' }}
                stroke="#333"
                tickStroke="#333"
                tickLabelProps={() => ({
                  fill: '#333',
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  textAnchor: 'middle',
                  dy: '0.33em',
                })}
                numTicks={Math.max(2, Math.min(6, data.length))}
              />

              <LinePath<ChartDatum>
                data={data}
                x={(d) => xScale(getStep(d))}
                y={(d) => rewardScale(getReward(d))}
                stroke={rewardColor}
                strokeWidth={2.5}
                curve={curveMonotoneX}
              />

              <LinePath<ChartDatum>
                data={data}
                x={(d) => xScale(getStep(d))}
                y={(d) => uncertaintyScale(getUncertainty(d))}
                stroke={uncertaintyColor}
                strokeWidth={2.5}
                curve={curveMonotoneX}
              />

              <Bar
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onTouchStart={handleTooltip}
                onTouchMove={handleTooltip}
                onMouseMove={handleTooltip}
                onMouseLeave={() => hideTooltip()}
              />

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

            <text
              x={width / 2}
              y={18}
              textAnchor="middle"
              fontFamily="sans-serif"
              fontSize={16}
              fontWeight="bold"
              fill="#333"
            >
              {title || 'Training Progress'}
            </text>
          </svg>

          <svg
            width={width}
            height={height - 10}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
          >
            <Group left={margin.left} top={margin.top}>
              <AxisRight
                left={innerWidth}
                scale={uncertaintyScale}
                label="Uncertainty"
                labelProps={{ fill: '#333', fontSize: 14, textAnchor: 'middle', fontFamily: 'sans-serif' }}
                stroke="#333"
                tickStroke="#333"
                tickLabelProps={() => ({
                  fill: '#333',
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  textAnchor: 'start',
                  dy: '0.33em',
                })}
                numTicks={5}
              />
            </Group>
          </svg>

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 24,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 3, backgroundColor: rewardColor, borderRadius: 2 }}></div>
              <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#333' }}>Predicted Reward</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 3, backgroundColor: uncertaintyColor, borderRadius: 2 }}></div>
              <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#333' }}>Uncertainty</span>
            </div>
          </div>

          {tooltipData && (
            <TooltipWithBounds
              key={Math.random()}
              top={tooltipTop - 40}
              left={tooltipLeft + 12}
              style={tooltipStyles}
            >
              <div style={{ fontWeight: 'bold' }}>
                Checkpoint: {getStep(tooltipData).toLocaleString()}
              </div>
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
  }) as React.FC<any>;

type ImprovedProgressChartProps = {
  steps?: number[];
  rewards?: number[];
  uncertainties?: number[];
  title?: string;
};

// Main component that follows the pattern from reference code
const ImprovedProgressChart = ({
  steps = [],
  rewards = [],
  uncertainties = [],
  title,
}: ImprovedProgressChartProps) => {
  const minLength = Math.min(steps?.length ?? 0, rewards?.length ?? 0, uncertainties?.length ?? 0);
  const chartData =
    minLength > 0
      ? Array.from({ length: minLength }, (_, index) => {
          const stepValue = Number(steps[index]);
          const rewardValue = Number(rewards[index]);
          const uncertaintyValue = Number(uncertainties[index]);
          return {
            step: Number.isFinite(stepValue) ? stepValue : index,
            reward: Number.isFinite(rewardValue) ? rewardValue : 0,
            uncertainty: Number.isFinite(uncertaintyValue) ? uncertaintyValue : 0,
          };
        }).filter(
          (d) => Number.isFinite(d.step) && Number.isFinite(d.reward) && Number.isFinite(d.uncertainty)
        )
      : [];

  return (
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
      {chartData.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No training data recorded yet.
        </Typography>
      ) : (
        <ParentSize debounceTime={10}>
          {({ width, height }) => (
            <Chart
              data={chartData}
              title={title || 'Training Progress'}
              width={width}
              height={height}
            />
          )}
        </ParentSize>
      )}
    </Box>
  );
};

export default ImprovedProgressChart;
