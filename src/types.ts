type Episode = {
  env_name: string;
  benchmark_type: string;
  benchmark_id: number;
  checkpoint_step: number;
  episode_num: number;
};

type Target = {
  episode: Episode;
  step: number;
};

type Feedback = {
  target: Target | Target[] | null;
  timestamp: string;
  numeric_feedback: number;
};

type Project = {
  id: number;
  project_name: string;
  project_experiments: string[];
};

type Experiment = {
  id: number;
  exp_name: string;
};

type SetupConfig = {
  // A map of enabled/disabled UI components
  id: number;
  name: string;
  description: string;
  uiComponents: {
    [key: string]: boolean;
  };
  feedbackComponents: {
    [key: string]: boolean;
  };
  max_ranking_elements: number;
  samplingStrategy: string;
  customInput: string;
};

type AppState = {
  // Drag and drop
  videoURLCache: {[key: string]: string};
  rewardsCache: {[key: string]: number[]};
  thumbnailURLCache: {[key: string]: string};
  status_bar_collapsed: boolean;
  modalOpen: boolean;
  startModalOpen: boolean;
  projects: Project[];
  experiments: Experiment[];
  sessionId: string;
  filtered_experiments: Experiment[];
  selectedProject: Project;
  selectedExperiment: Experiment;
  sliderValue: number;
  rankeableEpisodeIDs: string[];
  ranks: {
    [key: string]: {
      rank: number;
      title: string;
      episodeItemIDs: string[];
    };
  };
  columnOrder: string[];
  episodeIDsChronologically: Episode[];
  activeEpisodes: Episode[];
  highlightedEpisodes: {value: number}[];
  allSetupConfigs: SetupConfig[];
  activeSetupConfig: SetupConfig;
  scheduledFeedback: Feedback[];
  isPendingFeedback: boolean;
  currentStep: number;
  startModalContent: JSX.IntrinsicElements | null;
};

type AppProps = {};

export type {
  Buffer,
  AppState,
  AppProps,
  Episode,
  Project,
  SetupConfig,
  Feedback,
  Experiment,
};
