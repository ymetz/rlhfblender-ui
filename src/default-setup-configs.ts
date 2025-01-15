import {BackendConfig, UIConfig} from './types';

// Make sure that this config mirrors the format of the UIConfig model in the backend
const defaultUIConfig: UIConfig = {
  id: 'default',
  name: '',
  description: '',
  uiComponents: {
    progressBar: true,
    interactiveEpisodeSelect: false,
    episodePreview: false,
    episodeItem: true,
    episodeItemVideo: true,
    horizontalRanking: true,
    bestOfK: true,
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
    text: true,
  },
  max_ranking_elements: 2,
  customInput: '',
};

const defaultBackendConfig: BackendConfig = {
  id: 'default',
  name: '',
  description: '',
  samplingStrategy: 'sequential',
  loggerMode: 'local',

  selectedUiConfigs: [],
  uiConfigMode: 'sequential',

  feedbackModelTrainingEnabled: false,
  feeedbackModelType: '',
  feedbackModelConfig: {},
};

export {defaultUIConfig, defaultBackendConfig};
