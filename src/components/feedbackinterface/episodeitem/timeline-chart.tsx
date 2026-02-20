import React, { useMemo, useCallback } from "react";
import { AreaClosed, Line, Bar, LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows, GridColumns } from "@visx/grid";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import {
  withTooltip,
  Tooltip,
  TooltipWithBounds,
  defaultStyles,
} from "@visx/tooltip";
import { WithTooltipProvidedProps } from "@visx/tooltip/lib/enhancers/withTooltip";
import { localPoint } from "@visx/event";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { Box, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";

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
  interactionLocked?: boolean;
  stepForCorrection?: number | null;
};

type TooltipProps = {
  value: number;
  index: number;
  uncertainty?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeDomain(minValue: number, maxValue: number): [number, number] {
  if (minValue === maxValue) {
    return [minValue - 1, maxValue + 1];
  }
  return [minValue, maxValue];
}

function shortTickCount(length: number): number {
  return Math.min(6, Math.max(3, Math.floor(length / 8)));
}

export default withTooltip<TimelineChartProps, TooltipProps>(
  ({
    width,
    height,
    rewards,
    uncertainty,
    margin = { top: 14, right: 10, bottom: 22, left: 42 },
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
    interactionLocked = false,
    stepForCorrection = null,
  }: TimelineChartProps & WithTooltipProvidedProps<TooltipProps>) => {
    if (width < 10 || rewards.length === 0) return null;

    const theme = useTheme();

    const rewardColor = theme.palette.success.main;
    const rewardFill = alpha(rewardColor, 0.18);
    const uncertaintyColor = theme.palette.warning.main;
    const uncertaintyFill = alpha(uncertaintyColor, 0.18);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const panelGap = 8;
    const rewardPanelHeight = Math.floor((innerHeight - panelGap) / 2);
    const uncertaintyPanelHeight = innerHeight - rewardPanelHeight - panelGap;
    const rewardPanelTop = margin.top;
    const uncertaintyPanelTop = margin.top + rewardPanelHeight + panelGap;

    // Slightly shorten x-span so x-axis does not occupy full width
    const xPadding = Math.max(14, Math.floor(innerWidth * 0.05));
    const xStart = margin.left + xPadding;
    const xEnd = margin.left + innerWidth - xPadding;
    const xChartWidth = Math.max(40, xEnd - xStart);

    const safeDuration = videoDuration > 0 ? videoDuration : 1;
    const fps = rewards.length / safeDuration;
    const currentStep = clamp(Math.round(tooltipLeft * fps), 0, rewards.length - 1);

    const rewardMin = Math.min(...rewards);
    const rewardMax = Math.max(...rewards);
    const uncertaintyMax = uncertainty.length > 0 ? Math.max(...uncertainty) : 0;

    const stepScale = useMemo(
      () =>
        scaleLinear({
          range: [xStart, xEnd],
          domain: [0, Math.max(0, rewards.length - 1)],
        }),
      [xStart, xEnd, rewards.length],
    );

    const rewardScale = useMemo(
      () =>
        scaleLinear({
          range: [rewardPanelTop + rewardPanelHeight, rewardPanelTop],
          domain: safeDomain(rewardMin, rewardMax),
          nice: true,
        }),
      [rewardPanelTop, rewardPanelHeight, rewardMin, rewardMax],
    );

    const uncertaintyScale = useMemo(
      () =>
        scaleLinear({
          range: [uncertaintyPanelTop + uncertaintyPanelHeight, uncertaintyPanelTop],
          domain: [0, uncertaintyMax > 0 ? uncertaintyMax : 1],
          nice: true,
        }),
      [uncertaintyPanelTop, uncertaintyPanelHeight, uncertaintyMax],
    );

    const rewardTicks = useMemo(() => rewardScale.ticks(3), [rewardScale]);
    const uncertaintyTicks = useMemo(() => uncertaintyScale.ticks(3), [uncertaintyScale]);

    const rewardBaselineY =
      rewardMin <= 0 && rewardMax >= 0 ? rewardScale(0) : rewardScale(rewardMin);
    const uncertaintyBaselineY = uncertaintyScale(0);

    const handleTooltip = useCallback(
      (
        event:
          | React.TouchEvent<SVGRectElement>
          | React.MouseEvent<SVGRectElement>,
      ) => {
        if (interactionLocked) return;
        const point = localPoint(event);
        if (!point) return;

        const idx = clamp(Math.round(stepScale.invert(point.x)), 0, rewards.length - 1);
        showTooltip({
          tooltipData: {
            value: rewards[idx],
            index: idx,
            uncertainty: uncertainty[idx],
          },
          tooltipLeft: idx / (fps || 1),
          tooltipTop: rewardScale(rewards[idx]),
        });
        onChange(idx / (fps || 1));
      },
      [
        interactionLocked,
        stepScale,
        rewards,
        uncertainty,
        showTooltip,
        fps,
        rewardScale,
        onChange,
      ],
    );

    const handleCorrectionSelect = useCallback(
      (
        event:
          | React.TouchEvent<SVGRectElement>
          | React.MouseEvent<SVGRectElement>,
      ) => {
        if (interactionLocked) return;
        const point = localPoint(event);
        if (!point) return;
        const idx = clamp(Math.round(stepScale.invert(point.x)), 0, rewards.length - 1);
        onCorrectionClick(idx);
      },
      [interactionLocked, stepScale, rewards.length, onCorrectionClick],
    );

    return (
      <div style={{ position: "relative" }}>
        <svg width={width} height={height}>
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={theme.palette.background.l0}
          />

          <Group left={0} top={0}>
            <GridColumns
              top={margin.top}
              scale={stepScale}
              height={innerHeight}
              numTicks={shortTickCount(rewards.length)}
              strokeDasharray="1,3"
              stroke={theme.palette.divider}
              strokeOpacity={0.35}
              pointerEvents="none"
            />

            <GridRows
              left={xStart}
              scale={rewardScale}
              width={xChartWidth}
              numTicks={rewardTicks.length}
              strokeDasharray="1,3"
              stroke={theme.palette.divider}
              strokeOpacity={0.35}
              pointerEvents="none"
            />
            <AreaClosed
              data={rewards}
              x={(_, i) => stepScale(i)}
              y={(d) => rewardScale(d)}
              yScale={rewardScale}
              y0={() => rewardBaselineY}
              curve={curveMonotoneX}
              fill={rewardFill}
              stroke="none"
            />
            <LinePath
              data={rewards}
              x={(_, i) => stepScale(i)}
              y={(d) => rewardScale(d)}
              strokeWidth={2}
              stroke={rewardColor}
              curve={curveMonotoneX}
            />
            <AxisLeft
              scale={rewardScale}
              left={xStart}
              tickValues={rewardTicks}
              tickFormat={(v) => `${Number(v).toFixed(2)}`}
              tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 10 }}
              tickLineProps={{ stroke: theme.palette.text.secondary }}
              stroke={theme.palette.text.secondary}
            />

            <GridRows
              left={xStart}
              scale={uncertaintyScale}
              width={xChartWidth}
              numTicks={uncertaintyTicks.length}
              strokeDasharray="1,3"
              stroke={theme.palette.divider}
              strokeOpacity={0.35}
              pointerEvents="none"
            />
            <AreaClosed
              data={uncertainty.length > 0 ? uncertainty : rewards.map(() => 0)}
              x={(_, i) => stepScale(i)}
              y={(d) => uncertaintyScale(d)}
              yScale={uncertaintyScale}
              y0={() => uncertaintyBaselineY}
              curve={curveMonotoneX}
              fill={uncertaintyFill}
              stroke="none"
            />
            <LinePath
              data={uncertainty.length > 0 ? uncertainty : rewards.map(() => 0)}
              x={(_, i) => stepScale(i)}
              y={(d) => uncertaintyScale(d)}
              strokeWidth={2}
              stroke={uncertaintyColor}
              curve={curveMonotoneX}
            />
            <AxisLeft
              scale={uncertaintyScale}
              left={xStart}
              tickValues={uncertaintyTicks}
              tickFormat={(v) => `${Number(v).toFixed(2)}`}
              tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 10 }}
              tickLineProps={{ stroke: theme.palette.text.secondary }}
              stroke={theme.palette.text.secondary}
            />

            <AxisBottom
              scale={stepScale}
              top={margin.top + innerHeight}
              numTicks={shortTickCount(rewards.length)}
              tickFormat={(v) => `${Math.round(Number(v))}`}
              stroke={theme.palette.text.secondary}
              tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 10 }}
              tickLineProps={{ stroke: theme.palette.text.secondary }}
            />

            <Line
              from={{ x: stepScale(currentStep), y: margin.top }}
              to={{ x: stepScale(currentStep), y: margin.top + innerHeight }}
              stroke={theme.palette.info.dark}
              strokeWidth={2}
              strokeDasharray="5,5"
              pointerEvents="none"
            />

            {stepForCorrection !== null && stepForCorrection >= 0 && stepForCorrection < rewards.length && (
              <polygon
                points={`${stepScale(stepForCorrection) - 6},${margin.top + innerHeight + 5} ${stepScale(stepForCorrection) + 6},${margin.top + innerHeight + 5} ${stepScale(stepForCorrection)},${margin.top + innerHeight - 2}`}
                fill={theme.palette.info.main}
                stroke={alpha(theme.palette.background.paper, 0.9)}
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
          </Group>

          <Bar
            x={xStart}
            y={margin.top}
            width={xChartWidth}
            height={innerHeight}
            fill="transparent"
            rx={8}
            onTouchStart={handleTooltip}
            onTouchMove={handleTooltip}
            onMouseMove={handleTooltip}
            onDoubleClick={handleCorrectionSelect}
            onMouseLeave={() => hideTooltip()}
            style={{ cursor: interactionLocked ? "default" : "pointer" }}
          />

          {proposedFeedbackMarkers.map((marker, index) => (
            <g
              key={`proposed_marker_${index}`}
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
                onClick={() => {
                  if (!interactionLocked) onCorrectionClick(marker.x);
                }}
              />
            </g>
          ))}

          {givenFeedbackMarkers.map((marker, index) => (
            <g
              key={`given_marker_${index}`}
              transform={`translate(${stepScale(marker.x) - 9},${0})`}
            >
              <LocationOnIcon
                inheritViewBox
                color="primary"
                fontSize="small"
                onClick={() => {
                  if (!interactionLocked) onCorrectionClick(marker.x);
                }}
              />
            </g>
          ))}
        </svg>

        {tooltipData && (
          <TooltipWithBounds
            key={Math.random()}
            top={tooltipTop - 12}
            left={stepScale(clamp(Math.round(tooltipLeft * fps), 0, rewards.length - 1)) + 10}
            style={{
              ...defaultStyles,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <div><strong>Step {tooltipData.index}</strong></div>
            <div style={{ color: rewardColor }}>
              Reward: {tooltipData.value.toFixed(3)}
            </div>
            {tooltipData.uncertainty !== undefined && (
              <div style={{ color: uncertaintyColor }}>
                Uncertainty: {tooltipData.uncertainty.toFixed(3)}
              </div>
            )}
          </TooltipWithBounds>
        )}

        <Tooltip
          top={margin.top + innerHeight - 14}
          left={stepScale(clamp(Math.round(tooltipLeft * fps), 0, rewards.length - 1))}
          style={{
            ...defaultStyles,
            minWidth: 52,
            textAlign: "center",
            transform: "translateX(-50%)",
          }}
        >
          {clamp(Math.round(tooltipLeft * fps), 0, rewards.length - 1)}
        </Tooltip>

        <Box
          sx={{
            position: "absolute",
            top: 6,
            right: 8,
            display: "flex",
            gap: 1.5,
            fontSize: "12px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: rewardColor, opacity: 0.9 }} />
            <Typography variant="caption">Predicted Reward</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: uncertaintyColor, opacity: 0.9 }} />
            <Typography variant="caption">Uncertainty</Typography>
          </Box>
        </Box>

        {useCorrectiveFeedback && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 6,
              padding: "3px 8px 0 0",
              color: theme.palette.text.secondary,
              fontSize: 12,
              fontFamily: "sans-serif",
            }}
          >
            {interactionLocked ? "Correction step locked" : "Double click to correct"}
          </div>
        )}
      </div>
    );
  },
);
