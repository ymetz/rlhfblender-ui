import {SetupConfig} from './types';

// Make sure that this config mirrors the format of the UIConfig model in the backend
const DefaultSetupConfig: SetupConfig = {
  id: -1,
  name: '',
  description: '',
  uiComponents: {
    progressBar: true,
    interactiveEpisodeSelect: false,
    episodePreview: false,
    episodeItem: true,
    episodeItemVideo: true,
    horizontalRanking: false,
    showProposedFeedback: false,
    uncertaintyLine: false,
    actionLabels: false,
  },
  feedbackComponents: {
    rating: true,
    ranking: true,
    demonstration: true,
    correction: true,
    featureSelection: true,
    text: false,
  },
  max_ranking_elements: 5,
  samplingStrategy: 'sequential',
  customInput: '',
};

export default DefaultSetupConfig;
