import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    Tooltip,
    IconButton,
    Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
//import RebaseEditIcon from '@mui/icons-material/RebaseEdit';
import { styled } from '@mui/material/styles';
import * as d3 from 'd3';
import axios from 'axios';
import { Color2D } from './projection_utils/2dcolormaps';
// import vsup
import * as vsup from 'vsup';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { useAppState } from '../AppStateContext';
import { useGetter } from '../getter-context';
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
import { computeTrajectoryColors, getFallbackColor } from './utils/trajectoryColors';
import { OnboardingHighlight } from './OnboardingSystem';
import TimelineComponent from './TimelineComponent';

const canvasImageCache = new Map();

// Enhanced trajectory visualization functions to reduce overplotting
function drawTrajectory(context, points, color, lineWidth = 2) {
    if (points.length < 2) return;
    
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i][0], points[i][1]);
    }
    context.stroke();
}

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


// Color Legend component 
const ColorLegend = ({ minMax, width, title }) => {
    const legendRef = useRef(null);

    useEffect(() => {
        if (legendRef.current && minMax) {
            d3.select(legendRef.current).select('*').remove();

            const margin = { top: 0, right: 0, bottom: 0, left: 0 };
            const height = 190 - margin.top - margin.bottom;

            const svg = d3.select(legendRef.current)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            const quantization = vsup.quantization().branching(2).layers(4).valueDomain([minMax[0], minMax[1]]).uncertaintyDomain([1.0, 0.01]);
            const scale = vsup.scale().quantize(quantization).range(d3.interpolateBrBG);

            const arc_legend = vsup.legend.arcmapLegend()
                //.title("Reward Model: Predictions/Uncertainty")
                .size(160)
                .scale(scale)
                .x(10)
                .y(25)
                .format(".2f")


            svg.call(arc_legend);

            svg.selectAll('.arc-label text')
                .style('font-size', '9px');

            // 2. Keep only a subset of the labels (approximately 4)
            const arcLabels = svg.selectAll('.arc-label');
            const totalLabels = arcLabels.size();

            if (totalLabels > 4) {
                // We want to show ~4 labels, so hide the rest
                const keepEveryNth = Math.ceil(totalLabels / 4);

                arcLabels.each(function (d, i) {
                    // also hide last label
                    if (i % keepEveryNth !== 1 && i !== totalLabels - 2) {
                        // Hide this label and its tick line
                        d3.select(this).select('text').style('display', 'none');
                        d3.select(this).select('line').style('display', 'none');
                    }
                });
            }
        }
    }, [minMax, width, title]);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">{title}</Typography>
            <div ref={legendRef} />
        </Box>
    );
};

// Glyph Legend component
const GlyphLegendComponent = () => {
    const legendRef = useRef(null);

    useEffect(() => {
        if (legendRef.current) {
            d3.select(legendRef.current).select('svg').remove();

            const svg = d3.select(legendRef.current)
                .append('svg')
                .attr('width', 160)
                .attr('height', 80)
                .append('g')
                .attr('transform', 'translate(10, 10)');

            // Start glyph example
            const startGroup = svg.append('g')
                .attr('transform', 'translate(15, 20)');
            
            startGroup.append('polygon')
                .attr('points', '-7,-7 7,0 -7,7')
                .attr('fill', '#4CAF50')
                .attr('stroke', '#2E7D32')
                .attr('stroke-width', 2);
            
            startGroup.append('text')
                .attr('x', 20)
                .attr('y', 4)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text('Start states');

            // End glyph example
            const endGroup = svg.append('g')
                .attr('transform', 'translate(15, 45)');
            
            endGroup.append('rect')
                .attr('x', -6)
                .attr('y', -6)
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', '#F44336')
                .attr('stroke', '#C62828')
                .attr('stroke-width', 2);
            
            endGroup.append('text')
                .attr('x', 20)
                .attr('y', 4)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text('End states');
        }
    }, []);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">Marker Legend</Typography>
            <div ref={legendRef} />
        </Box>
    );
};

const LegendContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    bottom: theme.spacing(2),
    width: '200px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
}));


// Legend positioned on the right side
const ObjectLegend = styled(LegendContainer)(({ theme }) => ({
    right: theme.spacing(1),
    zIndex: 15,
}));

// Glyph legend positioned on the left side
const GlyphLegend = styled(LegendContainer)(({ theme }) => ({
    left: theme.spacing(1),
    zIndex: 15,
    width: '180px',
}));

