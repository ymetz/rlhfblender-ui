// best-of-k-column.tsx
import React from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
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
  setDemoModalOpen: ({ open, seed }: { open: boolean; seed: number }) => void;
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
  setDemoModalOpen,
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
        flexDirection: horizontalRanking ? "row" : "column",
        borderLeft: horizontalRanking
          ? `1px solid ${theme.palette.divider}`
          : "none",
        borderTop: horizontalRanking
          ? "none"
          : `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.l1,
      }}
    >
      {episodeIDs.map((episodeID, index) => (
        <Box
          key={episodeID}
          sx={{
            display: "flex",
            margin: 1,

            // Here I have to put flex 1 because I want to fill out the white with the grey
            flex: 1,
            marginLeft: horizontalRanking ? "none" : 0,
            marginTop: horizontalRanking ? 0 : "none",
            borderRadius: horizontalRanking ? "0 0 5px 5px" : "0 5px 5px 0",
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <EpisodeItem
            episodeID={episodeID}
            index={index}
            scheduleFeedback={scheduleFeedback}
            selectBest={onSelectBest}
            isSelectedAsBest={isSelectedAsBest(episodeID)}
            sessionId={sessionId}
            evalFeedback={evalFeedback[episodeID]}
            updateEvalFeedback={updateEvalFeedback}
            setDemoModalOpen={setDemoModalOpen}
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
