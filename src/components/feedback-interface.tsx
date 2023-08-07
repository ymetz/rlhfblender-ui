import {SyntheticEvent} from 'react';

// Drag and drop
import {DragDropContext, DropResult} from 'react-beautiful-dnd';

// Material UI
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';

// Our components
import DroppableColumn from './droppable-column';
import Scrollbar from './scrollbar';
import Progressbar from './progressbar';
import ScrollableEpisodeList from './scrollable-episode-list';

// Types
import {Episode, SetupConfig, Feedback} from '../types';
import React from 'react';

interface FeedbackInterfaceProps {
  onDragEnd: (dropResult: DropResult) => void;
  currentProgressBarStep: number;
  episodeIDsChronologically: Episode[];
  activeSetupConfig: SetupConfig;
  scrollbarHandler: (
    e: Event | SyntheticEvent<Element, Event>,
    value: number | number[]
  ) => void;
  sliderValue: number;
  parentWidthPx: number | undefined;
  rankeableEpisodeIDs: string[];
  columnOrder: string[];
  ranks: {
    [key: string]: {
      rank: number;
      title: string;
      episodeItemIDs: string[];
    };
  };
  scheduleFeedback: (feedback: Feedback) => void;
  getVideo: (videoURL: string) => Promise<string | undefined>;
  getRewards: (episodeID: string) => Promise<number[] | undefined>;
  getThumbnail: (episodeID: string) => Promise<string | undefined>;
  submitFeedback: () => void;
}

const FeedbackInterface: React.FC<FeedbackInterfaceProps> = ({
  onDragEnd,
  currentProgressBarStep,
  episodeIDsChronologically,
  activeSetupConfig,
  scrollbarHandler,
  sliderValue,
  parentWidthPx,
  rankeableEpisodeIDs,
  columnOrder,
  ranks,
  scheduleFeedback,
  getVideo,
  getRewards,
  getThumbnail,
  submitFeedback,
}) => {
  const numEpisodes = episodeIDsChronologically.length;
  const horizontalDrag = activeSetupConfig.uiComponents.horizontalRanking;
  return (
    <Box
      id="feedback-interface"
      sx={{
        display: 'flex',
        flex: 1,
        width: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {activeSetupConfig.uiComponents.progressBar && (
        <Box
          id="progress-bar"
          sx={{
            m: 1,
            display: 'flex',
            marginTop: 0,
          }}
        >
          <Progressbar
            maxSteps={numEpisodes || 50}
            currentStep={currentProgressBarStep}
          />
        </Box>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <Box
          id="ranking-panel"
          flexDirection={horizontalDrag ? 'column' : 'row'}
          sx={{
            display: 'flex',
            height: '100%',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {activeSetupConfig.uiComponents.interactiveEpisodeSelect && (
            <Scrollbar
              horizontalDrag={activeSetupConfig.uiComponents.horizontalDrag}
              episodeCount={numEpisodes || 50}
              onChange={scrollbarHandler}
            />
          )}
          {activeSetupConfig.uiComponents.episodePreview && (
            <ScrollableEpisodeList
              horizontalDrag={activeSetupConfig.uiComponents.horizontalDrag}
              sliderValue={sliderValue}
              episodeCount={numEpisodes}
              episodeIDs={episodeIDsChronologically}
              maxNumItemsInView={15}
              parentWidthPx={parentWidthPx}
              rankeableEpisodeIDs={rankeableEpisodeIDs}
              getThumbnail={getThumbnail}
            />
          )}
          <Box
            sx={{
              display: 'flex',
              flexDirection: horizontalDrag ? 'row' : 'column',
              flex: 1,
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
          >
            {columnOrder.map(columnId => {
              const rank = ranks[columnId];
              return (
                <DroppableColumn
                  key={columnId}
                  droppableID={columnId}
                  horizontalDrag={activeSetupConfig.uiComponents.horizontalDrag}
                  episodeIDs={rank.episodeItemIDs}
                  title={rank.title}
                  scheduleFeedback={scheduleFeedback}
                  getVideo={getVideo}
                  getThumbnailURL={getThumbnail}
                  getRewards={getRewards}
                  customInput={activeSetupConfig.customInput}
                />
              );
            })}
          </Box>
          <Fab
            aria-label="add"
            variant="extended"
            color="success"
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
            }}
            size="medium"
            onClick={submitFeedback}
          >
            <Typography variant="h6">Submit Feedback</Typography>
            <SendIcon></SendIcon>
          </Fab>
        </Box>
      </DragDropContext>
    </Box>
  );
};

export default FeedbackInterface;
