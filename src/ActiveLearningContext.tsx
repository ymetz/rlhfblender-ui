import React, { createContext, useReducer, useContext, ReactNode } from "react";
import { Episode } from "./types";

export interface ActiveLearningState {
  // Original state properties
  currentPhase: number;
  progressRewards: number[];
  progressUncertainties: number[];
  selection: number[];
  selectedEpisode: Episode | null;
  projectionStates: number[][];
  projectionStateValues: number[];

  // grid points and predictions
  //grid_coordinates: number[][];
  //grid_predictions: number[];
  //grid_uncertainties: number[];
  grid_prediction_image: string | null; // New property for the grid prediction image
  grid_uncertainty_image: string | null; // New property for the grid uncertainty image
  
  // New properties from Evaluation_Embedding
  embeddingData: any[]; // Formerly rawdat
  embeddingLabels: any[]; // Formerly labels
  clusterCentroids: any[]; // Formerly centroids
  mergedPoints: any[]; // Formerly merged_points
  pointConnections: any[]; // Formerly connections
  featureEmbeddings: any[]; // Formerly feature_embedding
  transitionEmbeddings: any[]; // Formerly transition_embedding
  
  // Selection and highlighting
  highlightedPoints: boolean[]; // Formerly highlighted
  selectedPoints: boolean[]; // Formerly selected
  
  // View configuration
  viewMode: string; // State space, decision points, etc.
  backgroundColorMode: string; // Formerly background_layer_color_scale_mode
  objectColorMode: string; // Formerly object_layer_color_scale_mode
  embeddingSequenceLength: number; // Formerly sequence_length
  lastDataUpdateTimestamp: number; // Formerly data_timestamp
  annotationMode: string; // 'analyze' or 'annotate'
  
  // Optional: Additional state that might be needed based on component props
  embeddingMethod: string;
  infoTypes: string[];
  actionData: any[];
  currentRewardData: number[];

  episodeIndices: number[]; 
}

type ActiveLearningAction =
  | { type: "SET_CURRENT_PHASE"; payload: number }
  | { type: "SET_PROGRESS_REWARDS"; payload: number[] }
  | { type: "SET_PROGRESS_UNCERTAINTIES"; payload: number[] }
  | { type: "SET_SELECTION"; payload: number[] }
  | { type: "SET_SELECTED_EPISODE"; payload: Episode | null }
  | { type: "SET_PROJECTION_STATES"; payload: number[][] }
  | { type: "SET_PROJECTION_STATE_VALUES"; payload: number[] }
  // grid points and predictions
  | { type: "SET_GRID_PREDICTION_IMAGE"; payload: string | null }
  | { type: "SET_GRID_UNCERTAINTY_IMAGE"; payload: string | null }

  // New actions
  | { type: "SET_EMBEDDING_DATA"; payload: any[] }
  | { type: "SET_EMBEDDING_LABELS"; payload: any[] }
  | { type: "SET_CLUSTER_CENTROIDS"; payload: any[] }
  | { type: "SET_MERGED_POINTS"; payload: any[] }
  | { type: "SET_POINT_CONNECTIONS"; payload: any[] }
  | { type: "SET_FEATURE_EMBEDDINGS"; payload: any[] }
  | { type: "SET_TRANSITION_EMBEDDINGS"; payload: any[] }
  | { type: "SET_HIGHLIGHTED_POINTS"; payload: boolean[] }
  | { type: "SET_SELECTED_POINTS"; payload: boolean[] }
  | { type: "SET_VIEW_MODE"; payload: string }
  | { type: "SET_BACKGROUND_COLOR_MODE"; payload: string }
  | { type: "SET_OBJECT_COLOR_MODE"; payload: string }
  | { type: "SET_EMBEDDING_SEQUENCE_LENGTH"; payload: number }
  | { type: "SET_LAST_DATA_UPDATE_TIMESTAMP"; payload: number }
  | { type: "SET_ANNOTATION_MODE"; payload: string }
  | { type: "SET_EMBEDDING_METHOD"; payload: string }
  | { type: "SET_INFO_TYPES"; payload: string[] }
  | { type: "SET_ACTION_DATA"; payload: any[] }
  | { type: "SET_CURRENT_REWARD_DATA"; payload: number[] }
  | { type: 'SET_EPISODE_INDICES', payload: number[] };

const initialState: ActiveLearningState = {
  // Original state
  currentPhase: 0,
  progressRewards: [],
  progressUncertainties: [],
  selection: [],
  selectedEpisode: null,
  projectionStates: [],
  projectionStateValues: [],

  // grid points and predictions
  grid_prediction_image: null, // Initialize with null or appropriate default
  grid_uncertainty_image: null, // Initialize with null or appropriate default
  
  // New state
  embeddingData: [],
  embeddingLabels: [],
  clusterCentroids: [],
  mergedPoints: [],
  pointConnections: [],
  featureEmbeddings: [],
  transitionEmbeddings: [],
  highlightedPoints: [],
  selectedPoints: [],
  viewMode: 'state_space',
  backgroundColorMode: 'none',
  objectColorMode: 'step_reward',
  embeddingSequenceLength: 1,
  lastDataUpdateTimestamp: 0,
  annotationMode: 'analyze',
  embeddingMethod: 'UMAP',
  infoTypes: [],
  actionData: [],
  currentRewardData: [],
  episodeIndices: [],
};

