import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useParentSize } from '@visx/responsive';
import TimelineChart from "./timeline-chart";

interface TimelineSectionProps {
  rewards: number[];
  uncertainty: number[];
  actions: number[];
  actionLabels: any[];
  videoDuration: number;
  videoSliderValue: number;
  givenFeedbackMarkers: any[];
  proposedFeedbackMarkers: any[];
  onSliderChange: (value: number) => void;
  onCorrectionClick: (step: number) => void;
  hasCorrectiveFeedback: boolean;
  useCorrectiveFeedback: boolean;
  interactionLocked?: boolean;
  correctionStep?: number | null;
}

const TimelineSection: React.FC<TimelineSectionProps> = ({
  rewards,
  uncertainty,
  actions,
  actionLabels,
  videoDuration,
  videoSliderValue,
  givenFeedbackMarkers,
  proposedFeedbackMarkers,
  onSliderChange,
  onCorrectionClick,
  hasCorrectiveFeedback,
  useCorrectiveFeedback,
  interactionLocked = false,
  correctionStep = null,
}) => {
  const theme = useTheme();

  const { parentRef, width } = useParentSize({ debounceTime: 150 });
  const chartWidth = width > 0 ? width : 260;

  return (
    <Box
      sx={{
        display: "flex",
        borderRadius: "10px",
        my: 1,
        mx: "auto",
        border: hasCorrectiveFeedback
          ? `1px solid ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.l0,
        boxShadow: hasCorrectiveFeedback
          ? `0px 0px 20px 0px ${theme.palette.primary.main}`
          : "none",
        gridArea: "timelinechart",
        overflow: "hidden",
        boxSizing: "border-box",
        width: "min(calc(100% - 16px), 33vw)",
        minWidth: 260,
      }}
    >
      <Box
        ref={parentRef}
        sx={{
          width: "100%",
          minWidth: 0,
          height: 100,
        }}
      >
        <TimelineChart
          rewards={rewards}
          uncertainty={uncertainty}
          actions={actions}
          actionLabels={actionLabels}
          width={chartWidth}
          height={100}
          videoDuration={videoDuration}
          tooltipLeft={videoSliderValue}
          givenFeedbackMarkers={givenFeedbackMarkers}
          proposedFeedbackMarkers={proposedFeedbackMarkers}
          onChange={onSliderChange}
          onCorrectionClick={onCorrectionClick}
          useCorrectiveFeedback={useCorrectiveFeedback}
          interactionLocked={interactionLocked}
          stepForCorrection={correctionStep}
        />
      </Box>
    </Box>
  );
};

export default TimelineSection;
