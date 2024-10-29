export interface Rank {
  rank: number;
  title: string;
  episodeItemIDs: string[];
}

export interface Ranks {
  [key: string]: Rank;
}

export interface StyledDroppableColumnContainerProps {
  columnOrder: string[];
  horizontalRanking: boolean;
  ranks: Ranks;
}

export interface DemoModalState {
  open: boolean;
  seed: number;
}