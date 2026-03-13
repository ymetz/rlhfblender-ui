// best-of-k-column.tsx
import React from "react";
import Box from "@mui/material/Box";
import { useTheme, alpha } from "@mui/material/styles";
import { useSetupConfigState } from "../../SetupConfigContext";
import EpisodeItem from "./episodeitem/episode-item";
import { Feedback } from "../../types";

interface BestOfKColumnProps {
  episodeIDs: string[];
  onSelectBest: (episodeId: string) => void;
  selectedColumn: string | null;
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  sessionId: string;
  actionLabels: any[];
  evalFeedback: { [episodeId: string]: number };
  updateEvalFeedback: (episodeId: string, rating: number) => void;
  experimentId: number;
  environmentId: string;
  checkpoint?: number | string;
  onMouseEnter: (episodeId: string) => void;
  onMouseLeave: () => void;
  isHovered: boolean;
}

const BestOfKColumn: React.FC<BestOfKColumnProps> = ({
  episodeIDs,
  scheduleFeedback,
  onSelectBest,
  selectedColumn,
  sessionId,
  actionLabels,
  evalFeedback,
  updateEvalFeedback,
  experimentId,
  environmentId,
  checkpoint,
  onMouseEnter,
  onMouseLeave,
  isHovered,
}) => {
  const theme = useTheme();
  const UIConfig = useSetupConfigState().activeUIConfig;
  const horizontalRanking = UIConfig.uiComponents.horizontalRanking;

  const isSelectedAsBest = (episodeId: string) => {
    return selectedColumn === episodeId;
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: "auto",
        flexWrap: "wrap",
        justifyContent: "center",
        alignContent: "flex-start",
        gap: 1,
        padding: 1,
        boxSizing: "border-box",
        flexDirection: horizontalRanking ? "row" : "column",
        borderLeft: horizontalRanking
          ? `1px solid ${theme.palette.divider}`
          : "none",
        borderTop: horizontalRanking
          ? "none"
          : `1px solid ${theme.palette.divider}`,
        borderRadius: "10px",
        backgroundColor: alpha(theme.palette.primary.main, 0.05),
      }}
    >
      {episodeIDs.map((episodeID) => (
        <Box
          key={episodeID}
          sx={{
            display: "flex",
            margin: 0,
            flex: "0 1 auto",
            width: horizontalRanking ? "min(520px, calc(50vw - 20px))" : "100%",
            minWidth: horizontalRanking ? 340 : "auto",
            marginLeft: horizontalRanking ? 0 : 0,
            marginTop: horizontalRanking ? 0 : 0,
            borderRadius: horizontalRanking ? "0 0 5px 5px" : "0 5px 5px 0",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
            boxSizing: "border-box",
          }}
        >
          <EpisodeItem
            episodeID={episodeID}
            containerId="best-of-k"
            scheduleFeedback={scheduleFeedback}
            selectBest={onSelectBest}
            isSelectedAsBest={isSelectedAsBest(episodeID)}
            sessionId={sessionId}
            evalFeedback={evalFeedback[episodeID]}
            updateEvalFeedback={updateEvalFeedback}
            experimentId={experimentId}
            environmentId={environmentId}
            checkpoint={checkpoint}
            actionLabels={actionLabels}
            isBestOfK={true}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            isHovered={isHovered}
          />
        </Box>
      ))}
    </Box>
  );
};

export default BestOfKColumn;
