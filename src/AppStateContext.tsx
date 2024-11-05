// AppStateContext.tsx

import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { AppState, UIConfig, BackendConfig, Feedback, Episode } from './types';
import { defaultUIConfig, defaultBackendConfig } from './default-setup-configs';

type AppAction =
    | { type: 'SET_PROJECTS'; payload: any[] }
    | { type: 'SET_EXPERIMENTS'; payload: any[] }
    | { type: 'SET_SELECTED_PROJECT'; payload: any }
    | { type: 'SET_SELECTED_EXPERIMENT'; payload: any }
    | { type: 'SET_UI_CONFIG_MODAL_OPEN'; payload: boolean }
    | { type: 'SET_BACKEND_CONFIG_MODAL_OPEN'; payload: boolean }
    | { type: 'SET_SESSION_ID'; payload: string }
    | { type: 'SCHEDULE_FEEDBACK'; payload: Feedback }
    | { type: 'SET_APP_MODE'; payload: 'study' | 'configure' }
    | { type: 'SET_START_MODAL_OPEN'; payload: boolean }
    | { type: 'TOGGLE_STATUS_BAR' }
    | { type: 'SET_UNCERTAINTY_CACHE'; payload: any }
    | { type: 'SET_VIDEO_URL_CACHE'; payload: any }
    | { type: 'SET_REWARDS_CACHE'; payload: any }
    | { type: 'SET_THUMBNAIL_URL_CACHE'; payload: any }
    | { type: 'SET_ACTIVE_EPISODES'; payload: Episode[] }
    | { type: 'SET_EPISODE_IDS_CHRONOLOGICALLY', payload: Episode[] }
    | { type: 'CLEAR_SCHEDULED_FEEDBACK' }
    | { type: 'SET_END_MODAL_OPEN' }
    | { type: 'SET_FILTERED_EXPERIMENTS'; payload: any[] }
    | { type: 'SET_THEME'; payload: string }
    | { type: 'SET_ACTION_LABELS'; payload: string[] }
    | { type: 'SET_RANKEABLE_EPISODE_IDS'; payload: string[] }
    | { type: 'TOGGLE_STUDY_CODE' }
    | { type: 'SET_STUDY_CODE'; payload: string }
    | { type: 'SET_SETUP_COMPLETE'; payload: boolean };



    const initialState: AppState = {
        app_mode: 'study',
        videoURLCache: {},
        rewardsCache: {},
        uncertaintyCache: {},
        thumbnailURLCache: {},
        status_bar_collapsed: true,
        projects: [],
        experiments: [],
        filtered_experiments: [],
        actionLabels: [],
        activeEpisodes: [],
        highlightedEpisodes: [],
        selectedProject: { id: -1, project_name: '', project_experiments: [] },
        selectedExperiment: { id: -1, exp_name: '', env_id: '' },
        sliderValue: 0,
        uiConfigModalOpen: false,
        backendConfigModalOpen: false,
        startModalOpen: true,
        endModalOpen: false,
        rankeableEpisodeIDs: [],
        sessionId: '-',
        episodeIDsChronologically: [],
        scheduledFeedback: [],
        currentStep: 0,
        startModalContent: undefined,
        allThemes: ['light', 'dark'],
        theme: 'light',
        isOnSubmit: false,
        showStudyCode: false,
        studyCode: '',
        setupComplete: false
    };

type AsyncDispatch = (action: AppAction) => Promise<void>;

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AsyncDispatch | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_PROJECTS':
            return { ...state, projects: action.payload };
        case 'SET_EXPERIMENTS':
            return { ...state, experiments: action.payload };
        case 'SET_SELECTED_PROJECT':
            return { ...state, selectedProject: action.payload };
        case 'SET_SELECTED_EXPERIMENT':
            return { ...state, selectedExperiment: action.payload };
        case 'SET_UI_CONFIG_MODAL_OPEN':
            return { ...state, uiConfigModalOpen: action.payload };
        case 'SET_BACKEND_CONFIG_MODAL_OPEN':
            return { ...state, backendConfigModalOpen: action.payload };
        case 'SET_SESSION_ID':
            return { ...state, sessionId: action.payload };
        case 'SCHEDULE_FEEDBACK':
            return { ...state, scheduledFeedback: [...state.scheduledFeedback, action.payload] };
        case 'SET_APP_MODE':
            return { ...state, app_mode: action.payload };
        case 'SET_START_MODAL_OPEN':
            return { ...state, startModalOpen: action.payload };
        case 'TOGGLE_STATUS_BAR':
            return { ...state, status_bar_collapsed: !state.status_bar_collapsed };
        case 'SET_VIDEO_URL_CACHE':
            return { ...state, videoURLCache: { ...state.videoURLCache, ...action.payload } };
        case 'SET_UNCERTAINTY_CACHE':
            return { ...state, uncertaintyCache: { ...state.uncertaintyCache, ...action.payload } };
        case 'SET_REWARDS_CACHE':
            return { ...state, rewardsCache: { ...state.rewardsCache, ...action.payload } };
        case 'SET_THUMBNAIL_URL_CACHE':
            return { ...state, thumbnailURLCache: { ...state.thumbnailURLCache, ...action.payload } };
        case 'SET_ACTIVE_EPISODES':
            return { ...state, activeEpisodes: action.payload };
        case 'CLEAR_SCHEDULED_FEEDBACK':
            return { ...state, scheduledFeedback: [] };
        case 'SET_END_MODAL_OPEN':
            return { ...state, endModalOpen: !state.endModalOpen };
        case 'SET_EPISODE_IDS_CHRONOLOGICALLY':
            return { ...state, episodeIDsChronologically: action.payload };
        case 'SET_FILTERED_EXPERIMENTS':
            return { ...state, filtered_experiments: action.payload };
        case 'SET_THEME':
            return { ...state, theme: action.payload };
        case 'SET_ACTION_LABELS':
            return { ...state, actionLabels: action.payload };
        case 'SET_RANKEABLE_EPISODE_IDS':
            return { ...state, rankeableEpisodeIDs: action.payload };
        case 'TOGGLE_STUDY_CODE':
            return { ...state, showStudyCode: !state.showStudyCode };
        case 'SET_STUDY_CODE':
            return { ...state, studyCode: action.payload };
        case 'SET_SETUP_COMPLETE':
            return { ...state, setupComplete: action.payload };

        default:
            throw new Error(`Unhandled action type: ${(action as AppAction).type}`);
    }
}

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
    const [state, baseDispatch] = useReducer(appReducer, initialState);

    // Create an async dispatch wrapper
    const asyncDispatch: AsyncDispatch = async (action) => {
        return new Promise((resolve) => {
            // Use requestAnimationFrame to ensure the dispatch is processed
            requestAnimationFrame(() => {
                baseDispatch(action);
                // Wait for next frame to ensure state update is processed
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        });
    };

    return (
        <AppStateContext.Provider value={state}>
            <AppDispatchContext.Provider value={asyncDispatch}>
                {children}
            </AppDispatchContext.Provider>
        </AppStateContext.Provider>
    );
};

export const useAppDispatch = () => {
    const context = useContext(AppDispatchContext);
    if (context === undefined) {
        throw new Error('useAppDispatch must be used within a AppStateProvider');
    }
    return context;
};

export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (context === undefined) {
        throw new Error('useAppState must be used within a AppStateProvider');
    }
    return context;
};