const ActiveLearningContext = createContext<ActiveLearningState | undefined>(
  undefined
);

const ActiveLearningDispatchContext = createContext<
  React.Dispatch<ActiveLearningAction> | undefined
>(undefined);

function activeLearningReducer(
  state: ActiveLearningState,
  action: ActiveLearningAction
): ActiveLearningState {
  switch (action.type) {
    // Original cases
    case "SET_CURRENT_PHASE":
      return { ...state, currentPhase: action.payload };
    case "SET_PROGRESS_REWARDS":
      return { ...state, progressRewards: action.payload };
    case "SET_PROGRESS_UNCERTAINTIES":
      return { ...state, progressUncertainties: action.payload };
    case "SET_SELECTION":
      return { ...state, selection: action.payload };
    case "SET_SELECTED_EPISODE":
      return { ...state, selectedEpisode: action.payload };
    case "SET_PROJECTION_STATES":
      return { ...state, projectionStates: action.payload };
    case "SET_PROJECTION_STATE_VALUES":
      return { ...state, projectionStateValues: action.payload };
    // grid points and predictions
    case "SET_GRID_PREDICTION_IMAGE":
      return { ...state, grid_prediction_image: action.payload };
    case "SET_GRID_UNCERTAINTY_IMAGE":
      return { ...state, grid_uncertainty_image: action.payload };
    case 'SET_PROJECTION_STATES':
        return {
          ...state,
          projectionStates: action.payload
        };

    // New cases
    case "SET_EMBEDDING_DATA":
      return { ...state, embeddingData: action.payload };
    case "SET_EMBEDDING_LABELS":
      return { ...state, embeddingLabels: action.payload };
    case "SET_CLUSTER_CENTROIDS":
      return { ...state, clusterCentroids: action.payload };
    case "SET_MERGED_POINTS":
      return { ...state, mergedPoints: action.payload };
    case "SET_POINT_CONNECTIONS":
      return { ...state, pointConnections: action.payload };
    case "SET_FEATURE_EMBEDDINGS":
      return { ...state, featureEmbeddings: action.payload };
    case "SET_TRANSITION_EMBEDDINGS":
      return { ...state, transitionEmbeddings: action.payload };
    case "SET_HIGHLIGHTED_POINTS":
      return { ...state, highlightedPoints: action.payload };
    case "SET_SELECTED_POINTS":
      return { ...state, selectedPoints: action.payload };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
    case "SET_BACKGROUND_COLOR_MODE":
      return { ...state, backgroundColorMode: action.payload };
    case "SET_OBJECT_COLOR_MODE":
      return { ...state, objectColorMode: action.payload };
    case "SET_EMBEDDING_SEQUENCE_LENGTH":
      return { ...state, embeddingSequenceLength: action.payload };
    case "SET_LAST_DATA_UPDATE_TIMESTAMP":
      return { ...state, lastDataUpdateTimestamp: action.payload };
    case "SET_ANNOTATION_MODE":
      return { ...state, annotationMode: action.payload };
    case "SET_EMBEDDING_METHOD":
      return { ...state, embeddingMethod: action.payload };
    case "SET_INFO_TYPES":
      return { ...state, infoTypes: action.payload };
    case "SET_ACTION_DATA":
      return { ...state, actionData: action.payload };
    case "SET_CURRENT_REWARD_DATA":
      return { ...state, currentRewardData: action.payload };
    case "SET_EPISODE_INDICES":
      return { ...state, episodeIndices: action.payload };   
    default:
      throw new Error(`Unhandled action type: ${(action as any).type}`);
  }
}

export const ActiveLearningProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(activeLearningReducer, initialState);
  
  return (
    <ActiveLearningContext.Provider value={state}>
      <ActiveLearningDispatchContext.Provider value={dispatch}>
        {children}
      </ActiveLearningDispatchContext.Provider>
    </ActiveLearningContext.Provider>
  );
};

export const useActiveLearningState = () => {
  const context = useContext(ActiveLearningContext);
  if (context === undefined) {
    throw new Error(
      "useActiveLearningState must be used within an ActiveLearningProvider"
    );
  }
  return context;
};

export const useActiveLearningDispatch = () => {
  const context = useContext(ActiveLearningDispatchContext);
  if (context === undefined) {
    throw new Error(
      "useActiveLearningDispatch must be used within an ActiveLearningProvider"
    );
  }
  return context;
};