const StateSequenceProjection = (props) => {
    // Get state and dispatch from context
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();
    const appState = useAppState();
    const { getThumbnailURL } = useGetter();

    // Refs
    const embeddingRef = useRef(null);
    const scaleMinMaxRef = useRef(null);

    const [minMaxScale, setMinMaxScale] = useState(null);

    // Component state variables
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedTrajectory, setSelectedTrajectory] = useState(null);
    const [selectedState, setSelectedState] = useState<SelectedState | null>(null);
    const [selectedCoordinate, setSelectedCoordinate] = useState<SelectedCoordinate>({ x: null, y: null });
    const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);
    const [hoveredEpisode, setHoveredEpisode] = useState(null);
    const [clickedEpisode, setClickedEpisode] = useState(null);
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const multiSelectModeRef = useRef(false);
    const currentSelectionRef = useRef([]);
    const [segmentSize, setSegmentSize] = useState(50);
    const [maxUncertaintySegments, setMaxUncertaintySegments] = useState(10);
    const [trajectoryColors, setTrajectoryColors] = useState(new Map<number, string>());
    const [showTimeline, setShowTimeline] = useState(false);
    const selectedTrajectoryRef = useRef(null);
    const selectedStateRef = useRef<SelectedState | null>(null);
    const selectedCoordinateRef = useRef<SelectedCoordinate>();
    const selectedClusterRef = useRef<SelectedCluster | null>(null);
    const zoomedFunctionRef = useRef<((event: any) => void) | null>(null);
    const currentTransformRef = useRef<d3.ZoomTransform | null>(null);
    const zoomBehaviorRef = useRef<any>(null);
    const fitEpisodeInViewRef = useRef<((episodeIdx: number) => void) | null>(null);
    


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

    // Keep multiSelectModeRef in sync with multiSelectMode state
    useEffect(() => {
        multiSelectModeRef.current = multiSelectMode;
    }, [multiSelectMode]);

    // Keep currentSelectionRef in sync with activeLearningState.selection
    useEffect(() => {
        currentSelectionRef.current = activeLearningState.selection || [];
    }, [activeLearningState.selection]);

    // Clear timeline when key props change (new checkpoint, benchmark, etc.)
    useEffect(() => {
        setShowTimeline(false);
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

    // Show timeline when a state is selected
    useEffect(() => {
        if (selectedState && selectedState.episode !== null && selectedState.step !== null) {
            setShowTimeline(true);
        } else {
            setShowTimeline(false);
        }
    }, [selectedState]);

    // Sync local state with global selection changes (e.g., from MergedSelectionFeedback)
    useEffect(() => {
        const selection = activeLearningState.selection || [];
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
                if (!selectedStateRef.current || 
                    selectedStateRef.current.episode !== newSelectedState.episode ||
                    selectedStateRef.current.step !== newSelectedState.step) {
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
    }, [activeLearningState.selection, activeLearningState.episodeIndices, activeLearningState.projectionStates]);




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
        
        // Clear timeline and selection state when loading new data
        setShowTimeline(false);
        setSelectedState(null);
        setSelectedTrajectory(null);
        setSelectedCluster(null);
        setSelectedCoordinate({ x: null, y: null });
        
        // Also clear the global selection
        activeLearningDispatch({
            type: 'SET_SELECTION',
            payload: []
        });
        
        // Clear image cache
        canvasImageCache.clear();

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
                activeLearningDispatch({ type: 'SET_LAST_DATA_UPDATE_TIMESTAMP', payload: props.timeStamp });
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

                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error loading data:", err);
                setError("Failed to load data. Please try again.");
                setIsLoading(false);
            });
    }, [props.embeddingMethod, props.reproject, props.appendTimestamp, props.benchmarkId, props.checkpointStep, props.embeddingSettings, props.benchmarkedModels, props.infos, props.timeStamp, embeddingSequenceLength, activeLearningDispatch, drawChart, viewMode, segmentSize]);

    const drawStateSpace = useCallback((data = [], labels = [], doneData = [], labelInfos = [], episodeIndices = [], gridData = { prediction_image: null, uncertainty_image: null, bounds: null }, predicted_rewards = [], predicted_uncertainties = [], segments = []) => {

        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const done_idx = doneData.reduce((a, elem, i) => (elem === true && a.push(i), a), []);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        // Clear any existing SVG content including segment overlays
        d3.select(embeddingRef.current).selectAll('*').remove();

        const svgHeight = embeddingRef.current.parentElement.clientHeight;
        const svgWidth = embeddingRef.current.parentElement.clientWidth;

        if (svgWidth <= 0 || svgHeight <= 0) {
            console.warn('StateSequenceProjection: Invalid dimensions detected, skipping render', { svgWidth, svgHeight });
            return;
        }

        let processedData = data.map((k, i) => [...k, episodeIndices[i] || 0]);

        // Create quad tree for fast point lookup
        const quadTree = d3.quadtree(
            processedData.map((d, i) => [d[0], d[1], i]),
            (d) => d[0],
            (d) => d[1]
        );

        const container = d3.select(embeddingRef.current);

        // Select the previous view and get current transform
        const prevView = container.select('.view');
        const prevTransform = prevView.node() !== null ? prevView.attr('transform') : null;
        
        // Use the saved transform from currentTransformRef if available
        const savedTransform = currentTransformRef.current;

        // Remove all children of the container
        container.selectAll('*').remove();
        container.style('position', 'relative');

        // Create canvas for background rendering
        const canvas = container.append('canvas')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('z-index', '1')
            .node();


        const context = canvas ? canvas.getContext('2d') : null;

        // Create SVG overlay with higher z-index
        const svg = container
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('z-index', '2')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Set up scales
        // Prefer globally consistent bounds from gridData if available to ensure
        // a stable coordinate system and aspect ratio across checkpoints.
        const hasGlobalBounds = gridData && gridData.bounds &&
            typeof gridData.bounds.x_min === 'number' && typeof gridData.bounds.x_max === 'number' &&
            typeof gridData.bounds.y_min === 'number' && typeof gridData.bounds.y_max === 'number';

        let xDomain: [number, number];
        let yDomain: [number, number];

        if (hasGlobalBounds) {
            // Use the projection bounds coming from the backend image metadata
            xDomain = [gridData.bounds.x_min, gridData.bounds.x_max];
            yDomain = [gridData.bounds.y_min, gridData.bounds.y_max];
        } else {
            // Fallback to data-driven extents with modest padding
            const xExtent = d3.extent(processedData.map((d) => d[0]));
            const yExtent = d3.extent(processedData.map((d) => d[1]));
            const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% padding
            const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% padding
            xDomain = [xExtent[0] - xPadding, xExtent[1] + xPadding];
            yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];
        }

        const xScale = d3.scaleLinear().domain(xDomain).range([0, svgWidth]);
        const yScale = d3.scaleLinear().range([svgHeight, 0]).domain(yDomain);

        // Set up color mapping
        Color2D.ranges = { x: xDomain, y: yDomain };

        // Get grid data
        const grid_prediction_image = gridData.prediction_image || activeLearningState.grid_prediction_image;

        // Setup VSUP color scale for predicted reward and uncertainty
        const colorScale = vsup.scale()
            .quantize(vsup.quantization().branching(2).layers(4).valueDomain([0, 1]).uncertaintyDomain([1.0, 0.01]))
            .range(d3.interpolateBrBG);

        // Pre-compute color scale for predicted rewards and uncertainties (makes draw call faster)
        const point_colors = processedData.map((d, i) => {
            const reward = predicted_rewards[i] || 0;
            const uncertainty = predicted_uncertainties[i] || 0;

            // Use the color scale for the prediction
            return colorScale(reward, uncertainty);
        });

        // Create unique cache keys based on current parameters to ensure fresh data
        const cacheKey = `${props.benchmarkId}_${props.checkpointStep}_${props.embeddingMethod}`;
        const predictionCacheKey = `prediction_${cacheKey}`;
        const uncertaintyCacheKey = `uncertainty_${cacheKey}`;

        // Preload and cache grid images with their bounds
        if (grid_prediction_image && !canvasImageCache.has(predictionCacheKey)) {
            const img = new Image();
            img.onload = () => {
                // Store image with metadata
                canvasImageCache.set(predictionCacheKey, {
                    image: img,
                    bounds: gridData.bounds
                });
                
                // Trigger a redraw now that the image is available, using current transform
                if (context && view.node()) {
                    const currentTransform = d3.zoomTransform(view.node() as Element);
                    zoomed({ transform: currentTransform });
                }
            };

            img.onerror = (e) => {
                console.error('Failed to load grid prediction image:', e);
            };

            img.src = `data:image/png;base64,${grid_prediction_image}`;
        }

        // Similarly for uncertainty image
        if (gridData.uncertainty_image && !canvasImageCache.has(uncertaintyCacheKey)) {
            const img = new Image();
            img.onload = () => {
                canvasImageCache.set(uncertaintyCacheKey, {
                    image: img,
                    bounds: gridData.bounds
                });
            };

            img.onerror = (e) => {
                console.error('Failed to load grid uncertainty image:', e);
            };

            img.src = `data:image/png;base64,${gridData.uncertainty_image}`;
        }

        // Helper function to calculate image bounds matching the projection space
        function calculateImageBounds(xScale, yScale, bounds) {
            // If we have grid data with bounds, use them exactly (no additional padding)
            // Backend already applies consistent 15% margin in global bounds computation
            if (bounds) {
                return {
                    x: xScale(bounds.x_min),
                    y: yScale(bounds.y_max), // Note: y axis is flipped in SVG coordinate system
                    width: xScale(bounds.x_max) - xScale(bounds.x_min),
                    height: yScale(bounds.y_min) - yScale(bounds.y_max)
                };
            }

            // Fallback to using the chart dimensions
            return {
                x: 0,
                y: 0,
                width: svgWidth,
                height: svgHeight
            };
        }

        // Helper function to draw image to canvas with transform
        function drawImageToCanvas(ctx, imageKey, transform, width, height) {
            if (!ctx) return;

            const imgData = canvasImageCache.get(imageKey);
            if (!imgData || !imgData.image) return;

            ctx.save();

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Apply transformation
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.k, transform.k);

            // Calculate image bounds in projection space
            const imageBounds = calculateImageBounds(xScale, yScale, imgData.bounds);

            // Draw the image with proper scaling
            ctx.globalAlpha = 0.5; // Slightly transparent so we can see points on top
            ctx.drawImage(
                imgData.image,
                0, 0, imgData.image.width, imgData.image.height,
                imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height
            );

            ctx.restore();
        }

        let loggedFirstZoom = false;

        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 15])
            .translateExtent([
                [-svgWidth * 2, -svgHeight * 2],
                [svgWidth * 3, svgHeight * 3],
            ])
            .on('zoom', zoomed)
            // Filter function to distinguish between zoom and click
            .filter(function (event) {
                // Allow wheel events (mousewheel zoom)
                if (event.type === 'wheel') return true;

                // Allow double-click events for zoom reset
                if (event.type === 'dblclick') return true;

                // For mouse events, allow zoom with left mouse button + drag
                if (event.type === 'mousedown' || event.type === 'mousemove') return true;

                // Block single clicks to allow selection
                return false;
            });

        // Create view group
        const view = svg.append('g').attr('class', 'view');
        // expose zoom behavior for external transforms
        zoomBehaviorRef.current = zoom;

        // Apply saved transform to the view if available, otherwise fall back to previous transform
        let transformToApply = null;
        if (savedTransform && !savedTransform.k.toString().includes('NaN') && savedTransform.k > 0) {
            transformToApply = savedTransform;
        } else if (prevTransform) {
            // Parse the transform string if available
            const match = prevTransform.match(/translate\(([^,]+),([^)]+)\)\s*scale\(([^)]+)\)/);
            if (match) {
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]); 
                const k = parseFloat(match[3]);
                if (!isNaN(x) && !isNaN(y) && !isNaN(k) && k > 0) {
                    transformToApply = d3.zoomIdentity.translate(x, y).scale(k);
                }
            }
        }
        
        // Store the transform to apply for use in async image loading
        const finalTransform = transformToApply || d3.zoomIdentity;

        // Add invisible rect to capture events
        const view_rect = view
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', svgHeight)
            .attr('width', svgWidth)
            .style('opacity', '0');

        // Add mouse events
        view_rect.on('mousemove', function (event) {
            const mouse = d3.pointer(event);

            // Map the clicked point to the data space
            const xClicked = xScale.invert(mouse[0]);
            const yClicked = yScale.invert(mouse[1]);

            // Find the closest point in the dataset to the clicked point
            const closest = quadTree.find(xClicked, yClicked, 10);

            if (closest && props.setHoverStep && props.infos) {
                props.setHoverStep(props.infos[closest[2]]);
                
                // Set hovered episode for thumbnail display
                const episodeIdx = processedData[closest[2]] && processedData[closest[2]].length > 3 
                    ? processedData[closest[2]][processedData[closest[2]].length - 1]
                    : episodeIndices[closest[2]];
                    
                if (episodeIdx !== undefined && episodeIdx !== null) {
                    setHoveredEpisode(episodeIdx);
                }
            } else {
                setHoveredEpisode(null);
            }
        });

        view_rect.on('mouseout', function (event) {
            setHoveredEpisode(null);
        });

        view_rect.on('click', function (event) {
            // Prevent default to avoid any interference
            event.preventDefault();

            // Stop propagation to prevent zoom from catching it
            event.stopPropagation();

            const mouse = d3.pointer(event);

            // Map the clicked point to the data space
            const xClicked = xScale.invert(mouse[0]);
            const yClicked = yScale.invert(mouse[1]);

            // Find the closest point in the dataset to the clicked point (increased search radius)
            const closest = quadTree.find(xClicked, yClicked, 0.02);

            if (closest) {
                // Find the correct episode index
                let episodeIdx = null;

                // Clear all other selections
                setSelectedCoordinate({ x: null, y: null });
                selectedCoordinateRef.current = { x: null, y: null };
                setSelectedCluster(null);
                selectedClusterRef.current = null;

                // Clear any existing coordinate marker and selected state marker
                view.selectAll('.coordinate-marker').remove();
                view.selectAll('.selected-state-marker').remove();

                // Reset cluster hull strokes
                /*d3.selectAll(".cluster_hull").style("stroke", function() {
                    const center = d3.polygonCentroid()
                    return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1]));
                });*/

                // First check if we have the episode directly in the processed data
                if (processedData[closest[2]] && processedData[closest[2]].length > 3) {
                    episodeIdx = processedData[closest[2]][processedData[closest[2]].length - 1];
                }
                // Fall back to the episodeIndices array
                else if (episodeIndices && episodeIndices[closest[2]] !== undefined) {
                    episodeIdx = episodeIndices[closest[2]];
                }
                // Get index within the selected episode (i.e. from start of episode)
                let episde_step = 0;
                if (episodeIdx !== null) {
                    const episodeStart = episodeIndices.indexOf(episodeIdx);
                    if (episodeStart !== -1) {
                        episde_step = closest[2] - episodeStart; // Adjust index to be relative to the episode start
                    }
                }

                if (episodeIdx !== null && episodeIdx !== undefined) {
                    // Create state selection (trajectory + step)
                    const newStateSelection: SelectionItem = { 
                        type: "state", 
                        data: {
                            episode: episodeIdx,
                            step: episde_step,
                            coords: [closest[0], closest[1]],
                            x: xClicked,
                            y: yClicked,
                            index: closest[2]
                        }
                    };
                    const newSelectedState: SelectedState = {
                        episode: episodeIdx,
                        step: episde_step,
                        coords: [closest[0], closest[1]],
                        x: xClicked,
                        y: yClicked,
                        index: closest[2]
                    };

                    // In single select mode, update both local state and global selection
                    setSelectedState(newSelectedState);
                    selectedStateRef.current = newSelectedState;
                    setSelectedTrajectory(episodeIdx);
                    selectedTrajectoryRef.current = episodeIdx;
                    setClickedEpisode(episodeIdx);
                    
                    if (multiSelectModeRef.current) {

                        // Add to existing selection - use ref to get current state
                        const currentSelection = currentSelectionRef.current;
                        // Check if this episode is already selected to avoid duplicates
                        const alreadySelected = currentSelection.some(item => 
                            (item.type === 'state' || item.type === 'trajectory') && item.data?.episode === episodeIdx
                        );
                        if (!alreadySelected) {
                            const newSelectionArray = [...currentSelection, newStateSelection];
                            activeLearningDispatch({
                                type: 'SET_SELECTION',
                                payload: newSelectionArray
                            });
                        }
                    } else {
                        
                        // For single select, use state selection
                        activeLearningDispatch({
                            type: 'SET_SELECTION',
                            payload: [newStateSelection]
                        });
                    }

                    // Force a redraw to show the highlighted trajectory and state
                    const currentTransform = d3.zoomTransform(view.node());
                    zoomed({ transform: currentTransform });
                }
            } else {
                // Skip coordinate selection in multi-select mode
                if (multiSelectModeRef.current) {
                    return;
                }
                
                // Clear all selections
                setSelectedTrajectory(null);
                selectedTrajectoryRef.current = null;
                setSelectedState(null);
                selectedStateRef.current = null;
                setSelectedCluster(null);
                selectedClusterRef.current = null;
                setClickedEpisode(null);

                // Reset cluster hull strokes
                /*d3.selectAll(".cluster_hull").style("stroke", function() {
                    const center = d3.polygonCentroid(
                    return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1]));
                });*/

                // Clear any existing coordinate marker
                view.selectAll('.coordinate-marker').remove();

                // Save the coordinate and draw a cross marker
                setSelectedCoordinate({ x: xClicked, y: yClicked });
                selectedCoordinateRef.current = { x: xClicked, y: yClicked };

                // Directly propagate coordinate selection to context
                const newCoordinateSelection: SelectionItem = { 
                    type: "coordinate", 
                    data: { x: xClicked, y: yClicked }
                };

                // Replace selection
                activeLearningDispatch({
                    type: 'SET_SELECTION',
                    payload: [newCoordinateSelection]
                });

                // Draw a cross marker at the position
                const crossSize = 8;
                const markerGroup = view.append("g")
                    .attr("class", "coordinate-marker");

                // Horizontal line
                markerGroup.append("line")
                    .attr("x1", xScale(xClicked) - crossSize)
                    .attr("y1", yScale(yClicked))
                    .attr("x2", xScale(xClicked) + crossSize)
                    .attr("y2", yScale(yClicked))
                    .style("stroke", "black")
                    .style("stroke-width", 2);

                // Vertical line
                markerGroup.append("line")
                    .attr("x1", xScale(xClicked))
                    .attr("y1", yScale(yClicked) - crossSize)
                    .attr("x2", xScale(xClicked))
                    .attr("y2", yScale(yClicked) + crossSize)
                    .style("stroke", "black")
                    .style("stroke-width", 2);
            }
        });

        svg.on('click', function (event) {
            // Only handle clicks directly on the SVG (not on points)
            if (event.target === this) {
                setSelectedTrajectory(null);

                // Force a redraw to update the visualization
                const currentTransform = d3.zoomTransform(view.node());
                zoomed({ transform: currentTransform });
            }
        });

        // Create line function for curves
        const lineFunction = d3
            .line()
            .curve(d3.curveCatmullRom)
            .x(function (d) {
                return xScale(d[0]);
            })
            .y(function (d) {
                return yScale(d[1]);
            });

        // Create label data map
        const label_data_map = new Map();
        const start_label_data = [0].concat(done_idx.slice(0, -1).map((d) => d + 1));

        for (let i = 0; i < start_label_data.length; i++) {
            label_data_map.set(start_label_data[i], ['Start']);
        }

        for (let i = 0; i < done_idx.length; i++) {
            // Place "Done" label one step earlier (on the last actual step before termination)
            const donePosition = Math.max(0, done_idx[i] - 1);
            if (!label_data_map.has(donePosition)) {
                label_data_map.set(donePosition, ['Done']);
            } else {
                label_data_map.get(donePosition).push('Done');
            }
        }

        for (let i = 0; i < labelInfos.length; i++) {
            const label = labelInfos[i].label;
            const ids = labelInfos[i].ids;

            for (let j = 0; j < ids.length; j++) {
                if (!label_data_map.has(ids[j])) {
                    label_data_map.set(ids[j], [label]);
                } else {
                    label_data_map.get(ids[j]).push(label);
                }
            }
        }

        // Create glyph labels for start/end states
        const glyph_labels = view
            .selectAll('glyph-g')
            .data(processedData.map((d, i) => [d[0], d[1], i]).filter((d) => label_data_map.has(d[2])))
            .enter()
            .append('g')
            .attr('class', 'glyph-g')
            .attr('id', (d) => 'glyph-g_' + d[2])
            .attr('transform', (d) => `translate(${xScale(d[0])}, ${yScale(d[1])})`);

        // Function to create start glyph (play triangle)
        const createStartGlyph = (container, size = 12, isHighlighted = false) => {
            const triangle = container.append('polygon')
                .attr('class', 'start-glyph')
                .attr('points', `${-size/2},${-size/2} ${size/2},0 ${-size/2},${size/2}`)
                .attr('fill', '#4CAF50')
                .attr('stroke', isHighlighted ? '#FFD700' : '#2E7D32')
                .attr('stroke-width', isHighlighted ? 4 : 2);
            
            // Add highlight glow effect for selected episodes
            if (isHighlighted) {
                triangle.attr('filter', 'drop-shadow(0 0 6px #FFD700)');
            }
            
            return triangle;
        };

        // Function to create end glyph (square stop)
        const createEndGlyph = (container, size = 10, isHighlighted = false) => {
            const square = container.append('rect')
                .attr('class', 'end-glyph')
                .attr('x', -size/2)
                .attr('y', -size/2)
                .attr('width', size)
                .attr('height', size)
                .attr('fill', '#F44336')
                .attr('stroke', isHighlighted ? '#FFD700' : '#C62828')
                .attr('stroke-width', isHighlighted ? 4 : 2);
            
            // Add highlight glow effect for selected episodes
            if (isHighlighted) {
                square.attr('filter', 'drop-shadow(0 0 6px #FFD700)');
            }
            
            return square;
        };

        // Add appropriate glyphs based on label type
        glyph_labels.each(function(d) {
            const labels = label_data_map.get(d[2]);
            const container = d3.select(this);
            
            // Determine which episode this glyph belongs to
            const glyphEpisodeIdx = episodeIndices[d[2]] || 0;
            const isHighlighted = selectedTrajectoryRef.current === glyphEpisodeIdx;
            
            if (labels.includes('Start')) {
                createStartGlyph(container, 14, isHighlighted);
            }
            if (labels.includes('Done')) {
                createEndGlyph(container, 12, isHighlighted);
            }
        });
        

        // Render top K merged segments by uncertainty 
        const maxSegments = maxUncertaintySegments;
        if (segments.length > 0 && predicted_uncertainties.length > 0) {
            // Calculate average uncertainty for each merged segment
            const mergedSegmentsWithUncertainty = segments.map(mergedSegment => {
                // Get uncertainty values for all points in this merged segment
                const segmentUncertainties = [];
                const segmentGlobalIndices = [];
                
                // Iterate through all inner segments within this merged segment
                mergedSegment.segments.forEach(innerSegment => {
                    // Map segment's episode and local indices to global state indices
                    for (let i = 0; i < episodeIndices.length; i++) {
                        const stateEpisodeIdx = episodeIndices[i];
                        
                        // Check if this state belongs to the inner segment's episode
                        if (stateEpisodeIdx === innerSegment.episodeIdx) {
                            // Find the position of this state within its episode
                            const statesInThisEpisode = episodeIndices.slice(0, i + 1).filter(eIdx => eIdx === stateEpisodeIdx);
                            const positionInEpisode = statesInThisEpisode.length - 1; // 0-based position
                            
                            // Check if this position falls within the inner segment's range
                            if (positionInEpisode >= innerSegment.startIdx && positionInEpisode <= innerSegment.endIdx) {
                                segmentGlobalIndices.push(i);
                                if (predicted_uncertainties[i] !== undefined) {
                                    segmentUncertainties.push(predicted_uncertainties[i]);
                                }
                            }
                        }
                    }
                });
                
                // Calculate average uncertainty
                const avgUncertainty = segmentUncertainties.length > 0 
                    ? segmentUncertainties.reduce((sum, u) => sum + u, 0) / segmentUncertainties.length
                    : 0;
                
                return { mergedSegment, avgUncertainty, globalIndices: segmentGlobalIndices };
            });
            
            // Sort by uncertainty (highest first)
            const sortedSegments = mergedSegmentsWithUncertainty
                .sort((a, b) => b.avgUncertainty - a.avgUncertainty);
            
            // Apply minimum distance constraint to avoid overlapping segments
            const selectedSegments = [];
            const minDistance = 0.15; // Adjust based on your data scale
            
            for (const segmentData of sortedSegments) {
                const tooClose = selectedSegments.some(selected => {
                    const dx = segmentData.mergedSegment.centroid[0] - selected.mergedSegment.centroid[0];
                    const dy = segmentData.mergedSegment.centroid[1] - selected.mergedSegment.centroid[1];
                    return Math.sqrt(dx * dx + dy * dy) < minDistance;
                });
                
                if (!tooClose) {
                    selectedSegments.push(segmentData);
                    if (selectedSegments.length >= maxSegments) break;
                }
            }
            
            const topMergedSegments = selectedSegments;
            
            // Render the top merged segments
            const segmentGroup = view.append('g').attr('class', 'top-uncertainty-segments');
            
            topMergedSegments.forEach(({ mergedSegment }, index) => {
                if (!mergedSegment.convexHull || mergedSegment.convexHull.length < 3) return;

                // Expand hull outward from centroid to avoid overlapping with segments
                const expansionFactor = 1.15; // 15% larger
                const centroid = mergedSegment.centroid;
                
                const expandedHull = mergedSegment.convexHull.map(point => {
                    // Calculate vector from centroid to hull point
                    let dx = point[0] - centroid[0];
                    let dy = point[1] - centroid[1];

                    // make sure that dx/dy is suffiently wide
                    if (Math.abs(dx) < 0.01) {

                        dx = Math.sign(dx) * 0.01;
                    }
                    if (Math.abs(dy) < 0.01) {
                        dy = Math.sign(dy) * 0.01;
                    }

                    // Scale the vector outward by the expansion factor
                    return [
                        centroid[0] + dx * expansionFactor,
                        centroid[1] + dy * expansionFactor
                    ];
                });

                // Map expanded hull points to screen coordinates
                const mappedHull = expandedHull.map(p => [xScale(p[0]), yScale(p[1])]);
                
                const segmentElement = segmentGroup.append('g')
                    .attr('class', 'uncertainty-segment')
                    .attr('id', `uncertainty-segment-${mergedSegment.id}`);
                
                // Add invisible clickable area first
                segmentElement
                    .append('path')
                    .attr('class', 'uncertainty-segment-clickarea')
                    .attr('d', 'M' + mappedHull.join('L') + 'Z')
                    .attr('fill', 'none')
                    .attr('stroke', 'transparent')
                    .attr('stroke-width', 3) // Wide invisible stroke for easier clicking
                    .style('cursor', 'pointer')
                    .on('click', function (event) {
                        event.stopPropagation();
                        
                        // Skip cluster selection in multi-select mode
                        if (multiSelectModeRef.current) {
                            return;
                        }
                        
                        // Clear other selections
                        setSelectedTrajectory(null);
                        selectedTrajectoryRef.current = null;
                        setSelectedState(null);
                        selectedStateRef.current = null;
                        setSelectedCoordinate({ x: null, y: null });
                        selectedCoordinateRef.current = { x: null, y: null };
                        
                        // Clear any existing coordinate marker
                        view.selectAll('.coordinate-marker').remove();
                        
                        // Reset all segment strokes
                        segmentGroup.selectAll('.uncertainty-segment-hull')
                            .attr('stroke', '#333333')
                            .attr('opacity', 0.7)
                            .attr('stroke-width', 2);
                        
                        // Highlight this segment's visible hull
                        d3.select(this.parentNode).select('.uncertainty-segment-hull')
                            .attr('stroke-width', 3.5)
                            .attr('opacity', 0.9);
                        
                        // Get all indices belonging to this merged segment (precomputed)
                        const segmentIndices = topMergedSegments[index].globalIndices || [];
                        
                        // Store segment selection with more detailed information
                        const clusterLabel = `Cluster ${index + 1}`;
                        const clusterInfo = { label: clusterLabel, indices: segmentIndices };
                        setSelectedCluster(clusterInfo);
                        selectedClusterRef.current = clusterInfo;
                        
                        // Directly propagate cluster selection to context
                        const newClusterSelection: SelectionItem = { 
                            type: "cluster", 
                            data: segmentIndices, 
                            label: clusterLabel 
                        };
                        // Replace selection (no multi-select for clusters)
                        activeLearningDispatch({
                            type: 'SET_SELECTION',
                            payload: [newClusterSelection]
                        });
                        
                        // Trigger immediate re-render to show cluster state highlights
                        const currentTransform = d3.zoomTransform(view.node());
                        zoomed({ transform: currentTransform });
                    });
                
                // Add visible dashed hull path on top
                segmentElement
                    .append('path')
                    .attr('class', 'uncertainty-segment-hull')
                    .attr('d', 'M' + mappedHull.join('L') + 'Z')
                    .attr('fill', 'none')
                    .attr('stroke', '#333333') // Dark grey
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '10,5') // Dashed line
                    .attr('opacity', 0.7)
                    .style('pointer-events', 'none'); // Don't interfere with clicking
                
                // Add merged segment label (H1, H2, etc. for "High uncertainty")
                const center = mergedSegment.centroid;
                segmentElement
                    .append('text')
                    .attr('class', 'uncertainty-segment-label')
                    .attr('x', xScale(center[0]))
                    .attr('y', yScale(center[1]))
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.3em')
                    .attr('font-size', '16px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#000000')
                    .attr('stroke-width', 2)
                    .attr('pointer-events', 'none')
                    //.text(`${index + 1}`);
            });
        }

        // Create episodeToPaths mapping for efficient rendering
        const episodeToPaths = new Map();

        episodeIndices.forEach((episodeIdx, i) => {
            if (!episodeToPaths.has(episodeIdx)) {
                episodeToPaths.set(episodeIdx, []);
            }

            if (i < processedData.length) {
                episodeToPaths.get(episodeIdx).push(processedData[i]);
            }
        });
        
        // Trim last observation from each trajectory to handle gym environment overlap
        episodeToPaths.forEach((pathPoints, episodeIdx) => {
            if (pathPoints.length > 1) {
                // Remove the last point (which is the first point of the next episode)
                pathPoints.pop();
            }
        });
        
        // Zoom handler function
        function zoomed(event) {

            const transform = event.transform;
            view.attr('transform', transform);
            
            // Store the current transform for future data reloads
            currentTransformRef.current = transform;

            const currentHighlightedTrajectory = selectedTrajectoryRef.current;

            //const isZoomEnd = event.sourceEvent &&
            //    (event.sourceEvent.type === 'mouseup' || event.sourceEvent.type === 'touchend');
            const isZoomEnd = true;

            // Compute similarity-based colors for all trajectories outside the canvas context
            const computedTrajectoryColors = computeTrajectoryColors(episodeToPaths);
            setTrajectoryColors(computedTrajectoryColors);
            
            // Dispatch the colors to the active learning context
            activeLearningDispatch({
                type: 'SET_TRAJECTORY_COLORS',
                payload: computedTrajectoryColors
            });

            // First, draw the grid image to the canvas with proper transformation
            if (context) {
                // Draw the appropriate image based on visualization mode
                const imageKey = predictionCacheKey; // or uncertaintyCacheKey based on UI state
                drawImageToCanvas(context, imageKey, transform, svgWidth, svgHeight);

                // Draw additional items on top if needed
                if (isZoomEnd) {
                    const r = Math.round((3 / transform.k) * 100) / 100;
                    const width = Math.round((2.5 / transform.k) * 100) / 100;

                    // Save current context
                    context.save();

                    // Apply the same transformation as the background image
                    context.translate(transform.x, transform.y);
                    context.scale(transform.k, transform.k);
                    
                    // Draw paths with efficient batching
                    episodeToPaths.forEach((pathPoints, episodeIdx) => {
                        if (pathPoints.length === 0) return;

                        // Highlight the selected trajectory
                        const isHighlighted = currentHighlightedTrajectory === episodeIdx;

                        // Use similarity-based color
                        const trajectoryColor = computedTrajectoryColors.get(episodeIdx) || getFallbackColor(episodeIdx);
                        
                        // Transform points to screen coordinates
                        const screenPoints = pathPoints.map(p => [xScale(p[0]), yScale(p[1])]);
                        
                        // Use thicker stroke for selected episode
                        const strokeWidth = isHighlighted ? width * 2 : width;
                        drawTrajectory(context, screenPoints, trajectoryColor, strokeWidth);
                    });

                    // Batch draw points for better performance
                    //context.globalAlpha = 0.5;
                    context.beginPath();

                    for (const [x, y, i] of processedData.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {

                        // Check if point is part of highlighted trajectory
                        const pointEpisodeIdx = episodeIndices[i] || 0;
                        const isHighlighted = currentHighlightedTrajectory === pointEpisodeIdx;
                        if (!isHighlighted) continue;
                        
                        // Skip rendering circle if this point has a glyph (start/end state)
                        const hasGlyph = label_data_map.has(i);
                        if (hasGlyph) continue;
                        
                        const pointColor = point_colors[i];
                        context.fillStyle = pointColor;
                        context.strokeStyle = pointColor;
                        context.lineWidth = width;
                        context.globalAlpha = isHighlighted ? 0.9 : 0.5;
                        context.beginPath();

                        context.arc(x, y, isHighlighted ? r * 1.5 : r, 0, 2 * Math.PI);
                        context.fill();
                        //context.stroke();
                        context.closePath();
                    }

                    // Draw cluster state points if a cluster is selected
                    if (selectedClusterRef.current && selectedClusterRef.current.indices) {
                        const clusterIndices = selectedClusterRef.current.indices;
                        
                        for (const stateIndex of clusterIndices) {
                            if (stateIndex < processedData.length) {
                                const [x, y] = [xScale(processedData[stateIndex][0]), yScale(processedData[stateIndex][1])];
                                
                                // Skip if this point has a glyph (start/end state)
                                const hasGlyph = label_data_map.has(stateIndex);
                                if (hasGlyph) continue;
                                
                                // Use the normal uncertainty-based color for the fill
                                const pointColor = point_colors[stateIndex] || '#888888';
                                context.fillStyle = pointColor;
                                //context.strokeStyle = '#FFFFFF';
                                context.lineWidth = 1;
                                context.globalAlpha = 0.9;
                                context.beginPath();
                                context.arc(x, y, r * 1.2, 0, 2 * Math.PI);
                                context.fill();
                                //context.stroke();
                                context.closePath();
                            }
                        }
                    }


                    context.restore();
                }
            }


            if (selectedCoordinateRef.current?.x !== null && selectedCoordinateRef.current?.x !== undefined) {
                const crossSize = 10;
                const markerGroup = view.append("g")
                    .attr("class", "coordinate-marker");

                const coordX = selectedCoordinateRef.current.x!;
                const coordY = selectedCoordinateRef.current.y!;
                
                // Horizontal line
                markerGroup.append("line")
                    .attr("x1", xScale(coordX) - crossSize)
                    .attr("y1", yScale(coordY))
                    .attr("x2", xScale(coordX) + crossSize)
                    .attr("y2", yScale(coordY))
                    .style("stroke", "red")
                    .style("stroke-width", 2);

                // Vertical line
                markerGroup.append("line")
                    .attr("x1", xScale(coordX))
                    .attr("y1", yScale(coordY) - crossSize)
                    .attr("x2", xScale(coordX))
                    .attr("y2", yScale(coordY) + crossSize)
                    .style("stroke", "red")
                    .style("stroke-width", 2);
            }

            // Highlight selected single state
            if (selectedStateRef.current && selectedStateRef.current.coords) {
                // Remove any existing selected state markers
                view.selectAll('.selected-state-marker').remove();
                
                const selectedStateX = selectedStateRef.current.coords[0];
                const selectedStateY = selectedStateRef.current.coords[1];
                const selectedStateIndex = selectedStateRef.current.index;
                
                // Create marker group for selected state
                const stateMarkerGroup = view.append("g")
                    .attr("class", "selected-state-marker");

                // Draw highlighted circle sized in screen pixels (independent of zoom)
                const desiredScreenRadius = 5; // px
                const highlightRadius = desiredScreenRadius / transform.k; // convert to local coords
                
                // Get the original color of the state
                const stateColor = point_colors[selectedStateIndex] || '#ff6b6b';
                
                // Draw the highlighted state point
                stateMarkerGroup.append("circle")
                    .attr("cx", xScale(selectedStateX))
                    .attr("cy", yScale(selectedStateY))
                    .attr("r", highlightRadius)
                    .style("fill", stateColor)
                    .style("stroke", "#000000")
                    .style("stroke-width", 2 / transform.k) // keep ~2px on screen
                    .style("opacity", 0.9);
                
                // Add a subtle glow effect with a slightly larger circle behind
                stateMarkerGroup.insert("circle", ":first-child")
                    .attr("cx", xScale(selectedStateX))
                    .attr("cy", yScale(selectedStateY))
                    .attr("r", (desiredScreenRadius * 1.6) / transform.k)
                    .style("fill", stateColor)
                    .style("stroke", "none")
                    .style("opacity", 0.3);
            }

            if (transform.k > 0.2) {
                glyph_labels.attr('display', 'inline');
                view.selectAll('.segment-overlays').attr('display', 'inline');
            } else {
                glyph_labels.attr('display', 'none');
                view.selectAll('.segment-overlays').attr('display', 'none');
            }

            // Scale glyphs inversely to zoom level to maintain consistent size
            const glyphScale = 1 / transform.k;
            glyph_labels.selectAll('.start-glyph, .end-glyph')
                .attr('transform', `scale(${glyphScale})`);
            
            // Scale segment labels
            view.selectAll('.segment-label')
                .attr('font-size', `${12 * glyphScale}px`);
            
            // Update stroke width and highlighting based on selection
            glyph_labels.each(function(d) {
                const glyphEpisodeIdx = episodeIndices[d[2]] || 0;
                const isHighlighted = currentHighlightedTrajectory === glyphEpisodeIdx;
                
                d3.select(this).selectAll('.start-glyph, .end-glyph')
                    .attr('stroke-width', (isHighlighted ? 4 : 2) * glyphScale)
                    .attr('stroke', isHighlighted ? '#FFD700' : function() {
                        return d3.select(this).classed('start-glyph') ? '#2E7D32' : '#C62828';
                    })
                    .attr('filter', isHighlighted ? 'drop-shadow(0 0 6px #FFD700)' : null);
            });
        }
        
        // Store the zoomed function reference for external calls
        zoomedFunctionRef.current = zoomed;

        // Expose a helper to fit an episode's bounding box into view
        fitEpisodeInViewRef.current = (episodeToFit: number) => {
            try {
                // gather points for the episode
                const pts = processedData.filter((_, i) => episodeIndices[i] === episodeToFit);
                if (!pts || pts.length === 0) return;

                const xs = pts.map(p => p[0]);
                const ys = pts.map(p => p[1]);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                // convert to current pixel space using xScale/yScale
                const x0 = xScale(minX);
                const x1 = xScale(maxX);
                const y0 = yScale(maxY); // y inverted
                const y1 = yScale(minY);

                const bboxWidth = Math.max(1, x1 - x0);
                const bboxHeight = Math.max(1, y1 - y0);

                // Scale to fit with padding
                const margin = 30; // px padding around episode
                const availableW = Math.max(1, svgWidth - 2 * margin);
                const availableH = Math.max(1, svgHeight - 2 * margin);
                const k = Math.min(availableW / bboxWidth, availableH / bboxHeight);

                // Center the episode within the viewport
                const bboxCenterX = (x0 + x1) / 2;
                const bboxCenterY = (y0 + y1) / 2;
                const targetCenterX = svgWidth / 2;
                const targetCenterY = svgHeight / 2;
                const tx = targetCenterX - k * bboxCenterX;
                const ty = targetCenterY - k * bboxCenterY;

                const t = d3.zoomIdentity.translate(tx, ty).scale(k);

                const svgRoot = d3.select(embeddingRef.current).select('svg');
                // apply to zoom behavior if available
                if (zoomBehaviorRef.current) {
                    (svgRoot as any).call(zoomBehaviorRef.current.transform, t);
                }
                // ensure layers redraw
                view.attr('transform', t);
                currentTransformRef.current = t;
                if (zoomedFunctionRef.current) {
                    zoomedFunctionRef.current({ transform: t });
                }
            } catch (e) {
                console.warn('fitEpisodeInView failed:', e);
            }
        };

        svg.call(zoom as any);

        // Apply the transform to the zoom behavior itself so it's properly initialized
        if (transformToApply) {
            svg.call(zoom.transform as any, transformToApply);
        }

        // Draw initial state - this will handle both cases (image loaded or not)
        zoomed({ transform: finalTransform });

        return () => {
            // Cleanup on unmount
        };
    }, [props, activeLearningState.grid_prediction_image, activeLearningDispatch, maxUncertaintySegments]);

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
                        gap: 2,
                        visibility: isLoading ? 'hidden' : 'visible'
                    }}
                >
                    <Tooltip title="Clear Selection">
                        <IconButton
                            color="default"
                            sx={{
                                backgroundColor: 'rgba(185, 185, 185, 0.7)',
                                '&:hover': { backgroundColor: 'rgba(185, 185, 185, 0.9)' }
                            }}
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
                                sx={{
                                    backgroundColor: multiSelectMode ? 'rgba(25, 118, 210, 0.7)' : 'rgba(185, 185, 185, 0.7)',
                                    '&:hover': { backgroundColor: multiSelectMode ? 'rgba(25, 118, 210, 0.9)' : 'rgba(185, 185, 185, 0.9)' }
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
                    <OnboardingHighlight stepId="load-data" pulse={true}>
                        <Button variant="contained" color="primary" onClick={loadData} disabled={isLoading}>
                            {isLoading ? 'Loading...' : 'Load Data'}
                        </Button>
                    </OnboardingHighlight>
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
                                    const scale = vsup.scale().quantize(vsup.quantization().branching(2).layers(4).valueDomain([0, 1]).uncertaintyDomain([1.0, 0.01])).range(d3.interpolateBrBG);
                                    indicatorColor = scale(rNorm, uNorm);
                                }

                                const isSelected = selectedTrajectory === ep || (selectedState && selectedState.episode === ep);

                                return (
                                    <Box
                                        key={`ep-tile-${ep}`}
                                        onClick={() => {
                                            // select initial state of the episode
                                            const episodeStartIndex = (activeLearningState.episodeIndices || []).indexOf(ep);
                                            if (episodeStartIndex !== -1) {
                                                const coords = (activeLearningState.projectionStates || [])[episodeStartIndex] || [0, 0];
                                                const safeCoords: [number, number] = coords.length >= 2 ? [coords[0], coords[1]] : [0, 0];
                                                const newSelectedState: SelectedState = {
                                                    episode: ep,
                                                    step: 0,
                                                    coords: safeCoords,
                                                    x: safeCoords[0],
                                                    y: safeCoords[1],
                                                    index: episodeStartIndex
                                                };
                                                setSelectedState(newSelectedState);
                                                selectedStateRef.current = newSelectedState;
                                                setSelectedTrajectory(ep);
                                                selectedTrajectoryRef.current = ep;
                                                const newStateSelection: SelectionItem = { type: 'state', data: newSelectedState } as any;
                                                activeLearningDispatch({
                                                    type: 'SET_SELECTION',
                                                    payload: [newStateSelection]
                                                });
                                                // try to fit in view
                                                if (fitEpisodeInViewRef.current) {
                                                    fitEpisodeInViewRef.current(ep);
                                                }
                                            }
                                        }}
                                        sx={{
                                            cursor: 'pointer',
                                            border: `2px solid ${color}`,
                                            borderRadius: 1,
                                            px: 1,
                                            py: 0.75,
                                            bgcolor: '#ffffff',
                                            color: 'text.primary',
                                            boxShadow: isSelected ? 4 : 1,
                                            minWidth: 96,
                                            transition: 'box-shadow 0.2s ease, transform 0.05s ease',
                                            '&:hover': { boxShadow: 3 }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: indicatorColor, border: '1px solid #999' }} />
                                            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Ep {ep}</Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                                            {avgR !== null ? `R: ${avgR.toFixed(2)}` : 'R: -'}{` `}|{` `}{avgU !== null ? `U: ${avgU.toFixed(2)}` : 'U: -'}
                                        </Typography>
                                    </Box>
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
                    <GlyphLegendComponent />
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
            
            {/* Timeline Component - Positioned relative to the StateSequenceProjection container */}
            {showTimeline && selectedState && selectedState.episode !== null && selectedState.step !== null && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 15,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        pointerEvents: 'auto', // Ensure the timeline can receive events
                    }}
                >
                    <TimelineComponent
                        selectedEpisode={selectedState.episode}
                        selectedStep={selectedState.step}
                        onClose={() => setShowTimeline(false)}
                        onStepSelect={(step) => {
                            // Update the selected state with the new step
                            if (selectedState.episode !== null) {
                                // Calculate the global index for this episode and step
                                const episodeStartIndex = activeLearningState.episodeIndices.findIndex(idx => idx === selectedState.episode);
                                if (episodeStartIndex !== -1) {
                                    const globalIndex = episodeStartIndex + step;
                                    const projectionStates = activeLearningState.projectionStates || [];
                                    
                                    if (globalIndex < projectionStates.length) {
                                        const coords = projectionStates[globalIndex];
                                        // Ensure coords has at least 2 elements
                                        const safeCoords: [number, number] = coords.length >= 2 ? [coords[0], coords[1]] : [0, 0];
                                        
                                        const newSelectedState: SelectedState = {
                                            episode: selectedState.episode,
                                            step: step,
                                            coords: safeCoords,
                                            x: safeCoords[0],
                                            y: safeCoords[1],
                                            index: globalIndex
                                        };
                                        
                                        setSelectedState(newSelectedState);
                                        selectedStateRef.current = newSelectedState;
                                        
                                        // Update global selection
                                        const newStateSelection: SelectionItem = { 
                                            type: "state", 
                                            data: {
                                                episode: selectedState.episode,
                                                step: step,
                                                coords: safeCoords,
                                                x: safeCoords[0],
                                                y: safeCoords[1],
                                                index: globalIndex
                                            }
                                        };
                                        
                                        activeLearningDispatch({
                                            type: 'SET_SELECTION',
                                            payload: [newStateSelection]
                                        });
                                        
                                        // Trigger a redraw to show the updated state
                                        if (zoomedFunctionRef.current && embeddingRef.current) {
                                            const svg = d3.select(embeddingRef.current).select('svg');
                                            if (svg.node()) {
                                                const view = svg.select('.view');
                                                if (view.node()) {
                                                    const viewNode = view.node() as Element;
                                                    const currentTransform = d3.zoomTransform(viewNode);
                                                    zoomedFunctionRef.current({ transform: currentTransform });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }}
                        width={600}
                        height={100}
                    />
                </Box>
            )}
        </Box>
    );

};

export default StateSequenceProjection;
