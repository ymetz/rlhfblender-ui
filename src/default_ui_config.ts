import {SetupConfig} from './types';

// Make sure that this config mirrors the format of the UIConfig model in the backend
const default_ui_config: SetupConfig = {
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
  },
  feedbackComponents: {
    rating: true,
    ranking: true,
    demonstration: false,
    correction: false,
    featureSelection: false,
    text: false,
  },
  max_ranking_elements: 5,
  samplingStrategy: 'sequential',
  customInput: '',
};

export default default_ui_config;
