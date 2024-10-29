import { useState, useEffect } from 'react';
import { Ranks } from '../types';

export const useFeedbackState = (rankeableEpisodeIDs: string[]) => {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [ranks, setRanks] = useState<Ranks>({});

  useEffect(() => {
    const new_ranks = Object.fromEntries(
      Array.from({ length: rankeableEpisodeIDs.length }, (_, i) => [
        `rank-${i}`,
        {
          rank: i + 1,
          title: `Rank ${i + 1}`,
          episodeItemIDs: [rankeableEpisodeIDs[i]],
        },
      ])
    );
    setRanks(new_ranks);
    setColumnOrder(Object.entries(new_ranks).map(([key, _]) => key));
  }, [rankeableEpisodeIDs]);

  return { columnOrder, setColumnOrder, ranks, setRanks };
};