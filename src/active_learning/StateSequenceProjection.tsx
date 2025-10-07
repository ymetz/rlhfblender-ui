import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    Tooltip,
    IconButton,
    Paper,
    Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
//import RebaseEditIcon from '@mui/icons-material/RebaseEdit';
import { styled, useTheme, alpha } from '@mui/material/styles';
import * as d3 from 'd3';
import axios from 'axios';
// import vsup
import * as vsup from 'vsup';
import { useActiveLearningState, useActiveLearningDispatch, UserDemoTrajectory } from '../ActiveLearningContext';
import { useAppState } from '../AppStateContext';
import {
    SelectedState,
    SelectedCoordinate,
    SelectedCluster,
    SelectionItem
} from './types/stateSequenceProjectionTypes';
import {
    extractSegments,
    mergeSegments
} from './utils/stateSequenceProjectionHelpers';
import { getFallbackColor } from './utils/trajectoryColors';
import { OnboardingHighlight } from './OnboardingSystem';
import { ColorLegend, GlyphLegend, Legend, ObjectLegend } from './components/ProjectionLegends';
import { drawStateSpaceVisualization } from './utils/drawStateSpace';
import { clearCanvasImageCache } from './utils/canvasCache';
import { computeUserTrajectorySignature } from './utils/trajectorySignature';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

type LastDrawParams = {
    data: number[][];
    labels: any[];
    doneData: any[];
    labelInfos: any[];
    episodeIndices: number[];
    gridData: { prediction_image: string | null; uncertainty_image: string | null; bounds: any };
    predictedRewards: any[];
    predictedUncertainties: any[];
    segments: any[];
};

// Styled components
const EmbeddingWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    position: 'relative',
}));

const EmbeddingContainer = styled(Box)(({ theme }) => ({
    flexGrow: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: '400px', // Fallback minimum height
    minWidth: '400px',  // Fallback minimum width
}));

