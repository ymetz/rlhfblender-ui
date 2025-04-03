import React, { useMemo, useCallback } from "react";
import { AreaClosed, Line, Bar } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows, GridColumns } from "@visx/grid";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { Glyph as CustomGlyph, GlyphCircle } from "@visx/glyph";
import {
  withTooltip,
  Tooltip,
  TooltipWithBounds,
  defaultStyles,
} from "@visx/tooltip";
import { WithTooltipProvidedProps } from "@visx/tooltip/lib/enhancers/withTooltip";
import { localPoint } from "@visx/event";
import { LinearGradient } from "@visx/gradient";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { useTheme } from "@mui/material/styles";

type TimelineChartProps = {
  width: number;
  height: number;
  rewards: number[];
  uncertainty: number[];
  actions?: number[];
  actionLabels?: any[];
  margin?: { top: number; right: number; bottom: number; left: number };
  onChange: (value: number) => void;
  onCorrectionClick: (step: number) => void;
  givenFeedbackMarkers: any[];
  proposedFeedbackMarkers: any[];
  videoDuration: number;
  showTooltip: (tooltipData: TooltipProps) => void;
  hideTooltip: () => void;
  tooltipData?: TooltipProps;
  tooltipTop?: number;
  tooltipLeft?: number;
  useCorrectiveFeedback: boolean;
};

type TooltipProps = {
  value: number;
  index: number;
};

export default withTooltip<TimelineChartProps, TooltipProps>(
  ({
    width,
    height,
    rewards,
    uncertainty,
    actions,
    actionLabels,
    margin = { top: 20, right: 10, bottom: 25, left: 30 },
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
    useCorrectiveFeedback,
  }: TimelineChartProps & WithTooltipProvidedProps<TooltipProps>) => {
    if (width < 10) return null;

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const rewardArray = rewards;
    const fps = rewardArray.length / videoDuration;

    const theme = useTheme();

    const stepScale = useMemo(
      () =>
        scaleLinear({
          range: [margin.left, innerWidth + margin.left],
          domain: [0, rewardArray.length - 1],
        }),
      [innerWidth, margin.left, rewardArray.length],
    );

    const valueScale = useMemo(
      () =>
        scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: [Math.min(...rewardArray), Math.max(...rewardArray) || 0],
          nice: true,
        }),
      [innerHeight, margin.top, rewardArray],
    );

    const uncertaintyScale = useMemo(
      () =>
        scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: [0, Math.max(...uncertainty) || 0],
          nice: true,
        }),
      [innerHeight, margin.top, uncertainty],
    );

    const handleTooltip = useCallback(
      (
        event:
          | React.TouchEvent<SVGRectElement>
          | React.MouseEvent<SVGRectElement>,
      ) => {
        const { x } = localPoint(event) || { x: -1 };
        const x0 = x === -1 ? tooltipLeft * fps : stepScale.invert(x);
        const snappedIndex = Math.round(x0);
        const clampedIndex = Math.max(
          0,
          Math.min(snappedIndex, rewardArray.length - 1),
        );

        const d = rewardArray[clampedIndex];
        showTooltip({
          tooltipData: { value: d, index: clampedIndex },
          tooltipLeft: clampedIndex / fps,
          tooltipTop: valueScale(d),
        });
        onChange(clampedIndex / fps || 0);
      },
      [
        tooltipLeft,
        stepScale,
        rewardArray,
        showTooltip,
        valueScale,
        onChange,
        fps,
      ],
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
          <Group left={0} top={0}>
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
              y={(d) => valueScale(d) ?? 0}
              yScale={valueScale}
              strokeWidth={1}
              stroke="url(#area-gradient)"
              fill="url(#area-gradient)"
              curve={curveMonotoneX}
            />
            <AreaClosed
              data={uncertainty}
              x={(_, i) => stepScale(i) ?? 0}
              y={(d) => uncertaintyScale(d) ?? 0}
              yScale={valueScale}
              strokeWidth={1}
              stroke={theme.palette.primary.light}
              fill="transparent"
              curve={curveMonotoneX}
            />

            {rewardArray.map((reward, index) => {
              const x = stepScale(index);
              const y = valueScale(reward);

              // If we have an action label SVG for this step
              if (actions && actionLabels && actionLabels[actions[index]]) {
                return (
                  <CustomGlyph key={`step-${index}`} left={x} top={y}>
                    {actionLabels[actions[index]]}
                  </CustomGlyph>
                );
              }

              // Otherwise use circle glyphs
              const isLastStep = index === rewardArray.length - 1;
              return (
                <GlyphCircle
                  key={`step-${index}`}
                  left={x}
                  top={y}
                  size={15}
                  stroke={isLastStep ? "#4de44d" : theme.palette.secondary.main}
                  fill={isLastStep ? "#4de44d" : theme.palette.secondary.main}
                />
              );
            })}

            <AxisLeft
              scale={valueScale}
              left={margin.left}
              label="Reward"
              numTicks={valueScale.ticks().length / 4}
              tickFormat={(value) => `${value}`}
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

            <Line
              from={{
                x: stepScale(Math.round(tooltipLeft * fps)),
                y: margin.top,
              }}
              to={{
                x: stepScale(Math.round(tooltipLeft * fps)),
                y: innerHeight + margin.top,
              }}
              stroke={theme.palette.primary.main}
              strokeWidth={3}
              pointerEvents="none"
            />
          </Group>

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
            onDoubleClick={(event) =>
              onCorrectionClick(
                Math.floor(stepScale.invert(localPoint(event)?.x || 0)),
              )
            }
            onMouseLeave={() => hideTooltip()}
          />

          {proposedFeedbackMarkers.map((marker, index) => (
            <g
              key={"marker_" + index}
              transform={`translate(${stepScale(marker.x) - 9},${0})`}
            >
              <LocationOnIcon
                inheritViewBox
                sx={{
                  color: theme.palette.primary.dark,
                  "&:hover": {
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
              key={"marker_" + index}
              transform={`translate(${stepScale(marker.x) - 9},${0})`}
            >
              <LocationOnIcon
                inheritViewBox
                sx={{
                  "&:hover": {
                    stroke: theme.palette.background.default,
                  },
                }}
                color="primary"
                fontSize="small"
                onClick={() => onCorrectionClick(marker.x)}
              />
            </g>
          ))}
        </svg>

        {tooltipData && (
          <div>
            <TooltipWithBounds
              key={Math.random()}
              top={tooltipTop - 12}
              left={stepScale(Math.round(tooltipLeft * fps)) + 12}
            >
              {`${tooltipData.value}`}
            </TooltipWithBounds>
            <Tooltip
              top={innerHeight + margin.top - 14}
              left={stepScale(Math.round(tooltipLeft * fps))}
              style={{
                ...defaultStyles,
                minWidth: 72,
                textAlign: "center",
                transform: "translateX(-50%)",
              }}
            >
              {tooltipData.index}
            </Tooltip>
          </div>
        )}

        {useCorrectiveFeedback && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              padding: "5px 10px 0 0",
            }}
          >
            <div
              style={{
                color: theme.palette.text.secondary,
                fontSize: 13,
                fontFamily: "sans-serif",
              }}
            >
              <div>Double click to correct</div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
