import React, {useMemo, useCallback} from 'react';
import {AreaClosed, Line, Bar} from '@visx/shape';
import {AxisLeft, AxisBottom} from '@visx/axis';
import {curveMonotoneX} from '@visx/curve';
import {GridRows, GridColumns} from '@visx/grid';
import {scaleLinear} from '@visx/scale';
import {
  withTooltip,
  Tooltip,
  TooltipWithBounds,
  defaultStyles,
} from '@visx/tooltip';
import {WithTooltipProvidedProps} from '@visx/tooltip/lib/enhancers/withTooltip';
import {localPoint} from '@visx/event';
import {LinearGradient} from '@visx/gradient';
import LocationOnIcon from '@mui/icons-material/LocationOn';

export const background = '#3b6978';
export const background2 = '#204051';
export const accentColor = '#80d2ff';
export const accentColorDark = '#75daad';
export const rewardColor = '#80d2ff';
const tooltipStyles = {
  ...defaultStyles,
  background,
  border: '1px solid white',
  color: 'white',
};

export type AreaProps = {
  width: number;
  height: number;
  margin?: {top: number; right: number; bottom: number; left: number};
  tooltipLeft: number;
};

export type TimelineChartProps = AreaProps & {
  rewards: number[];
  videoDuration: number;
  onChange: (value: number) => void;
  onDemoClick: (step: number) => void;
  givenFeedbackMarkers: {x: number}[];
  proposedFeedbackMarkers: {x: number}[];
};

export type TooltipProps = {
  value: number;
  index: number;
};

export type SetMarkerProps = {
  index: number;
  type: string;
};

export default withTooltip<TimelineChartProps, TooltipProps>(
  ({
    width,
    height,
    rewards,
    margin = {top: 5, right: 10, bottom: 25, left: 20},
    onChange,
    onDemoClick,
    givenFeedbackMarkers,
    proposedFeedbackMarkers,
    videoDuration,
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  }: TimelineChartProps & WithTooltipProvidedProps<TooltipProps>) => {
    if (width < 10) return null;
    // bounds
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const rewardArray = rewards;
    const fps = rewardArray.length / videoDuration;

    // scales
    const stepScale = useMemo(
      () =>
        scaleLinear({
          range: [margin.left, innerWidth + margin.left],
          domain: [0, rewardArray.length - 1],
        }),
      [innerWidth, margin.left, rewardArray.length]
    );
    const valueScale = useMemo(
      () =>
        scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: [0, Math.max(...rewardArray) || 0],
          nice: true,
        }),
      [innerHeight, margin.top, rewardArray]
    );

    // tooltip handler
    const handleTooltip = useCallback(
      (
        event:
          | React.TouchEvent<SVGRectElement>
          | React.MouseEvent<SVGRectElement>
      ) => {
        const {x} = localPoint(event) || {x: -1};
        const x0 = x === -1 ? tooltipLeft * fps : stepScale.invert(x);
        const index = Math.floor(x0);
        const d = rewardArray[index];
        showTooltip({
          tooltipData: {value: d, index: index},
          tooltipLeft: x0,
          tooltipTop: valueScale(d),
        });
        onChange(((x0 / fps) as number) || 0);
      },
      [
        tooltipLeft,
        stepScale,
        rewardArray,
        showTooltip,
        valueScale,
        onChange,
        fps,
      ]
    );

    return (
      <div>
        <svg width={width} height={height}>
          <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
          <LinearGradient
            id="area-gradient"
            from={rewardColor}
            to={rewardColor}
            toOpacity={0.2}
          />
          <AxisLeft
            scale={valueScale}
            left={margin.left}
            label="Reward"
            numTicks={valueScale.ticks().length / 4}
            tickFormat={value => `${value}`}
          />
          <AxisBottom
            scale={stepScale}
            top={innerHeight + margin.top}
            label="Step"
          />
          <GridRows
            left={margin.left}
            scale={valueScale}
            width={innerWidth}
            strokeDasharray="1,3"
            stroke={accentColor}
            strokeOpacity={0}
            pointerEvents="none"
          />
          <GridColumns
            top={margin.top}
            scale={stepScale}
            height={innerHeight}
            strokeDasharray="1,3"
            stroke={accentColor}
            strokeOpacity={0.2}
            pointerEvents="none"
          />
          <AreaClosed
            data={rewardArray}
            x={(_, i) => stepScale(i) ?? 0}
            y={d => valueScale(d) ?? 0}
            yScale={valueScale}
            strokeWidth={1}
            stroke="url(#area-gradient)"
            fill="url(#area-gradient)"
            curve={curveMonotoneX}
          />
          <Bar
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            rx={14}
            onTouchStart={handleTooltip}
            onTouchMove={handleTooltip}
            onMouseMove={handleTooltip}
            onDoubleClick={event =>
              onDemoClick(
                Math.floor(stepScale.invert(localPoint(event)?.x || 0))
              )
            }
            onMouseLeave={() => hideTooltip()}
          />
          <Line
            from={{x: stepScale(tooltipLeft * fps), y: margin.top}}
            to={{x: stepScale(tooltipLeft * fps), y: innerHeight + margin.top}}
            stroke={accentColorDark}
            strokeWidth={3}
            pointerEvents="none"
          />
          {proposedFeedbackMarkers.map((marker, index) => (
            <g
              key={'marker_' + index}
              transform={`translate(${stepScale(marker.x) - 9},${0})`}
            >
              <LocationOnIcon
                inheritViewBox
                sx={{
                  color: '#fca503',
                  '&:hover': {
                    stroke: 'black',
                  },
                }}
                fontSize="small"
                onClick={() => onDemoClick(marker.x)}
              />
            </g>
          ))}
          {givenFeedbackMarkers.map((marker, index) => (
            <g
              key={'marker_' + index}
              transform={`translate(${stepScale(marker.x) - 9},${0})`}
            >
              <LocationOnIcon
                inheritViewBox
                sx={{
                  '&:hover': {
                    stroke: 'black',
                  },
                }}
                color="info"
                fontSize="small"
                onClick={() => onDemoClick(marker.x)}
              />
            </g>
          ))}
          {tooltipData && (
            <g>
              <circle
                cx={stepScale(tooltipLeft * fps)}
                cy={tooltipTop + 1}
                r={4}
                fill="black"
                fillOpacity={0.1}
                stroke="black"
                strokeOpacity={0.1}
                strokeWidth={2}
                pointerEvents="none"
              />
              <circle
                cx={stepScale(tooltipLeft * fps)}
                cy={tooltipTop}
                r={4}
                fill={accentColorDark}
                stroke="white"
                strokeWidth={2}
                pointerEvents="none"
              />
            </g>
          )}
        </svg>
        {tooltipData && (
          <div>
            <TooltipWithBounds
              key={Math.random()}
              top={tooltipTop - 12}
              left={stepScale(tooltipLeft * fps) + 12}
              style={tooltipStyles}
            >
              {`${tooltipData.value}`}
            </TooltipWithBounds>
            <Tooltip
              top={innerHeight + margin.top - 14}
              left={stepScale(tooltipLeft * fps)}
              style={{
                ...defaultStyles,
                minWidth: 72,
                textAlign: 'center',
                transform: 'translateX(-50%)',
              }}
            >
              {tooltipData.index}
            </Tooltip>
          </div>
        )}
      </div>
    );
  }
);