const StateSequenceProjection = (props) => {
    // Get state and dispatch from context
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();
    const appState = useAppState();
    const theme = useTheme();

    // Refs
    const embeddingRef = useRef(null);

    const [minMaxScale, setMinMaxScale] = useState(null);

    // Component state variables
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedTrajectory, setSelectedTrajectory] = useState(null);
    const [selectedState, setSelectedState] = useState<SelectedState | null>(null);
    const [selectedCoordinate, setSelectedCoordinate] = useState<SelectedCoordinate>({ x: null, y: null });
    const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);
    const [selectedUserTrajectoryId, setSelectedUserTrajectoryId] = useState<string | null>(null);
    const selectedUserTrajectoryIdRef = useRef<string | null>(null);
    const [selectedUserDemo, setSelectedUserDemo] = useState<UserDemoTrajectory | null>(null);
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const multiSelectModeRef = useRef(false);
    const currentSelectionRef = useRef([]);
    const [segmentSize, setSegmentSize] = useState(50);
    const [maxUncertaintySegments, setMaxUncertaintySegments] = useState(10);
    const selectedTrajectoryRef = useRef(null);
    const selectedStateRef = useRef<SelectedState | null>(null);
    const selectedCoordinateRef = useRef<SelectedCoordinate>();
    const selectedClusterRef = useRef<SelectedCluster | null>(null);
    const zoomedFunctionRef = useRef<((event: any) => void) | null>(null);
    const currentTransformRef = useRef<d3.ZoomTransform | null>(null);
    const zoomBehaviorRef = useRef<any>(null);
    const fitEpisodeInViewRef = useRef<((episodeIdx: number) => void) | null>(null);
    const feedbackHighlightsRef = useRef<{
        episodes: Set<number>;
        states: Set<number>;
        coordinates: Set<string>;
        clustersSignatures?: Set<string>;
        correctionEpisodes?: Set<number>;
    } | null>(null);
    const lastDrawParamsRef = useRef<LastDrawParams | null>(null);
    const lastUserTrajectorySignatureRef = useRef<string>('');
    
    // Count currently selected trajectories (unique episodes) for multi-select helper text
    const selectedTrajectoriesCount = React.useMemo(() => {
        const sel = (activeLearningState.selection || []) as any[];
        const episodes = new Set<number>();
        for (const item of sel) {
            if (item?.type === 'state' && item.data && typeof item.data.episode === 'number') {
                episodes.add(item.data.episode);
            } else if (item?.type === 'trajectory' && typeof item.data === 'number') {
                episodes.add(item.data);
            }
        }
        return episodes.size;
    }, [activeLearningState.selection]);
    const selectedEpisodesSet = React.useMemo(() => {
        const selection = (activeLearningState.selection || []) as SelectionItem[];
        const episodes = new Set<number>();
        for (const item of selection) {
            if (item?.type === 'state' && item.data && typeof item.data.episode === 'number') {
                episodes.add(item.data.episode);
            } else if (item?.type === 'trajectory' && typeof item.data === 'number') {
                episodes.add(item.data);
            }
        }

        if (typeof selectedTrajectory === 'number') {
            episodes.add(selectedTrajectory);
        }
        if (selectedState && typeof selectedState.episode === 'number') {
            episodes.add(selectedState.episode);
        }

        return episodes;
    }, [activeLearningState.selection, selectedState, selectedTrajectory]);
    const autoLoadedSessionRef = useRef<string | null>(null);
    const feedbackHighlights = (activeLearningState as any).feedbackHighlights;
    const highlightedEpisodesSet: Set<number> | undefined = feedbackHighlights?.episodes;
    const correctionEpisodesSet: Set<number> | undefined = feedbackHighlights?.correctionEpisodes;
    


    // Extract props from activeLearningState
    const {
        viewMode = 'state_space',
        embeddingSequenceLength = 1,
    } = activeLearningState;


    useEffect(() => {
        selectedTrajectoryRef.current = selectedTrajectory;
    }, [selectedTrajectory]);

    useEffect(() => {
        selectedStateRef.current = selectedState;
    }, [selectedState]);

    useEffect(() => {
        selectedCoordinateRef.current = selectedCoordinate;
    }, [selectedCoordinate]);

    useEffect(() => {
        selectedClusterRef.current = selectedCluster;
    }, [selectedCluster]);

    useEffect(() => {
        selectedUserTrajectoryIdRef.current = selectedUserTrajectoryId;
    }, [selectedUserTrajectoryId]);

    // Keep multiSelectModeRef in sync with multiSelectMode state
    useEffect(() => {
        multiSelectModeRef.current = multiSelectMode;
    }, [multiSelectMode]);

    // Keep currentSelectionRef in sync with activeLearningState.selection
    useEffect(() => {
        currentSelectionRef.current = activeLearningState.selection || [];
    }, [activeLearningState.selection]);

    // Clear selection when key props change (new checkpoint, benchmark, etc.)
    useEffect(() => {
        setSelectedState(null);
        setSelectedTrajectory(null);
        setSelectedCluster(null);
        setSelectedCoordinate({ x: null, y: null });

        // Clear global selection when props change
        activeLearningDispatch({
            type: 'SET_SELECTION',
            payload: []
        });
    }, [props.benchmarkId, props.checkpointStep, props.embeddingMethod, props.reproject, props.appendTimestamp, activeLearningDispatch]);

    // Keep feedback highlights in a ref for access inside draw/zoom closures
    useEffect(() => {
        feedbackHighlightsRef.current = (activeLearningState as any).feedbackHighlights || null;
    }, [(activeLearningState as any).feedbackHighlights]);

    // (moved) Auto-load effect is defined after loadData to avoid TDZ

    // Sync local state with global selection changes (e.g., from MergedSelectionFeedback)
    useEffect(() => {
        const selection = activeLearningState.selection || [];

        if (selection.length === 1 && selection[0].type === 'user_demo') {
            const trajectoryId = selection[0].data?.trajectoryId;
            const trajectory = (activeLearningState.userGeneratedTrajectories || []).find(
                (t: UserDemoTrajectory) => t.id === trajectoryId
            ) || null;

            if (trajectory) {
                setSelectedUserTrajectoryId(trajectory.id);
                setSelectedUserDemo(trajectory);
                selectedUserTrajectoryIdRef.current = trajectory.id;

                // Clear standard selections when focusing on a user demo
                if (selectedTrajectoryRef.current !== null) {
                    setSelectedTrajectory(null);
                    selectedTrajectoryRef.current = null;
                }
                if (selectedStateRef.current) {
                    setSelectedState(null);
                    selectedStateRef.current = null;
                }
                if (selectedClusterRef.current) {
                    setSelectedCluster(null);
                    selectedClusterRef.current = null;
                }
                setSelectedCoordinate({ x: null, y: null });
                selectedCoordinateRef.current = { x: null, y: null };
            }
            return;
        }

        if (selectedUserTrajectoryIdRef.current) {
            setSelectedUserTrajectoryId(null);
            setSelectedUserDemo(null);
            selectedUserTrajectoryIdRef.current = null;
        }

        if (selection.length === 1 && selection[0].type === 'state') {
            const stateData = selection[0].data;
            if (stateData) {
                // Calculate the correct global index for this episode and step
                const episodeIndices = activeLearningState.episodeIndices || [];
                let globalIndex = -1;

                // Find the starting index of this episode
                let episodeStartIndex = -1;
                for (let i = 0; i < episodeIndices.length; i++) {
                    if (episodeIndices[i] === stateData.episode) {
                        episodeStartIndex = i;
                        break;
                    }
                }

                // Calculate the global index for the specific step
                if (episodeStartIndex !== -1) {
                    globalIndex = episodeStartIndex + stateData.step;
                }

                // Look up the actual coordinates from the projection data
                const projectionStates = activeLearningState.projectionStates || [];
                let actualCoords = [stateData.x || 0, stateData.y || 0]; // fallback

                if (globalIndex >= 0 && globalIndex < projectionStates.length) {
                    actualCoords = projectionStates[globalIndex];
                }

                const newSelectedState: SelectedState = {
                    episode: stateData.episode,
                    step: stateData.step,
                    coords: actualCoords,
                    x: actualCoords[0],
                    y: actualCoords[1],
                    index: globalIndex
                };

                // Only update if it's different from current state to avoid loops
                if (
                    !selectedStateRef.current ||
                    selectedStateRef.current.episode !== newSelectedState.episode ||
                    selectedStateRef.current.step !== newSelectedState.step
                ) {
                    setSelectedState(newSelectedState);
                    selectedStateRef.current = newSelectedState;
                    setSelectedTrajectory(stateData.episode);
                    selectedTrajectoryRef.current = stateData.episode;

                    // Trigger a redraw to show the updated state
                    if (zoomedFunctionRef.current && embeddingRef.current) {
                        const svg = d3.select(embeddingRef.current).select('svg');
                        if (svg.node()) {
                            const view = svg.select('.view');
                            if (view.node()) {
                                const currentTransform = d3.zoomTransform(view.node());
                                zoomedFunctionRef.current({ transform: currentTransform });
                            }
                        }
                    }
                }
            }
        }
    }, [
        activeLearningState.selection,
        activeLearningState.episodeIndices,
        activeLearningState.projectionStates,
        activeLearningState.userGeneratedTrajectories
    ]);

    
    const handleUserTrajectorySelection = useCallback(
        (trajectory: UserDemoTrajectory, pointIndex?: number) => {
            if (!trajectory) return;

            setSelectedUserTrajectoryId(trajectory.id);
            selectedUserTrajectoryIdRef.current = trajectory.id;
            setSelectedUserDemo(trajectory);

            if (selectedTrajectoryRef.current !== null) {
                setSelectedTrajectory(null);
                selectedTrajectoryRef.current = null;
            }

            if (selectedStateRef.current) {
                setSelectedState(null);
                selectedStateRef.current = null;
            }

            if (selectedClusterRef.current) {
                setSelectedCluster(null);
                selectedClusterRef.current = null;
            }

            setSelectedCoordinate({ x: null, y: null });
            selectedCoordinateRef.current = { x: null, y: null };

            const selectionItem: SelectionItem = {
                type: 'user_demo',
                data: {
                    trajectoryId: trajectory.id,
                    pointIndex: pointIndex ?? null,
                },
            };

            activeLearningDispatch({
                type: 'SET_SELECTION',
                payload: [selectionItem],
            });
        },
        [activeLearningDispatch]
    );

    const handleEpisodeTileClick = useCallback((ep: number) => {
        const episodeIndices = activeLearningState.episodeIndices || [];
        const episodeStartIndex = episodeIndices.indexOf(ep);

        if (episodeStartIndex === -1) {
            return;
        }

        const coords = (activeLearningState.projectionStates || [])[episodeStartIndex] || [0, 0];
        const safeCoords: [number, number] = coords.length >= 2 ? [coords[0], coords[1]] : [0, 0];

        const newSelectedState: SelectedState = {
            episode: ep,
            step: 0,
            coords: safeCoords,
            x: safeCoords[0],
            y: safeCoords[1],
            index: episodeStartIndex,
        };

        setSelectedState(newSelectedState);
        selectedStateRef.current = newSelectedState;
        setSelectedTrajectory(ep);
        selectedTrajectoryRef.current = ep;

        const newStateSelection: SelectionItem = { type: 'state', data: newSelectedState };
        const currentSelection = (activeLearningState.selection || []) as SelectionItem[];
        const alreadySelected = currentSelection.some((item) => {
            if (!item) return false;
            if (item.type === 'state' && item.data && typeof item.data.episode === 'number') {
                return item.data.episode === ep;
            }
            if (item.type === 'trajectory' && typeof item.data === 'number') {
                return item.data === ep;
            }
            return false;
        });

        let nextSelection = currentSelection;

        if (multiSelectMode) {
            if (!alreadySelected) {
                nextSelection = [...currentSelection, newStateSelection];
                activeLearningDispatch({
                    type: 'SET_SELECTION',
                    payload: nextSelection,
                });
            }
        } else {
            nextSelection = [newStateSelection];
            activeLearningDispatch({
                type: 'SET_SELECTION',
                payload: nextSelection,
            });

            if (fitEpisodeInViewRef.current) {
                fitEpisodeInViewRef.current(ep);
            }
        }

        currentSelectionRef.current = nextSelection;
    }, [
        activeLearningDispatch,
        activeLearningState.episodeIndices,
        activeLearningState.projectionStates,
        activeLearningState.selection,
        fitEpisodeInViewRef,
        multiSelectMode,
        setSelectedState,
        setSelectedTrajectory,
    ]);

    // Drawing function dispatches to specific visualizations
    const drawChart = useCallback((
        mode = 'state_space',
        data = [],
        labels = [],
        actionData = [],
        doneData = [],
        episodeIndices = [],
        labelInfos = [],
        predictedRewards = [],
        predictedUncertainties = [],
        gridData = {
            prediction_image: null,
            uncertainty_image: null,
            bounds: null,
        },
        segments = []
    ) => {

        switch (mode) {
            case 'state_space':
                drawStateSpace(data, labels, doneData, labelInfos, episodeIndices, gridData, predictedRewards, predictedUncertainties, segments);
                break;
            default:
                drawStateSpace(data, labels, doneData, labelInfos, episodeIndices, gridData, predictedRewards, predictedUncertainties, segments);
        }
    }, []);

    // Load data from API
    const loadData = useCallback(() => {
        // Capture current transform before clearing the visualization
        if (embeddingRef.current) {
            const svg = d3.select(embeddingRef.current).select('svg');
            if (svg.node()) {
                const view = svg.select('.view');
                if (view.node()) {
                    const currentTransform = d3.zoomTransform(view.node() as Element);
                    currentTransformRef.current = currentTransform;
                }
            }
        }
        
        setIsLoading(true);
        setError(null);
        
        // Clear the shouldLoadNewData flag when loading starts
        activeLearningDispatch({
            type: 'SET_SHOULD_LOAD_NEW_DATA',
            payload: false
        });
        
        // Clear selection state when loading new data
        setSelectedState(null);
        setSelectedTrajectory(null);
        setSelectedCluster(null);
        setSelectedCoordinate({ x: null, y: null });
        
        // Also clear the global selection
        activeLearningDispatch({
            type: 'SET_SELECTION',
            payload: []
        });

        // Clear feedback highlights for new data/phase
        activeLearningDispatch({ type: 'CLEAR_FEEDBACK_HIGHLIGHTS' } as any);
        
        // Clear image cache
        clearCanvasImageCache();

        const embedding_method = props.embeddingMethod;
        const use_one_d_embedding = 0;
        const reproject = props.reproject ? 1 : 0;
        const append_time = props.appendTimestamp ? 1 : 0;

        const url = '/projection/generate_projection';
        const grid_projection_url = '/projection/load_grid_projection_image';

        const params = {
            benchmark_id: props.benchmarkId,
            checkpoint_step: props.checkpointStep,
            projection_method: embedding_method,
            sequence_length: embeddingSequenceLength,
            step_range: '[]',
            reproject: reproject,
            use_one_d_projection: use_one_d_embedding,
            append_time: append_time,
            projection_props: props.embeddingSettings,
            map_type: 'both',
        };

        // Convert params to query string
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        // Load uncertainty grid projection
        const uncertainty_grid_projection_params = {
            ...params,
            map_type: 'uncertainty',
        };

        const uncertainty_grid_projection_queryString = Object.entries(uncertainty_grid_projection_params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        // Load all projection data
        Promise.all([
            axios.post(`${url}?${queryString}`, {
                benchmarks: props.benchmarkedModels,
                embedding_props: props.embeddingSettings
            }),
            axios.post(`${grid_projection_url}?${queryString}`),
            axios.post(`${grid_projection_url}?${uncertainty_grid_projection_queryString}`),
        ])
            .then(([projectionRes, gridRes, gridUncertaintyRes]) => {
                const data = projectionRes.data;
                const grid_data = gridRes.data;
                const grid_uncertainty_data = gridUncertaintyRes.data;

                console.log("Loaded projection data:", grid_data.x_range, grid_data.y_range);
                const xs = data.projection.map(p => p[0]);
                const ys = data.projection.map(p => p[1]);

                // get min/max
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                console.log({ minX, maxX, minY, maxY });

                // Update state with projection data
                activeLearningDispatch({ type: 'SET_EMBEDDING_DATA', payload: data.embedding });

                // Set projectionStates to be used across the UI (timeline, selections)
                // Use the API projection (expected to be joint/global if available)
                activeLearningDispatch({ type: 'SET_PROJECTION_STATES', payload: data.projection });

                // Update grid image data
                activeLearningDispatch({ type: 'SET_GRID_PREDICTION_IMAGE', payload: grid_data.image });
                activeLearningDispatch({ type: 'SET_GRID_UNCERTAINTY_IMAGE', payload: grid_uncertainty_data.image });

                const selected_points = props.infos ? props.infos.map(i => i['selected']) : [];
                const highlighted_points = props.infos ? props.infos.map(i => i['highlighted']) : [];

                // Update global state - projection data
                activeLearningDispatch({ type: 'SET_EMBEDDING_LABELS', payload: data.labels });
                activeLearningDispatch({ type: 'SET_CLUSTER_CENTROIDS', payload: data.centroids });
                activeLearningDispatch({ type: 'SET_MERGED_POINTS', payload: data.merged_points });
                activeLearningDispatch({ type: 'SET_POINT_CONNECTIONS', payload: data.connections });
                activeLearningDispatch({ type: 'SET_FEATURE_EMBEDDINGS', payload: data.feature_embedding });
                activeLearningDispatch({ type: 'SET_TRANSITION_EMBEDDINGS', payload: data.transition_embedding });
                const dataTimestamp = props.timeStamp ?? Date.now();
                activeLearningDispatch({ type: 'SET_LAST_DATA_UPDATE_TIMESTAMP', payload: dataTimestamp });
                activeLearningDispatch({ type: 'SET_SELECTED_POINTS', payload: selected_points });
                activeLearningDispatch({ type: 'SET_HIGHLIGHTED_POINTS', payload: highlighted_points });
                activeLearningDispatch({ type: 'SET_EPISODE_INDICES', payload: data.episode_indices || [] });
                activeLearningDispatch({ type: 'SET_PREDICTED_REWARDS', payload: grid_data.original_predictions || [] });
                activeLearningDispatch({ type: 'SET_PREDICTED_UNCERTAINTIES', payload: grid_data.original_uncertainties || [] });

                // Compute and store per-episode stats once on data load
                try {
                    const epiIdx = data.episode_indices || [];
                    const preds = grid_data.original_predictions || [];
                    const uncs = grid_data.original_uncertainties || [];
                    const statsMap = new Map<number, { avgReward: number | null; avgUncertainty: number | null; count: number }>();
                    const uniqueEpisodes = Array.from(new Set(epiIdx));
                    uniqueEpisodes.forEach((ep: number) => {
                        const idxs: number[] = [];
                        for (let i = 0; i < epiIdx.length; i++) {
                            if (epiIdx[i] === ep) idxs.push(i);
                        }
                        const rVals = idxs.map(i => preds[i]).filter(v => typeof v === 'number');
                        const uVals = idxs.map(i => uncs[i]).filter(v => typeof v === 'number');
                        const avgR = rVals.length ? rVals.reduce((a, b) => a + b, 0) / rVals.length : null;
                        const avgU = uVals.length ? uVals.reduce((a, b) => a + b, 0) / uVals.length : null;
                        statsMap.set(ep, { avgReward: avgR, avgUncertainty: avgU, count: idxs.length });
                    });
                    activeLearningDispatch({ type: 'SET_EPISODE_STATS', payload: statsMap });
                } catch (e) {
                    console.warn('Failed computing episode stats:', e);
                }

                // Calculate and set global ranges for consistent timeline scaling
                const rewards = grid_data.original_predictions || [];
                const uncertainties = grid_data.original_uncertainties || [];
                
                if (rewards.length > 0) {
                    const rewardRange: [number, number] = [
                        Math.min(...rewards),
                        Math.max(...rewards)
                    ];
                    activeLearningDispatch({ type: 'SET_GLOBAL_REWARD_RANGE', payload: rewardRange });
                }
                
                if (uncertainties.length > 0) {
                    const uncertaintyRange: [number, number] = [
                        Math.min(...uncertainties),
                        Math.max(...uncertainties)
                    ];
                    activeLearningDispatch({ type: 'SET_GLOBAL_UNCERTAINTY_RANGE', payload: uncertaintyRange });
                }

                // Update global state - grid data
                // activeLearningDispatch({ type: 'SET_GRID_COORDINATES', payload: grid_coordinates });
                // activeLearningDispatch({ type: 'SET_GRID_PREDICTIONS', payload: grid_predictions });
                // activeLearningDispatch({ type: 'SET_GRID_UNCERTAINTIES', payload: grid_uncertainties });

                const grid_prediction_image_path = grid_data.image || '';
                const grid_uncertainty_image_path = grid_uncertainty_data.image || '';

                // Create color scales based on grid bounds
                if (grid_data.projection_bounds) {
                    const bounds = grid_data.projection_bounds;
                    setMinMaxScale([bounds.min_val, bounds.max_val]);
                }

                /*if (grid_uncertainty_data.projection_bounds) {
                    const uncertaintyBounds = grid_uncertainty_data.projection_bounds;
                    // Create a color scale for uncertainty (e.g., interpolateInferno)
                    const uncertaintyScale = d3.scaleSequential(d3.interpolateInferno)
                        .domain([uncertaintyBounds.min_val, uncertaintyBounds.max_val]);
                    setObjectColorScale(() => uncertaintyScale);
                }*/

                // Process segments with the loaded data
                let processedSegments = [];
                if (data.projection && data.episode_indices) {
                    const episodeToPaths = new Map();
                    data.episode_indices.forEach((episodeIdx, i) => {
                        if (!episodeToPaths.has(episodeIdx)) {
                            episodeToPaths.set(episodeIdx, []);
                        }
                        if (i < data.projection.length) {
                            episodeToPaths.get(episodeIdx).push(data.projection[i]);
                        }
                    });
                    
                    // Trim last observation from each trajectory
                    episodeToPaths.forEach((pathPoints, episodeIdx) => {
                        if (pathPoints.length > 1) {
                            pathPoints.pop();
                        }
                    });
                    
                    // Process segments
                    try {
                        const segments = extractSegments(episodeToPaths, segmentSize);
                        processedSegments = mergeSegments(segments, 0.1);
                    } catch (error) {
                        console.error('Error processing segments:', error);
                    }
                }

                // Draw the chart with all data including segments
                // Use API projection coordinates (should be joint/global if available)
                const coordsForOverlay = data.projection;

                drawChart(
                    viewMode,
                    coordsForOverlay,
                    data.labels,
                    data.actions,
                    data.dones,
                    data.episode_indices,
                    [],
                    grid_data.original_predictions,
                    grid_data.original_uncertainties,
                    {
                        "prediction_image": grid_prediction_image_path,
                        "uncertainty_image": grid_uncertainty_image_path,
                        "bounds": grid_data.projection_bounds
                    },
                    processedSegments
                );

                lastDrawParamsRef.current = {
                    data: coordsForOverlay,
                    labels: data.labels || [],
                    doneData: data.dones || [],
                    labelInfos: [],
                    episodeIndices: data.episode_indices || [],
                    gridData: {
                        prediction_image: grid_prediction_image_path,
                        uncertainty_image: grid_uncertainty_image_path,
                        bounds: grid_data.projection_bounds,
                    },
                    predictedRewards: grid_data.original_predictions || [],
                    predictedUncertainties: grid_data.original_uncertainties || [],
                    segments: processedSegments,
                };
                lastUserTrajectorySignatureRef.current = computeUserTrajectorySignature(
                    activeLearningState.userGeneratedTrajectories || []
                ) + `|phase:${activeLearningState.currentPhase}`;

                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error loading data:", err);
                setError("Failed to load data. Please try again.");
                setIsLoading(false);
            });
    }, [props.embeddingMethod, props.reproject, props.appendTimestamp, props.benchmarkId, props.checkpointStep, props.embeddingSettings, props.benchmarkedModels, props.infos, props.timeStamp, embeddingSequenceLength, activeLearningDispatch, drawChart, viewMode, segmentSize]);

    // Auto-load projection once per session after resetSampler (defined after loadData to avoid TDZ)
    useEffect(() => {
        const sessionId = appState.sessionId;
        const hasProjection = (activeLearningState.projectionStates || []).length > 0;
        const alreadyAutoLoaded = autoLoadedSessionRef.current === sessionId;
        const shouldAutoLoad = !!sessionId && sessionId !== '-' && !hasProjection && !alreadyAutoLoaded && !activeLearningState.shouldLoadNewData && !isLoading;
        if (shouldAutoLoad) {
            autoLoadedSessionRef.current = sessionId;
            loadData();
        }
    }, [appState.sessionId, activeLearningState.projectionStates, activeLearningState.shouldLoadNewData, isLoading, loadData]);

    const drawStateSpace = useCallback((
        data = [],
        labels = [],
        doneData = [],
        labelInfos = [],
        episodeIndices = [],
        gridData = {
            prediction_image: null,
            uncertainty_image: null,
            bounds: null,
        },
        predicted_rewards = [],
        predicted_uncertainties = [],
        segments = []
    ) => {
        drawStateSpaceVisualization({
            data,
            labels,
            doneData,
            labelInfos,
            episodeIndices,
            gridData,
            predicted_rewards,
            predicted_uncertainties,
            segments,
            props,
            activeLearningDispatch,
            embeddingRef,
            selectedStateRef,
            selectedTrajectoryRef,
            selectedCoordinateRef,
            selectedClusterRef,
            selectedUserTrajectoryIdRef,
            multiSelectModeRef,
            currentSelectionRef,
            feedbackHighlightsRef,
            currentTransformRef,
            zoomBehaviorRef,
            zoomedFunctionRef,
            fitEpisodeInViewRef,
            handleUserTrajectorySelection,
            setSelectedState,
            setSelectedTrajectory,
            setSelectedCoordinate,
            setSelectedCluster,
            maxUncertaintySegments,
            userGeneratedTrajectories: activeLearningState.userGeneratedTrajectories || [],
            gridPredictionImage: activeLearningState.grid_prediction_image || null,
            currentPhase: activeLearningState.currentPhase,
        });
    }, [
        props,
        activeLearningDispatch,
        activeLearningState.grid_prediction_image,
        activeLearningState.userGeneratedTrajectories,
        activeLearningState.currentPhase,
        handleUserTrajectorySelection,
        maxUncertaintySegments,
    ]);


    useEffect(() => {
        const params = lastDrawParamsRef.current;
        if (!params) return;

        const signature = computeUserTrajectorySignature(
            activeLearningState.userGeneratedTrajectories || []
        ) + `|phase:${activeLearningState.currentPhase}`;

        if (signature === lastUserTrajectorySignatureRef.current) {
            return;
        }

        lastUserTrajectorySignatureRef.current = signature;

        drawStateSpace(
            params.data,
            params.labels,
            params.doneData,
            params.labelInfos,
            params.episodeIndices,
            params.gridData,
            params.predictedRewards,
            params.predictedUncertainties,
            params.segments
        );
    }, [activeLearningState.userGeneratedTrajectories, drawStateSpace]);

    return (
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
            <EmbeddingWrapper>
                {/* Error alert */}
                {error && (
                    <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        sx={{ transform: 'translate(-50%, -50%)', zIndex: 20 }}
                    >
                        <Alert severity="error">{error}</Alert>
                    </Box>
                )}

                {/* Loading indicator */}
                {isLoading && (
                    <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        sx={{ transform: 'translate(-50%, -50%)', zIndex: 20 }}
                    >
                        <CircularProgress />
                    </Box>
                )}

                {/* Main visualization area */}
                <OnboardingHighlight stepId="select-trajectory" pulse={true} preserveLayout={true}>
                    <EmbeddingContainer ref={embeddingRef} />
                </OnboardingHighlight>

                <Box
                    position="absolute"
                    bottom="20px"
                    left="50%"
                    sx={{
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        display: 'flex',
                        visibility: isLoading ? 'hidden' : 'visible'
                    }}
                >
                    {/* Fixed-width control group to prevent layout shift */}
                    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <Tooltip title="Clear Selection">
                            <IconButton
                                color="default"
                                sx={(theme) => ({
                                    width: 52,
                                    height: 52,
                                    backgroundColor: alpha(theme.palette.grey[500], 0.4),
                                    color: theme.palette.text.primary,
                                    border: `1px solid ${alpha(theme.palette.grey[500], 0.5)}`,
                                    boxShadow: `0 2px 8px ${alpha(theme.palette.grey[700], 0.2)}`,
                                    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.grey[600], 0.55),
                                        boxShadow: `0 3px 10px ${alpha(theme.palette.grey[700], 0.3)}`,
                                    },
                                    '& .MuiSvgIcon-root': { fontSize: 24 },
                                })}
                                onClick={() => {
                                    activeLearningDispatch({
                                        type: 'SET_SELECTION',
                                        payload: []
                                    });
                                    // Clear local selection state
                                    setSelectedState(null);
                                    setSelectedTrajectory(null);
                                    setSelectedCluster(null);
                                    setSelectedCoordinate({ x: null, y: null });
                                    setSelectedUserTrajectoryId(null);
                                    setSelectedUserDemo(null);
                                    selectedUserTrajectoryIdRef.current = null;
                                    // Reset multi-select mode when clearing selection
                                    setMultiSelectMode(false);
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>

                        <OnboardingHighlight stepId="multi-select-mode" pulse={true}>
                            <Tooltip title={multiSelectMode ? "Multi-Select Mode: ON" : "Multi-Select Mode: OFF"}>
                                <IconButton
                                    color={multiSelectMode ? "primary" : "default"}
                                    sx={(theme) => {
                                        const activeColor = theme.palette.primary.main;
                                        return {
                                            width: 52,
                                            height: 52,
                                            backgroundColor: multiSelectMode
                                                ? alpha(activeColor, 0.95)
                                                : alpha(theme.palette.primary.main, 0.15),
                                            color: multiSelectMode ? theme.palette.common.white : theme.palette.primary.main,
                                            border: `1px solid ${alpha(activeColor, multiSelectMode ? 0.6 : 0.35)}`,
                                            boxShadow: multiSelectMode
                                                ? `0 3px 10px ${alpha(activeColor, 0.35)}`
                                                : `0 2px 8px ${alpha(theme.palette.grey[700], 0.25)}`,
                                            transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                                            '&:hover': {
                                                backgroundColor: multiSelectMode
                                                    ? activeColor
                                                    : alpha(theme.palette.primary.light, 0.3),
                                            },
                                            '& .MuiSvgIcon-root': { fontSize: 24 },
                                        };
                                    }}
                                    onClick={() => {
                                        if (selectedTrajectory || selectedState) {
                                            setMultiSelectMode(!multiSelectMode);
                                        }
                                    }}
                                >
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                        </OnboardingHighlight>

                        {multiSelectMode && (
                            <Typography
                                variant="caption"
                                sx={{
                                    position: 'absolute',
                                    left: 'calc(100% + 8px)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    px: 1,
                                    py: 0.3,
                                    borderRadius: 1,
                                    bgcolor: 'rgba(25,118,210,0.08)',
                                    color: 'text.secondary',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Click Trajectory to Add (Already Selected: {selectedTrajectoriesCount})
                            </Typography>
                        )}
                        {!multiSelectMode && selectedTrajectoriesCount > 0 && (
                            <Typography
                                variant="caption"
                                sx={{
                                    position: 'absolute',
                                    left: 'calc(100% + 8px)',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    px: 1,
                                    py: 0.3,
                                    borderRadius: 1,
                                    bgcolor: 'rgba(25,118,210,0.08)',
                                    color: 'text.secondary',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Activate Multi-Select to Compare Multiple Episodes
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* Selected cluster info display */}
                {selectedCluster && (
                    <Box
                        position="absolute"
                        top="10px"
                        right="10px"
                        sx={{
                            zIndex: 15,
                            backgroundColor: 'rgba(51, 51, 51, 0.8)', // Match cluster color
                            color: 'white',
                            padding: 2,
                            borderRadius: 2,
                            border: '2px solid #333333',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {selectedCluster.label}
                        </Typography>
                        <Typography variant="body2">
                            {selectedCluster.indices.length} states
                        </Typography>
                    </Box>
                )}

                {/* Load Data button and segment controls */}
                <Box
                    position="absolute"
                    top="10px"
                    left="50px"
                    right="50px"
                    sx={{ zIndex: 10, display: 'flex', gap: 2, alignItems: 'center' }}
                >
                    <Button variant="contained" color="primary" onClick={loadData} disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Load Data'}
                    </Button>
                    {/* Episodes overview and quick select */}
                    <Box sx={{
                        backgroundColor: 'transparent',
                        padding: 0.5,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flex: 1,
                        minWidth: 0
                    }}>
                        <Box sx={{
                            display: 'flex',
                            gap: 1,
                            overflowX: 'auto',
                            p: 0.5,
                            flex: 1,
                            minWidth: 0,
                            flexWrap: 'wrap'
                        }}>
                            {Array.from(new Set(activeLearningState.episodeIndices || [])).map((ep: number) => {
                                // compute color
                                const color = (activeLearningState.trajectoryColors && activeLearningState.trajectoryColors.get(ep)) || getFallbackColor(ep);
                                // use precomputed stats if available
                                const stat = (activeLearningState as any).episodeStats?.get(ep);
                                const avgR = stat?.avgReward ?? null;
                                const avgU = stat?.avgUncertainty ?? null;

                                // Build a small color indicator (VSUP) based on normalized avg values
                                let indicatorColor = '#bbb';
                                if (avgR !== null && avgU !== null && activeLearningState.globalRewardRange && activeLearningState.globalUncertaintyRange) {
                                    const [rMin, rMax] = activeLearningState.globalRewardRange;
                                    const [uMin, uMax] = activeLearningState.globalUncertaintyRange;
                                    const rNorm = (rMax > rMin) ? Math.min(1, Math.max(0, (avgR - rMin) / (rMax - rMin))) : 0.5;
                                    const uNorm = (uMax > uMin) ? Math.min(1, Math.max(0, (avgU - uMin) / (uMax - uMin))) : 0.5;
                                    const scale = vsup.scale().quantize(vsup.quantization().branching(2).layers(4).valueDomain([0, 1]).uncertaintyDomain([1.0, 0.01])).range(d3.interpolateCividis);
                                    indicatorColor = scale(rNorm, uNorm);
                                }

                                const isSelected = selectedEpisodesSet.has(ep);
                                const hasFeedback = highlightedEpisodesSet?.has(ep) ?? false;
                                const hasCorrection = correctionEpisodesSet?.has(ep) ?? false;
                                const ratedBorderColor = theme.palette.mode === 'dark' ? theme.palette.grey[600] : theme.palette.grey[400];
                                const borderColor = hasFeedback ? ratedBorderColor : color;
                                const indicatorDisplayColor = hasFeedback ? ratedBorderColor : indicatorColor;
                                const cardTextColor = hasFeedback ? theme.palette.text.secondary : theme.palette.text.primary;
                                const tooltipTitle = hasFeedback ? 'Feedback recorded for this episode' : undefined;
                                const baseBackground = hasFeedback ? theme.palette.action.hover : theme.palette.background.paper;
                                const backgroundColor = isSelected ? theme.palette.action.selected : baseBackground;
                                const boxShadowValue = isSelected ? theme.shadows[4] : theme.shadows[1];
                                const hoverShadowValue = isSelected ? theme.shadows[6] : theme.shadows[2];

                                return (
                                    <Tooltip
                                        key={`ep-tile-${ep}`}
                                        title={tooltipTitle}
                                        disableHoverListener={!hasFeedback}
                                        arrow
                                    >
                                        <Box
                                            onClick={() => handleEpisodeTileClick(ep)}
                                            sx={{
                                                cursor: 'pointer',
                                                border: '2px solid',
                                                borderColor,
                                                borderRadius: 1,
                                                px: 1,
                                                py: 0.75,
                                                bgcolor: backgroundColor,
                                                color: cardTextColor,
                                                boxShadow: boxShadowValue,
                                                minWidth: 96,
                                                transition: 'box-shadow 0.2s ease, transform 0.05s ease',
                                                '&:hover': { boxShadow: hoverShadowValue }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: indicatorDisplayColor, border: '1px solid #999' }} />
                                                    <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Ep {ep}</Typography>
                                                </Box>
                                                {hasCorrection && (
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        icon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
                                                        label="Correction"
                                                        sx={{
                                                            height: 22,
                                                            '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' },
                                                            '& .MuiChip-icon': { ml: 0.25 },
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                                                {avgR !== null ? `R: ${avgR.toFixed(2)}` : 'R: -'}{` `}|{` `}{avgU !== null ? `U: ${avgU.toFixed(2)}` : 'U: -'}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    </Box>
                    
                </Box>

                {/* Legend for object color */}
                {minMaxScale && (
                    <ObjectLegend>
                        <ColorLegend
                            minMax={minMaxScale}
                            width={240}
                            title="Predicted Reward/Uncertainty"
                        />
                    </ObjectLegend>
                )}

                {/* Glyph legend */}
                <GlyphLegend>
                    <Legend />
                </GlyphLegend>

                {/* Load Data Hint Overlay */}
                {activeLearningState.shouldLoadNewData && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            backdropFilter: 'blur(2px)',
                        }}
                    >
                        <Paper
                            elevation={8}
                            sx={{
                                p: 3,
                                maxWidth: 400,
                                textAlign: 'center',
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                borderRadius: 2,
                            }}
                        >
                            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
                                Training Stage Complete
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
                                Based on your feedback, the model has been updated. Continue with new data from the updated model.
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={loadData}
                                disabled={isLoading}
                                size="large"
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                }}
                            >
                                {isLoading ? 'Loading...' : 'Continue To Next Phase'}
                            </Button>
                        </Paper>
                    </Box>
                )}
            </EmbeddingWrapper>
            
        </Box>
    );

};

export default StateSequenceProjection;
