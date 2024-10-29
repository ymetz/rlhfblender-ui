import axios from 'axios';
import { useAppDispatch } from '../../../AppStateContext';
import { IDfromEpisode } from '../../../id';

export const useEpisodeSampling = (selectedExperiment: any, activeUIConfig: any, sessionId: string) => {
  const dispatch = useAppDispatch();

  const sampleEpisodes = async () => {
    if (selectedExperiment.id === -1) {
      return;
    }
    try {
      const response = await axios.get('/data/sample_episodes', {
        params: { num_episodes: activeUIConfig.max_ranking_elements, sessionId },
      });
      if (response.data.length === 0) {
        dispatch({ type: 'SET_ACTIVE_EPISODES', payload: [] });
        dispatch({ type: 'SET_END_MODAL_OPEN' });
      }
      dispatch({
        type: 'SET_ACTIVE_EPISODES',
        payload: response.data.map((e: any) => IDfromEpisode(e)),
      });
      dispatch({
        type: 'SET_RANKEABLE_EPISODE_IDS',
        payload: response.data.map((e: any) => IDfromEpisode(e)),
      });
    } catch (error) {
      console.error('Error sampling episodes:', error);
    }
  };

  return { sampleEpisodes };
};