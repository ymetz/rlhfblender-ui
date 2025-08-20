import React, { useMemo, useCallback } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Line, Bar, LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { GridRows, GridColumns } from "@visx/grid";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { Glyph as GlyphCircle } from "@visx/glyph";
import {
  withTooltip,
  Tooltip as VisxTooltip,
  TooltipWithBounds,
  defaultStyles,
} from "@visx/tooltip";
import { WithTooltipProvidedProps } from "@visx/tooltip/lib/enhancers/withTooltip";
import { localPoint } from "@visx/event";
import { useTheme } from "@mui/material/styles";
import { useActiveLearningState } from "../ActiveLearningContext";
import { getEpisodeColor } from "./utils/trajectoryColors";

type TimelineComponentProps = {
  selectedEpisode: number;
  selectedStep: number | null;
  onClose: () => void;
  onStepSelect?: (step: number) => void;
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
};

type TooltipProps = {
  value: number;
  index: number;
  uncertainty?: number;
};

const TimelineComponent = withTooltip<TimelineComponentProps, TooltipProps>(
  ({
    selectedEpisode,
    selectedStep,
    onClose,
    onStepSelect,
    width = 600,
    height = 100,
    margin = { top: 15, right: 10, bottom: 30, left: 45 },
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
  }: TimelineComponentProps & WithTooltipProvidedProps<TooltipProps>) => {
    const theme = useTheme();
    const activeLearningState = useActiveLearningState();
    
    // Extract episode data from the global state
    const { 
      episodeIndices, 
      predicted_rewards, 
      predicted_uncertainties, 
      trajectoryColors,
      globalRewardRange,
      globalUncertaintyRange 
    } = activeLearningState;
    
    // Get the color for this episode
    const episodeColor = getEpisodeColor(selectedEpisode, trajectoryColors, true);

    // Calculate episode-specific data
    const episodeData = useMemo(() => {
      if (!episodeIndices || episodeIndices.length === 0) {
        return { rewards: [], uncertainties: [], startIndex: 0, endIndex: 0 };
      }

      // Find all indices that belong to the selected episode
      const episodeStartIndex = episodeIndices.findIndex(idx => idx === selectedEpisode);
      if (episodeStartIndex === -1) {
        return { rewards: [], uncertainties: [], startIndex: 0, endIndex: 0 };
      }

      // Find where this episode ends (where the next different episode starts)
      let episodeEndIndex = episodeStartIndex;
      for (let i = episodeStartIndex + 1; i < episodeIndices.length; i++) {
        if (episodeIndices[i] !== selectedEpisode) {
          break;
        }
        episodeEndIndex = i;
      }

      // Extract rewards and uncertainties for this episode
      const episodeRewards = predicted_rewards.slice(episodeStartIndex, episodeEndIndex + 1);
      const episodeUncertainties = predicted_uncertainties.slice(episodeStartIndex, episodeEndIndex + 1);

      return {
        rewards: episodeRewards,
        uncertainties: episodeUncertainties,
        startIndex: episodeStartIndex,
        endIndex: episodeEndIndex
      };
    }, [selectedEpisode, episodeIndices, predicted_rewards, predicted_uncertainties]);

    const { rewards, uncertainties } = episodeData;

    if (width < 10 || rewards.length === 0) return null;

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const stepScale = useMemo(
      () =>
        scaleLinear({
          range: [margin.left, innerWidth + margin.left],
          domain: [0, Math.max(0, rewards.length - 1)],
        }),
      [innerWidth, margin.left, rewards.length],
    );

    const valueScale = useMemo(
      () => {
        // Use global reward range if available, otherwise fall back to episode data
        let domain: [number, number];
        if (globalRewardRange) {
          domain = globalRewardRange;
        } else if (rewards.length > 0) {
          domain = [Math.min(...rewards), Math.max(...rewards)];
        } else {
          domain = [0, 1];
        }
        
        return scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: domain,
          nice: true,
        });
      },
      [innerHeight, margin.top, globalRewardRange, rewards],
    );

    const uncertaintyScale = useMemo(
      () => {
        // Use global uncertainty range if available, otherwise fall back to episode data
        let domain: [number, number];
        if (globalUncertaintyRange) {
          domain = globalUncertaintyRange;
        } else if (uncertainties.length > 0) {
          domain = [0, Math.max(...uncertainties)];
        } else {
          domain = [0, 1];
        }
        
        return scaleLinear({
          range: [innerHeight + margin.top, margin.top],
          domain: domain,
          nice: true,
        });
      },
      [innerHeight, margin.top, globalUncertaintyRange, uncertainties],
    );

    const handleTooltip = useCallback(
      (
        event:
          | React.TouchEvent<SVGRectElement>
          | React.MouseEvent<SVGRectElement>,
      ) => {
        const { x } = localPoint(event) || { x: -1 };
        if (x === -1) return;
        
        const x0 = stepScale.invert(x);
        const snappedIndex = Math.round(x0);
        const clampedIndex = Math.max(0, Math.min(snappedIndex, rewards.length - 1));

        const reward = rewards[clampedIndex];
        const uncertainty = uncertainties[clampedIndex];
        
        showTooltip({
          tooltipData: { 
            value: reward, 
            index: clampedIndex,
            uncertainty: uncertainty
          },
          tooltipLeft: stepScale(clampedIndex),
          tooltipTop: valueScale(reward),
        });
        
        // Call the step selection callback if provided
        if (onStepSelect) {
          onStepSelect(clampedIndex);
        }
      },
      [stepScale, rewards, uncertainties, showTooltip, valueScale, onStepSelect],
    );

    const handleClick = useCallback(
      (event: React.MouseEvent<SVGRectElement>) => {
        const { x } = localPoint(event) || { x: -1 };
        if (x === -1) return;
        
        const x0 = stepScale.invert(x);
        const snappedIndex = Math.round(x0);
        const clampedIndex = Math.max(0, Math.min(snappedIndex, rewards.length - 1));
        
        if (onStepSelect) {
          onStepSelect(clampedIndex);
        }
      },
      [stepScale, rewards.length, onStepSelect],
    );

    return (
      <Box
        sx={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '2px solid',
          borderColor: episodeColor,
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Timeline Chart */}
        <Box sx={{ p: 0.5, position: 'relative' }}>
          {/* Compact close button - positioned to overlap slightly */}
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              zIndex: 1001,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 1)',
              },
              width: 20,
              height: 20,
              border: `1px solid ${episodeColor}`,
            }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <svg 
            width={width} 
            height={height}
            style={{ 
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill={theme.palette.background.paper}
            />
            <Group left={0} top={0}>
              <GridRows
                left={margin.left}
                scale={valueScale}
                width={innerWidth}
                strokeDasharray="1,3"
                stroke={theme.palette.divider}
                strokeOpacity={0.3}
                pointerEvents="none"
              />
              <GridColumns
                top={margin.top}
                scale={stepScale}
                height={innerHeight}
                strokeDasharray="1,3"
                stroke={theme.palette.divider}
                strokeOpacity={0.3}
                pointerEvents="none"
              />
              
              {/* Uncertainty line */}
              {uncertainties.length > 0 && (
                <LinePath
                  data={uncertainties}
                  x={(_, i) => stepScale(i) ?? 0}
                  y={(d) => uncertaintyScale(d) ?? 0}
                  strokeWidth={2}
                  stroke={theme.palette.secondary.main}
                  curve={curveMonotoneX}
                  //strokeDasharray="3,3"
                />
              )}
              
              {/* Reward line */}
              <LinePath
                data={rewards}
                x={(_, i) => stepScale(i) ?? 0}
                y={(d) => valueScale(d) ?? 0}
                strokeWidth={2}
                stroke={theme.palette.primary.main}
                curve={curveMonotoneX}
              />

              {/* Data points
              {rewards.map((reward, index) => {
                const x = stepScale(index);
                const y = valueScale(reward);
                const isSelected = selectedStep === index;

                return (
                  <GlyphCircle
                    key={`step-${index}`}
                    left={x}
                    top={y}
                    size={isSelected ? 25 : 15}
                    stroke={isSelected ? theme.palette.warning.main : theme.palette.primary.main}
                    strokeWidth={isSelected ? 3 : 2}
                    fill={isSelected ? theme.palette.warning.main : theme.palette.primary.main}
                    fillOpacity={isSelected ? 0.8 : 0.6}
                  />
                );
              })}*/}

              {/* Selected step indicator line */}
              {selectedStep !== null && selectedStep >= 0 && selectedStep < rewards.length && (
                <Line
                  from={{
                    x: stepScale(selectedStep),
                    y: margin.top,
                  }}
                  to={{
                    x: stepScale(selectedStep),
                    y: innerHeight + margin.top,
                  }}
                  stroke={theme.palette.warning.main}
                  strokeWidth={3}
                  strokeDasharray="5,5"
                  pointerEvents="none"
                />
              )}

              <AxisLeft
                scale={valueScale}
                left={margin.left}
                //label="Value"
                numTicks={Math.min(5, valueScale.ticks().length)}
                tickFormat={(value) => `${Number(value).toFixed(2)}`}
                stroke={theme.palette.text.secondary}
                tickLabelProps={{
                  fill: theme.palette.text.primary,
                  fontSize: 10,
                }}
                tickLineProps={{
                  stroke: theme.palette.text.secondary,
                }}
                labelProps={{
                  fill: theme.palette.text.primary,
                  fontSize: 12,
                }}
              />
              <AxisBottom
                scale={stepScale}
                top={innerHeight + margin.top}
                //label="Step"
                numTicks={Math.min(10, rewards.length)}
                tickFormat={(value) => `${Math.round(Number(value))}`}
                stroke={theme.palette.text.secondary}
                tickLabelProps={{
                  fill: theme.palette.text.primary,
                  fontSize: 10,
                }}
                tickLineProps={{
                  stroke: theme.palette.text.secondary,
                }}
                labelProps={{
                  fill: theme.palette.text.primary,
                  fontSize: 12,
                }}
              />
            </Group>

            <Bar
              x={margin.left}
              y={margin.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              rx={0}
              onTouchStart={handleTooltip}
              onTouchMove={handleTooltip}
              onMouseMove={handleTooltip}
              onClick={handleClick}
              onMouseLeave={() => hideTooltip()}
            />
          </svg>

          {/* Tooltip */}
          {tooltipData && (
            <div>
              <TooltipWithBounds
                key={Math.random()}
                top={tooltipTop - 12}
                left={tooltipLeft + 12}
                style={{
                  ...defaultStyles,
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <div>
                  <strong>Step {tooltipData.index}</strong>
                </div>
                <div>Reward: {tooltipData.value.toFixed(3)}</div>
                {tooltipData.uncertainty !== undefined && (
                  <div>Uncertainty: {tooltipData.uncertainty.toFixed(3)}</div>
                )}
              </TooltipWithBounds>
            </div>
          )}

          {/* Legend */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 2,
              fontSize: '12px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: theme.palette.primary.main,
                  opacity: 0.8,
                }}
              />
              <Typography variant="caption">Reward</Typography>
            </Box>
            {uncertainties.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    backgroundColor: theme.palette.secondary.main,
                    opacity: 0.8,
                  }}
                />
                <Typography variant="caption">Uncertainty</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  },
);

export default TimelineComponent;