import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Line, Bar, LinePath, AreaClosed } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows, GridColumns } from "@visx/grid";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { withTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";
//@ts-ignore // no types for withTooltip
import { WithTooltipProvidedProps } from "@visx/tooltip/lib/enhancers/withTooltip";
import { localPoint } from "@visx/event";
import { useTheme, alpha } from "@mui/material/styles";
import { useActiveLearningState } from "../ActiveLearningContext";
import { getEpisodeColor } from "./utils/trajectoryColors";

type TimelineComponentProps = {
  selectedEpisode: number;
  selectedStep: number | null;
  stepForCorrection?: number | null;
  onClose: () => void;
  onStepHover?: (step: number) => void;
  onCorrectionStepSelect?: (step: number) => void;
  interactionLocked?: boolean;
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  variant?: 'overlay' | 'inline';
  showClose?: boolean;
};

type TooltipProps = { value: number; index: number; uncertainty?: number };

// choose ~2–3 clean ticks regardless of height
function pickTicks(scale: any, desired = 3): number[] {
  const t = scale.ticks(6);
  if (t.length <= desired) return t;
  const out = [t[0]];
  const step = (t.length - 1) / (desired - 1);
  for (let i = 1; i < desired - 1; i++) out.push(t[Math.round(i * step)]);
  out.push(t[t.length - 1]);
  // ensure uniqueness, ascending
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

function estimateLabelWidth(values: number[], digits = 2) {
  const labels = values.map((v) => Number(v).toFixed(digits));
  const charW = 6.5; // ~px at 11px font
  const pad = 12;
  return Math.ceil(Math.max(...labels.map((s) => s.length)) * charW + pad);
}

const TimelineComponent = withTooltip<TimelineComponentProps, TooltipProps>(
  ({
    selectedEpisode,
    selectedStep,
    stepForCorrection,
    onClose,
    onStepHover,
    onCorrectionStepSelect,
    interactionLocked = false,
    width = 600,
    height = 200,
    margin = { top: 16, right: 10, bottom: 30, left: 48 },
    variant = 'overlay',
    showClose = true,
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  }: TimelineComponentProps & WithTooltipProvidedProps<TooltipProps>) => {
    const theme = useTheme();
    const {
      episodeIndices,
      predicted_rewards,
      predicted_uncertainties,
      trajectoryColors,
      globalRewardRange,
      globalUncertaintyRange,
    } = useActiveLearningState();

    const episodeColor = getEpisodeColor(selectedEpisode, trajectoryColors, true);

    const [hoverStep, setHoverStep] = useState<number | null>(null);

    useEffect(() => {
      setHoverStep(null);
    }, [selectedEpisode]);

    useEffect(() => {
      if (interactionLocked) {
        setHoverStep(null);
      }
    }, [interactionLocked]);

    // episode data
    const episodeData = useMemo(() => {
      if (!episodeIndices || episodeIndices.length === 0) {
        return { rewards: [], uncertainties: [], startIndex: 0, endIndex: 0 };
      }
      const start = episodeIndices.findIndex((idx) => idx === selectedEpisode);
      if (start === -1) {
        return { rewards: [], uncertainties: [], startIndex: 0, endIndex: 0 };
      }
      let end = start;
      for (let i = start + 1; i < episodeIndices.length; i++) {
        if (episodeIndices[i] !== selectedEpisode) break;
        end = i;
      }
      return {
        rewards: predicted_rewards.slice(start, end + 1),
        uncertainties: predicted_uncertainties.slice(start, end + 1),
        startIndex: start,
        endIndex: end,
      };
    }, [selectedEpisode, episodeIndices, predicted_rewards, predicted_uncertainties]);

    const { rewards, uncertainties } = episodeData;
    if (width < 10 || rewards.length === 0) return null;

    // layout
    const innerHeight = height - margin.top - margin.bottom;
    const panelGap = 10;
    const topPanelHeight = Math.floor((innerHeight - panelGap) / 2);
    const bottomPanelHeight = innerHeight - topPanelHeight - panelGap;
    const topPanelTop = margin.top;
    const bottomPanelTop = margin.top + topPanelHeight + panelGap;

    // colors
    const rewardColor = theme.palette.success.main;
    const rewardFill = alpha(rewardColor, 0.18);
    const uncertColor = theme.palette.warning.main;
    const uncertFill = alpha(uncertColor, 0.18);

    // domains
    const rewardDomain: [number, number] = useMemo(() => {
      if (globalRewardRange) return globalRewardRange;
      return [Math.min(...rewards), Math.max(...rewards)];
    }, [globalRewardRange, rewards]);

    const uncertaintyDomain: [number, number] = useMemo(() => {
      if (globalUncertaintyRange) return globalUncertaintyRange;
      return [0, Math.max(...uncertainties)];
    }, [globalUncertaintyRange, uncertainties]);

    // y scales (already offset by panel tops)
    const rewardScale = useMemo(
      () =>
        scaleLinear<number>({
          range: [topPanelTop + topPanelHeight, topPanelTop],
          domain: rewardDomain,
          nice: true,
        }),
      [topPanelTop, topPanelHeight, rewardDomain]
    );

    const uncertaintyScale = useMemo(
      () =>
        scaleLinear<number>({
          range: [bottomPanelTop + bottomPanelHeight, bottomPanelTop],
          domain: uncertaintyDomain,
          nice: true,
        }),
      [bottomPanelTop, bottomPanelHeight, uncertaintyDomain]
    );

    // pick compact ticks
    const rewardTicks = useMemo(() => pickTicks(rewardScale, 3), [rewardScale]);
    const uncertTicks = useMemo(() => pickTicks(uncertaintyScale, 3), [uncertaintyScale]);

    // auto left margin so labels don't cramp
    const neededLeft = Math.max(
      estimateLabelWidth(rewardTicks),
      estimateLabelWidth(uncertTicks)
    );
    const m = { ...margin, left: Math.max(margin.left, neededLeft) };
    const innerWidth = width - m.left - m.right;

    // x scale (shared)
    const stepScale = useMemo(
      () =>
        scaleLinear<number>({
          range: [m.left, innerWidth + m.left],
          domain: [0, Math.max(0, rewards.length - 1)],
        }),
      [m.left, innerWidth, rewards.length]
    );

    // area baselines
    const rewardBaselineY =
      rewardDomain[0] <= 0 && rewardDomain[1] >= 0
        ? rewardScale(0)
        : rewardScale(rewardDomain[0]);
    const uncertaintyBaselineY = uncertaintyScale(uncertaintyDomain[0]);

    // interactions
    const handleTooltip = useCallback(
      (
        event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>
      ) => {
        if (interactionLocked) return;
        const { x } = localPoint(event) || { x: -1 };
        if (x === -1) return;
        const x0 = stepScale.invert(x);
        const idx = Math.max(0, Math.min(Math.round(x0), rewards.length - 1));
        if (idx !== hoverStep) {
          setHoverStep(idx);
          onStepHover?.(idx);
        }
        showTooltip({
          tooltipData: { value: rewards[idx], index: idx, uncertainty: uncertainties[idx] },
          tooltipLeft: stepScale(idx),
          tooltipTop: rewardScale(rewards[idx]),
        });
      },
      [interactionLocked, stepScale, rewards, uncertainties, showTooltip, rewardScale, onStepHover, hoverStep]
    );

    const handleClick = useCallback(
      (event: React.MouseEvent<SVGRectElement>) => {
        if (interactionLocked) return;
        const { x } = localPoint(event) || { x: -1 };
        if (x === -1) return;
        const idx = Math.max(0, Math.min(Math.round(stepScale.invert(x)), rewards.length - 1));
        setHoverStep(idx);
        onCorrectionStepSelect?.(idx);
      },
      [interactionLocked, stepScale, rewards.length, onCorrectionStepSelect]
    );

    const highlightedStep = hoverStep !== null ? hoverStep : selectedStep;
    const correctionCandidate =
      typeof stepForCorrection === 'number' && Number.isFinite(stepForCorrection)
        ? stepForCorrection
        : null;
    const hasCorrectionStep =
      correctionCandidate !== null &&
      correctionCandidate >= 0 &&
      correctionCandidate < rewards.length;
    const correctionIndicatorX = hasCorrectionStep && correctionCandidate !== null
      ? stepScale(correctionCandidate)
      : null;
    const correctionIndicatorBaseY = innerHeight + m.top + 6;
    const correctionIndicatorTipY = innerHeight + m.top - 2;

    return (
      <Box
        sx={
          variant === 'overlay'
            ? {
              position: "absolute",
              bottom: 60,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "2px solid",
              borderColor: episodeColor,
              borderRadius: 2,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              backdropFilter: "blur(8px)",
            }
            : { width: '100%' }
        }
      >
        <Box sx={{ p: variant === 'overlay' ? 0.5 : 0, position: "relative" }}>
          {variant === 'overlay' && showClose && (
            <IconButton
              onClick={onClose}
              size="small"
              sx={{
                position: "absolute",
                top: -8,
                right: -8,
                zIndex: 1001,
                backgroundColor: "rgba(255,255,255,0.9)",
                "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
                width: 20,
                height: 20,
                border: `1px solid ${episodeColor}`,
              }}
            >
              <CloseIcon sx={{ fontSize: 12 }} />
            </IconButton>
          )}

          {/* Title */}
          <Typography
            variant={variant === 'overlay' ? 'subtitle2' : 'subtitle2'}
            sx={{
              color: theme.palette.text.secondary,
              px: 1,
              pt: variant === 'overlay' ? 0.5 : 0,
              pb: 0.5,
            }}
          >
            Episode {selectedEpisode} Timeline
          </Typography>

          <svg width={width} height={height} style={{ borderRadius: 8, overflow: "hidden" }}>
            <rect x={0} y={0} width={width} height={height} fill={theme.palette.background.paper} />

            <Group left={0} top={0}>
              {/* shared vertical grid */}
              <GridColumns
                top={m.top}
                scale={stepScale}
                height={innerHeight}
                strokeDasharray="1,3"
                stroke={theme.palette.divider}
                strokeOpacity={0.35}
                pointerEvents="none"
              />

              {/* === TOP: Reward === */}
              <GridRows
                left={m.left}
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
              {/* optional zero line */}
              {rewardDomain[0] <= 0 && rewardDomain[1] >= 0 && (
                <Line
                  from={{ x: m.left, y: rewardScale(0) }}
                  to={{ x: innerWidth + m.left, y: rewardScale(0) }}
                  stroke={theme.palette.text.secondary}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              )}
              <AxisLeft
                scale={rewardScale}
                left={m.left}
                tickValues={rewardTicks}
                tickFormat={(v) => `${Number(v).toFixed(2)}`}
                tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 11 }}
                tickLineProps={{ stroke: theme.palette.text.secondary }}
                stroke={theme.palette.text.secondary}
              />

              {/* === BOTTOM: Uncertainty === */}
              <GridRows
                left={m.left}
                scale={uncertaintyScale}
                width={innerWidth}
                numTicks={uncertTicks.length}
                strokeDasharray="1,3"
                stroke={theme.palette.divider}
                strokeOpacity={0.35}
                pointerEvents="none"
              />
              <AreaClosed
                data={uncertainties}
                x={(_, i) => stepScale(i)}
                y={(d) => uncertaintyScale(d)}
                yScale={uncertaintyScale}
                y0={() => uncertaintyBaselineY}
                curve={curveMonotoneX}
                fill={uncertFill}
                stroke="none"
              />
              <LinePath
                data={uncertainties}
                x={(_, i) => stepScale(i)}
                y={(d) => uncertaintyScale(d)}
                strokeWidth={2}
                stroke={uncertColor}
                curve={curveMonotoneX}
              />
              <AxisLeft
                scale={uncertaintyScale}
                left={m.left}
                tickValues={uncertTicks}
                tickFormat={(v) => `${Number(v).toFixed(2)}`}
                tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 11 }}
                tickLineProps={{ stroke: theme.palette.text.secondary }}
                stroke={theme.palette.text.secondary}
              />

              {/* shared x-axis */}
              <AxisBottom
                scale={stepScale}
                top={innerHeight + m.top}
                numTicks={Math.min(10, rewards.length)}
                tickFormat={(v) => `${Math.round(Number(v))}`}
                stroke={theme.palette.text.secondary}
                tickLabelProps={{ fill: theme.palette.text.primary, fontSize: 10 }}
                tickLineProps={{ stroke: theme.palette.text.secondary }}
              />

              {/* crosshair */}
              {highlightedStep !== null &&
                highlightedStep >= 0 &&
                highlightedStep < rewards.length && (
                  <Line
                    from={{ x: stepScale(highlightedStep), y: m.top }}
                    to={{ x: stepScale(highlightedStep), y: innerHeight + m.top }}
                    stroke={theme.palette.info.dark}
                    strokeWidth={3}
                    strokeDasharray="5,5"
                    pointerEvents="none"
                  />
                )}

              {/* correction indicator */}
              {hasCorrectionStep && correctionIndicatorX !== null && (
                <polygon
                  points={`${correctionIndicatorX - 6},${correctionIndicatorBaseY} ${correctionIndicatorX + 6},${correctionIndicatorBaseY} ${correctionIndicatorX},${correctionIndicatorTipY}`}
                  fill={theme.palette.info.main}
                  stroke={alpha(theme.palette.background.paper, 0.9)}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              )}
            </Group>

            {/* interaction layer */}
            <Bar
              x={m.left}
              y={m.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onTouchStart={handleTooltip}
              onTouchMove={handleTooltip}
              onTouchEnd={() => {
                hideTooltip();
                setHoverStep(null);
              }}
              onMouseMove={handleTooltip}
              onClick={handleClick}
              onMouseLeave={() => {
                hideTooltip();
                setHoverStep(null);
              }}
              style={{ cursor: interactionLocked ? 'default' : 'pointer' }}
            />
          </svg>

          {/* Tooltip */}
          {tooltipData && (
            <TooltipWithBounds
              key={`timeline-tooltip-${selectedEpisode}-${tooltipData.index}`}
              top={tooltipTop - 12}
              left={tooltipLeft + 12}
              style={{
                ...defaultStyles,
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <div><strong>Step {tooltipData.index}</strong></div>
              <div style={{ color: theme.palette.success.main }}>
                Reward: {tooltipData.value.toFixed(3)}
              </div>
              {tooltipData.uncertainty !== undefined && (
                <div style={{ color: theme.palette.warning.main }}>
                  Uncertainty: {tooltipData.uncertainty.toFixed(3)}
                </div>
              )}
            </TooltipWithBounds>
          )}

          {/* Keep legend inline; skip absolute when embedded */}
          <Box
            sx={
              variant === 'overlay'
                ? { position: "absolute", top: 8, right: 8, display: "flex", gap: 2, fontSize: "12px" }
                : { display: "flex", gap: 2, fontSize: "12px", mt: 0.5, justifyContent: 'flex-end' }
            }
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.success.main, opacity: 0.9 }} />
              <Typography variant="caption">Predicted Reward</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.warning.main, opacity: 0.9 }} />
              <Typography variant="caption">Uncertainty</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }
);

export default TimelineComponent;
