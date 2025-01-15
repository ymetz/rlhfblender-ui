// best-of-k-column.tsx
import React from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import EpisodeItem from './episodeitem/episode-item';
import { Feedback } from '../../types';

interface BestOfKColumnProps {
  episodeIDs: string[];
  onSelectBest: (episodeId: string) => void;
  selectedColumn: string | null;
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  sessionId: string;
  actionLabels: any[];
  evalFeedback: {[episodeId: string]: number};
  updateEvalFeedback: (episodeId: string, rating: number) => void;
  setDemoModalOpen: ({open, seed}: {open: boolean; seed: number}) => void;
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
}) => {
  const theme = useTheme();

  const isSelectedAsBest = (episodeId: string) => {
    return selectedColumn === episodeId;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 2,
        flex: 1,
        backgroundColor: theme.palette.background.l0,
        overflowY: 'auto',
      }}
    >
      {episodeIDs.map((episodeID, index) => (
        <Box
          key={episodeID}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <EpisodeItem
            episodeID={episodeID}
            index={index}
            scheduleFeedback={scheduleFeedback}
            selectBest={onSelectBest}
            isSelectedAsBest={isSelectedAsBest(episodeID)}
            numItemsInColumn={episodeIDs.length}
            sessionId={sessionId}
            evalFeedback={evalFeedback[episodeID]}
            updateEvalFeedback={updateEvalFeedback}
            setDemoModalOpen={setDemoModalOpen}
            actionLabels={actionLabels}
            isBestOfK={true}
          />
        </Box>
      ))}
    </Box>
  );
};

export default BestOfKColumn;