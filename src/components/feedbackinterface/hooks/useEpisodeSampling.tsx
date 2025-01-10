import { useConfigBasedSampling } from '../../../episodeSamplingWithSequence';

export const useEpisodeSampling = () => {
  const { sampleEpisodes } = useConfigBasedSampling();
  return { sampleEpisodes };
};