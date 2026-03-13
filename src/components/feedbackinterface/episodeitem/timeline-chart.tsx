import React, { useMemo, useCallback } from "react";
import { AreaClosed, Line, Bar, LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows, GridColumns } from "@visx/grid";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import {
  withTooltip,
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

function pickTicks(scale: any, desired = 3): number[] {
  const ticks = scale.ticks(6);
  if (ticks.length <= desired) return ticks;

  const output = [ticks[0]];
  const step = (ticks.length - 1) / (desired - 1);
  for (let i = 1; i < desired - 1; i += 1) {
    output.push(ticks[Math.round(i * step)]);
  }
  output.push(ticks[ticks.length - 1]);

  return Array.from(new Set(output)).sort((a, b) => a - b);
}

function estimateLabelWidth(values: number[], digits = 2): number {
  const labels = values.map((value) => Number(value).toFixed(digits));
  const charWidth = 6.5;
  const padding = 12;
  return Math.ceil(Math.max(...labels.map((label) => label.length)) * charWidth + padding);
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

    const uncertaintySeries = uncertainty.length > 0 ? uncertainty : rewards.map(() => 0);

    const innerHeight = height - margin.top - margin.bottom;
    if (innerHeight <= 0) return null;

    const panelGap = 8;
    const rewardPanelHeight = Math.floor((innerHeight - panelGap) / 2);
    const uncertaintyPanelHeight = innerHeight - rewardPanelHeight - panelGap;
    const rewardPanelTop = margin.top;
    const uncertaintyPanelTop = margin.top + rewardPanelHeight + panelGap;

    const rewardDomain = safeDomain(Math.min(...rewards), Math.max(...rewards));
    const uncertaintyDomain = safeDomain(
      Math.min(...uncertaintySeries),
      Math.max(...uncertaintySeries),
    );

    const rewardScale = useMemo(
      () =>
        scaleLinear({
          range: [rewardPanelTop + rewardPanelHeight, rewardPanelTop],
          domain: rewardDomain,
          nice: true,
        }),
      [rewardPanelTop, rewardPanelHeight, rewardDomain],
    );

    const uncertaintyScale = useMemo(
      () =>
        scaleLinear({
          range: [uncertaintyPanelTop + uncertaintyPanelHeight, uncertaintyPanelTop],
          domain: uncertaintyDomain,
          nice: true,
        }),
      [uncertaintyPanelTop, uncertaintyPanelHeight, uncertaintyDomain],
    );

    const rewardTicks = useMemo(() => pickTicks(rewardScale, 3), [rewardScale]);
    const uncertaintyTicks = useMemo(
      () => pickTicks(uncertaintyScale, 3),
      [uncertaintyScale],
    );

    const neededLeft = Math.max(
      estimateLabelWidth(rewardTicks),
      estimateLabelWidth(uncertaintyTicks),
    );

    const adjustedMargin = {
      ...margin,
      left: Math.max(margin.left, neededLeft),
    };

    const innerWidth = width - adjustedMargin.left - adjustedMargin.right;
    if (innerWidth <= 10) return null;

    const stepScale = useMemo(
      () =>
        scaleLinear({
          range: [adjustedMargin.left, innerWidth + adjustedMargin.left],
          domain: [0, Math.max(0, rewards.length - 1)],
        }),
      [adjustedMargin.left, innerWidth, rewards.length],
    );

    const safeDuration = videoDuration > 0 ? videoDuration : 1;
    const fps = rewards.length / safeDuration;
    const currentStep = clamp(Math.round(tooltipLeft * fps), 0, rewards.length - 1);

    const rewardBaselineY =
      rewardDomain[0] <= 0 && rewardDomain[1] >= 0
        ? rewardScale(0)
        : rewardScale(rewardDomain[0]);
    const uncertaintyBaselineY = uncertaintyScale(uncertaintyDomain[0]);
    const panelLabelOffsetY = 10;

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
            uncertainty: uncertaintySeries[idx],
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
        uncertaintySeries,
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
              top={adjustedMargin.top}
              scale={stepScale}
              height={innerHeight}
              numTicks={shortTickCount(rewards.length)}
              strokeDasharray="1,3"
              stroke={theme.palette.divider}
              strokeOpacity={0.35}
              pointerEvents="none"
            />

            <GridRows
              left={adjustedMargin.left}
              scale={rewardScale}
              width={innerWidth}
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
              left={adjustedMargin.left}
              tickValues={rewardTicks}
              tickFormat={(value) => `${Number(value).toFixed(2)}`}
              tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 11 }}
              tickLineProps={{ stroke: theme.palette.text.secondary }}
              stroke={theme.palette.text.secondary}
            />

            <GridRows
              left={adjustedMargin.left}
              scale={uncertaintyScale}
              width={innerWidth}
              numTicks={uncertaintyTicks.length}
              strokeDasharray="1,3"
              stroke={theme.palette.divider}
              strokeOpacity={0.35}
              pointerEvents="none"
            />
            <AreaClosed
              data={uncertaintySeries}
              x={(_, i) => stepScale(i)}
              y={(d) => uncertaintyScale(d)}
              yScale={uncertaintyScale}
              y0={() => uncertaintyBaselineY}
              curve={curveMonotoneX}
              fill={uncertaintyFill}
              stroke="none"
            />
            <LinePath
              data={uncertaintySeries}
              x={(_, i) => stepScale(i)}
              y={(d) => uncertaintyScale(d)}
              strokeWidth={2}
              stroke={uncertaintyColor}
              curve={curveMonotoneX}
            />
            <AxisLeft
              scale={uncertaintyScale}
              left={adjustedMargin.left}
              tickValues={uncertaintyTicks}
              tickFormat={(value) => `${Number(value).toFixed(2)}`}
              tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 11 }}
              tickLineProps={{ stroke: theme.palette.text.secondary }}
              stroke={theme.palette.text.secondary}
            />

            <AxisBottom
              scale={stepScale}
              top={adjustedMargin.top + innerHeight}
              numTicks={shortTickCount(rewards.length)}
              tickFormat={(value) => `${Math.round(Number(value))}`}
              stroke={theme.palette.text.secondary}
              tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 10 }}
              tickLineProps={{ stroke: theme.palette.text.secondary }}
            />

            <Line
              from={{ x: stepScale(currentStep), y: adjustedMargin.top }}
              to={{ x: stepScale(currentStep), y: adjustedMargin.top + innerHeight }}
              stroke={theme.palette.info.dark}
              strokeWidth={2}
              strokeDasharray="5,5"
              pointerEvents="none"
            />

            {stepForCorrection !== null &&
              stepForCorrection >= 0 &&
              stepForCorrection < rewards.length && (
                <polygon
                  points={`${stepScale(stepForCorrection) - 6},${adjustedMargin.top + innerHeight + 5} ${stepScale(stepForCorrection) + 6},${adjustedMargin.top + innerHeight + 5} ${stepScale(stepForCorrection)},${adjustedMargin.top + innerHeight - 2}`}
                  fill={theme.palette.info.main}
                  stroke={alpha(theme.palette.background.paper, 0.9)}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              )}
          </Group>

          <Bar
            x={adjustedMargin.left}
            y={adjustedMargin.top}
            width={innerWidth}
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
              zIndex: 40,
              pointerEvents: "none",
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

        <Box
          sx={{
            position: "absolute",
            top: Math.max(0, rewardPanelTop - panelLabelOffsetY),
            right: 8,
            display: "flex",
            gap: 0.5,
            fontSize: "12px",
            alignItems: "center",
            px: 0.4,
            py: 0.15,
            borderRadius: "4px",
            bgcolor: alpha(theme.palette.background.paper, 0.82),
            zIndex: 12,
          }}
        >
          <Box sx={{ width: 10, height: 10, bgcolor: rewardColor, opacity: 0.9 }} />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Predicted Reward
          </Typography>
        </Box>

        <Box
          sx={{
            position: "absolute",
            top: Math.max(0, uncertaintyPanelTop - panelLabelOffsetY),
            right: 8,
            display: "flex",
            gap: 0.5,
            fontSize: "12px",
            alignItems: "center",
            px: 0.4,
            py: 0.15,
            borderRadius: "4px",
            bgcolor: alpha(theme.palette.background.paper, 0.82),
            zIndex: 12,
          }}
        >
          <Box sx={{ width: 10, height: 10, bgcolor: uncertaintyColor, opacity: 0.9 }} />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Uncertainty
          </Typography>
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
