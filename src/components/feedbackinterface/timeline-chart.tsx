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
import {useTheme} from '@mui/material/styles';

export type AreaProps = {
  width: number;
  height: number;
  margin?: {top: number; right: number; bottom: number; left: number};
  tooltipLeft: number;
};

export type TimelineChartProps = AreaProps & {
  rewards: number[];
  actions: number[];
  uncertainty: number[];
  actionLabels: any[];
  videoDuration: number;
  onChange: (value: number) => void;
  onCorrectionClick: (step: number) => void;
  givenFeedbackMarkers: any[];
  proposedFeedbackMarkers: any[];
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
    uncertainty,
    actions,
    actionLabels,
    margin = {top: 20, right: 10, bottom: 25, left: 30},
    onChange,
    onCorrectionClick,
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
    //rewardArray.push(rewardArray[rewardArray.length - 1]);
    const fps = rewardArray.length / videoDuration;

    const theme = useTheme();

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
    const uncertaintyScale = useMemo(
      () =>
        scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: [0, Math.max(...uncertainty) || 0],
          nice: true,
        }),
      [innerHeight, margin.top, uncertainty]
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
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={theme.palette.background.l0}
          />
          <LinearGradient
            id="area-gradient"
            from={theme.palette.primary.main}
            to={theme.palette.primary.main}
            fromOpacity={0.6}
            toOpacity={0.2}
          />
          <AxisLeft
            scale={valueScale}
            left={margin.left}
            label="Reward"
            numTicks={valueScale.ticks().length / 4}
            tickFormat={value => `${value}`}
            stroke={theme.palette.text.secondary}
            tickLabelProps={{
              fill: theme.palette.text.primary,
            }}
            tickLineProps={{
              stroke: theme.palette.text.secondary,
            }}
            labelProps={{
              fill: theme.palette.text.primary,
            }}
          />
          <AxisBottom
            scale={stepScale}
            top={innerHeight + margin.top}
            label=""
            stroke={theme.palette.text.secondary}
            tickLabelProps={{
              fill: theme.palette.text.primary,
            }}
            tickLineProps={{
              stroke: theme.palette.text.secondary,
            }}
            labelProps={{
              fill: theme.palette.text.primary,
            }}
          />
          <GridRows
            left={margin.left}
            scale={valueScale}
            width={innerWidth}
            strokeDasharray="1,3"
            stroke={theme.palette.primary.main}
            strokeOpacity={0}
            pointerEvents="none"
          />
          <GridColumns
            top={margin.top}
            scale={stepScale}
            height={innerHeight}
            strokeDasharray="1,3"
            stroke={theme.palette.primary.main}
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
          <AreaClosed
            data={uncertainty}
            x={(_, i) => stepScale(i) ?? 0}
            y={d => uncertaintyScale(d) ?? 0}
            yScale={valueScale}
            strokeWidth={1}
            stroke={theme.palette.primary.light}
            fill="transparent"
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
              onCorrectionClick(
                Math.floor(stepScale.invert(localPoint(event)?.x || 0))
              )
            }
            onMouseLeave={() => hideTooltip()}
          />
          <Line
            from={{x: stepScale(tooltipLeft * fps), y: margin.top}}
            to={{x: stepScale(tooltipLeft * fps), y: innerHeight + margin.top}}
            stroke={theme.palette.primary.main}
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
                  color: theme.palette.primary.dark,
                  '&:hover': {
                    color: theme.palette.primary.light,
                  },
                }}
                fontSize="small"
                onClick={() => onCorrectionClick(marker.x)}
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
                    stroke: theme.palette.background.default,
                  },
                }}
                color="primary"
                fontSize="small"
                onClick={() => onCorrectionClick(marker.x)}
              />
            </g>
          ))}
          {actions.map(
            (action, index) =>
              actionLabels[action] && (
                <g
                  key={'action_' + index}
                  transform={`translate(${stepScale(index) - 9},${
                    innerHeight + margin.top - 9
                  })`}
                >
                  {actionLabels[action]}
                </g>
              )
          )}
          {tooltipData && (
            <g>
              <circle
                cx={stepScale(tooltipLeft * fps)}
                cy={tooltipTop + 1}
                r={4}
                fill={theme.palette.text.primary}
                fillOpacity={1.0}
                stroke={theme.palette.text.primary}
                strokeOpacity={1.0}
                strokeWidth={2}
                pointerEvents="none"
              />
              <circle
                cx={stepScale(tooltipLeft * fps)}
                cy={tooltipTop}
                r={4}
                fill={theme.palette.primary.main}
                stroke={theme.palette.text.primary}
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
        {/*Info text on top right, saying: correciton on double click, visible when tooltip is visible*/}
        {tooltipData && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              padding: '5px 10px 0 0',
            }}
          >
            <div
              style={{
                color: theme.palette.text.primary,
                fontSize: 13,
                fontFamily: 'sans-serif',
              }}
            >
              <div>Double click to correct</div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
