import { cluster } from "d3";
import { BackendConfig, UIConfig } from "./types";
import { common } from "@mui/material/colors";

// Make sure that this config mirrors the format of the UIConfig model in the backend
const defaultUIConfig: UIConfig = {
  id: "default",
  name: "",
  description: "",
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
    ranking: false,
    comparison: true,
    demonstration: true,
    correction: true,
    clusterRating: true,
    featureSelection: false,
    text: false,
  },
  max_ranking_elements: 2,
  customInput: "",
};

const defaultBackendConfig: BackendConfig = {
  id: "default",
  name: "",
  description: "",
  samplingStrategy: "sequential",
  loggerMode: "local",

  selectedUiConfigs: [],
  uiConfigMode: "sequential",

  feedbackModelTrainingEnabled: false,
  feeedbackModelType: "",
  feedbackModelConfig: {},
};

export { defaultUIConfig, defaultBackendConfig };
