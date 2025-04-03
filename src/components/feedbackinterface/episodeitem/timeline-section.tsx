import React from "react";
import { Box, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ParentSize from "@visx/responsive/lib/components/ParentSize";
import TimelineChart from "./timeline-chart";
import CorrIcon from "../../../icons/corr-icon";

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
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        borderRadius: "10px",
        m: 1,
        border: hasCorrectiveFeedback
          ? `1px solid ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.l0,
        boxShadow: hasCorrectiveFeedback
          ? `0px 0px 20px 0px ${theme.palette.primary.main}`
          : "none",
        gridArea: "timelinechart",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          m: 1,
          p: 1,
          borderRight: `1px solid ${theme.palette.divider}`,
          height: "100%",
        }}
      >
        {useCorrectiveFeedback && (
          <Tooltip title="Double Click to Correct">
            <CorrIcon
              color={
                hasCorrectiveFeedback
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary
              }
            />
          </Tooltip>
        )}
      </Box>
      <ParentSize>
        {(parent) => (
          <TimelineChart
            rewards={rewards}
            uncertainty={uncertainty}
            actions={actions}
            actionLabels={actionLabels}
            width={parent.width - 20}
            height={100}
            videoDuration={videoDuration}
            tooltipLeft={videoSliderValue}
            givenFeedbackMarkers={givenFeedbackMarkers}
            proposedFeedbackMarkers={proposedFeedbackMarkers}
            onChange={onSliderChange}
            onCorrectionClick={onCorrectionClick}
            useCorrectiveFeedback={useCorrectiveFeedback}
            showTooltip={() => {}}
            hideTooltip={() => {}}
          />
        )}
      </ParentSize>
    </Box>
  );
};

export default TimelineSection;
