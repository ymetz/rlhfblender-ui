import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    Tooltip,
    IconButton,
    Card,
    CardMedia
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
//import RebaseEditIcon from '@mui/icons-material/RebaseEdit';
import CreateIcon from '@mui/icons-material/Create';
import { styled } from '@mui/material/styles';
import * as d3 from 'd3';
import axios from 'axios';
import { Color2D } from './projection_utils/2dcolormaps';
// import vsup
import * as vsup from 'vsup';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { useAppState } from '../AppStateContext';
import { IDfromEpisode } from '../id';
import { useGetter } from '../getter-context';
import { computeTrajectoryColors, getFallbackColor, getEpisodeColor } from './utils/trajectoryColors';

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


// Segment extraction and processing for RLHF
interface TrajectorySegment {
    id: string;
    episodeIdx: number;
    startIdx: number;
    endIdx: number;
    points: number[][];
    centroid: [number, number];
    similarity?: number;
}

interface MergedSegment {
    id: string;
    segments: TrajectorySegment[];
    centroid: [number, number];
    boundingBox: { minX: number, maxX: number, minY: number, maxY: number };
    representative: TrajectorySegment;
    convexHull?: [number, number][];
    directionalBox?: {
        startPoint: [number, number];
        endPoint: [number, number];
        width: number;
        angle: number;
    };
}

// Extract K-step segments from trajectories
function extractSegments(episodeToPaths: Map<number, number[][]>, segmentSize: number = 50): TrajectorySegment[] {
    const segments: TrajectorySegment[] = [];

    
    episodeToPaths.forEach((pathPoints, episodeIdx) => {
        if (pathPoints.length < segmentSize) return;
        
        // Extract overlapping segments (stride = segmentSize/2 for overlap)
        const stride = Math.max(1, Math.floor(segmentSize / 2));
        
        for (let startIdx = 0; startIdx <= pathPoints.length - segmentSize; startIdx += stride) {
            const endIdx = startIdx + segmentSize - 1;
            const segmentPoints = pathPoints.slice(startIdx, startIdx + segmentSize);
            
            // Calculate centroid
            const centroidX = segmentPoints.reduce((sum, p) => sum + p[0], 0) / segmentPoints.length;
            const centroidY = segmentPoints.reduce((sum, p) => sum + p[1], 0) / segmentPoints.length;
            
            segments.push({
                id: `${episodeIdx}_${startIdx}_${endIdx}`,
                episodeIdx,
                startIdx,
                endIdx,
                points: segmentPoints,
                centroid: [centroidX, centroidY]
            });
        }
    });
    
    return segments;
}

// Calculate similarity between two segments
function calculateSegmentSimilarity(seg1: TrajectorySegment, seg2: TrajectorySegment): number {
    // Use centroid distance and start/end point similarity
    const centroidDist = Math.sqrt(
        Math.pow(seg1.centroid[0] - seg2.centroid[0], 2) +
        Math.pow(seg1.centroid[1] - seg2.centroid[1], 2)
    );
    
    // Start point similarity
    const startDist = Math.sqrt(
        Math.pow(seg1.points[0][0] - seg2.points[0][0], 2) +
        Math.pow(seg1.points[0][1] - seg2.points[0][1], 2)
    );
    
    // End point similarity
    const endDist = Math.sqrt(
        Math.pow(seg1.points[seg1.points.length-1][0] - seg2.points[seg2.points.length-1][0], 2) +
        Math.pow(seg1.points[seg1.points.length-1][1] - seg2.points[seg2.points.length-1][1], 2)
    );
    
    // Combined similarity score (lower is more similar)
    return (centroidDist + startDist + endDist) / 3;
}

// Merge similar segments using clustering
function mergeSegments(segments: TrajectorySegment[], similarityThreshold: number = 0.05): MergedSegment[] {
    const mergedSegments: MergedSegment[] = [];
    const used = new Set<string>();
    
    segments.forEach(segment => {
        if (used.has(segment.id)) return;
        
        const cluster: TrajectorySegment[] = [segment];
        used.add(segment.id);
        
        // Find similar segments
        segments.forEach(otherSegment => {
            if (used.has(otherSegment.id) || segment.id === otherSegment.id) return;
            
            const similarity = calculateSegmentSimilarity(segment, otherSegment);
            if (similarity <= similarityThreshold) {
                cluster.push(otherSegment);
                used.add(otherSegment.id);
            }
        });
        
        // Calculate merged segment properties
        const allPoints = cluster.flatMap(s => s.points);
        const centroidX = allPoints.reduce((sum, p) => sum + p[0], 0) / allPoints.length;
        const centroidY = allPoints.reduce((sum, p) => sum + p[1], 0) / allPoints.length;
        
        const minX = Math.min(...allPoints.map(p => p[0]));
        const maxX = Math.max(...allPoints.map(p => p[0]));
        const minY = Math.min(...allPoints.map(p => p[1]));
        const maxY = Math.max(...allPoints.map(p => p[1]));
        
        // Calculate convex hull for the merged segment
        const convexHull = calculateSimpleConcaveHull(allPoints);
        
        // Calculate directional box based on representative segment
        const repStartPoint = segment.points[0];
        const repEndPoint = segment.points[segment.points.length - 1];
        const segmentLength = Math.sqrt(
            Math.pow(repEndPoint[0] - repStartPoint[0], 2) + 
            Math.pow(repEndPoint[1] - repStartPoint[1], 2)
        );
        const angle = Math.atan2(repEndPoint[1] - repStartPoint[1], repEndPoint[0] - repStartPoint[0]);
        
        // Width scales with number of segments (more segments = wider box)
        const baseWidth = 0.1; // Base width in data units
        const scaledWidth = baseWidth * Math.log(cluster.length + 1);
        
        mergedSegments.push({
            id: `merged_${segment.id}`,
            segments: cluster,
            centroid: [centroidX, centroidY],
            boundingBox: { minX, maxX, minY, maxY },
            representative: segment,
            convexHull,
            directionalBox: {
                startPoint: [repStartPoint[0], repStartPoint[1]],
                endPoint: [repEndPoint[0], repEndPoint[1]],
                width: scaledWidth,
                angle
            }
        });
    });
    
    return mergedSegments;
}

// Calculate convex hull using Graham scan algorithm
function calculateConvexHull(points: number[][]): [number, number][] {
    if (points.length < 3) return points.map(p => [p[0], p[1]] as [number, number]);
    
    // Find the bottom-most point (and leftmost in case of tie)
    let bottom = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i][1] < points[bottom][1] || 
            (points[i][1] === points[bottom][1] && points[i][0] < points[bottom][0])) {
            bottom = i;
        }
    }
    
    // Swap bottom point to index 0
    [points[0], points[bottom]] = [points[bottom], points[0]];
    const pivot = points[0];
    
    // Sort points by polar angle with respect to pivot
    const sortedPoints = points.slice(1).sort((a, b) => {
        const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
        const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
        if (angleA === angleB) {
            // If angles are equal, sort by distance
            const distA = Math.pow(a[0] - pivot[0], 2) + Math.pow(a[1] - pivot[1], 2);
            const distB = Math.pow(b[0] - pivot[0], 2) + Math.pow(b[1] - pivot[1], 2);
            return distA - distB;
        }
        return angleA - angleB;
    });
    
    // Graham scan
    const hull: [number, number][] = [[pivot[0], pivot[1]]];
    
    for (const point of sortedPoints) {
        // Remove points that make clockwise turn
        while (hull.length > 1) {
            const [p1, p2] = [hull[hull.length - 2], hull[hull.length - 1]];
            const cross = (p2[0] - p1[0]) * (point[1] - p1[1]) - (p2[1] - p1[1]) * (point[0] - p1[0]);
            if (cross <= 0) {
                hull.pop();
            } else {
                break;
            }
        }
        hull.push([point[0], point[1]]);
    }
    
    return hull;
}

// Alternative: Simple concave hull using edge length threshold
function calculateSimpleConcaveHull(points: number[][], maxEdgeLength?: number): [number, number][] {
    if (points.length < 3) return points.map(p => [p[0], p[1]] as [number, number]);
    
    // Calculate average distance between points to determine threshold
    if (!maxEdgeLength) {
        let totalDistance = 0;
        let count = 0;
        for (let i = 0; i < Math.min(points.length, 20); i++) {
            for (let j = i + 1; j < Math.min(points.length, 20); j++) {
                totalDistance += Math.sqrt(
                    Math.pow(points[i][0] - points[j][0], 2) + 
                    Math.pow(points[i][1] - points[j][1], 2)
                );
                count++;
            }
        }
        maxEdgeLength = (totalDistance / count) * 2; // 2x average distance
    }
    
    // Start with convex hull
    const convexHull = calculateConvexHull(points);
    
    // Check if any edges are too long and need to be "cut"
    const result: [number, number][] = [];
    
    for (let i = 0; i < convexHull.length; i++) {
        const current = convexHull[i];
        const next = convexHull[(i + 1) % convexHull.length];
        
        result.push(current);
        
        const edgeLength = Math.sqrt(
            Math.pow(next[0] - current[0], 2) + 
            Math.pow(next[1] - current[1], 2)
        );
        
        // If edge is too long, try to find intermediate points
        if (edgeLength > maxEdgeLength) {
            const intermediatePoints = points.filter(p => {
                const distToCurrent = Math.sqrt(Math.pow(p[0] - current[0], 2) + Math.pow(p[1] - current[1], 2));
                const distToNext = Math.sqrt(Math.pow(p[0] - next[0], 2) + Math.pow(p[1] - next[1], 2));
                
                // Point should be closer to the edge than the edge length threshold
                return distToCurrent < maxEdgeLength && distToNext < maxEdgeLength && 
                       distToCurrent > 0.01 && distToNext > 0.01; // Avoid duplicates
            });
            
            // Sort by distance from current point
            intermediatePoints.sort((a, b) => {
                const distA = Math.sqrt(Math.pow(a[0] - current[0], 2) + Math.pow(a[1] - current[1], 2));
                const distB = Math.sqrt(Math.pow(b[0] - current[0], 2) + Math.pow(b[1] - current[1], 2));
                return distA - distB;
            });
            
            // Add a few intermediate points
            for (let j = 0; j < Math.min(2, intermediatePoints.length); j++) {
                result.push([intermediatePoints[j][0], intermediatePoints[j][1]]);
            }
        }
    }
    
    return result;
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
}));

// Thumbnail overlay styled component
const ThumbnailOverlay = styled(Card)(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
    width: '200px',
    height: '200px',
    zIndex: 30,
    border: '3px solid',
    transition: 'opacity 0.3s',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    '&:hover': {
        opacity: 1,
    },
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
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCoordinate, setSelectedCoordinate] = useState({ x: null, y: null });
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [hoveredEpisode, setHoveredEpisode] = useState(null);
    const [clickedEpisode, setClickedEpisode] = useState(null);
    const [thumbnailUrl, setThumbnailUrl] = useState(null);
    const [selectedSegment, setSelectedSegment] = useState<MergedSegment | null>(null);
    const [segmentSize, setSegmentSize] = useState(50);
    const [segmentError, setSegmentError] = useState<string | null>(null);
    const [trajectoryColors, setTrajectoryColors] = useState(new Map<number, string>());
    const selectedTrajectoryRef = useRef(null);
    const selectedStateRef = useRef(null);
    const selectedCoordinateRef = useRef();
    const selectedClusterRef = useRef(null);
    


    // Extract props from activeLearningState
    const {
        viewMode = 'state_space',
        objectColorMode = 'step_reward',
        backgroundColorMode = 'none',
        embeddingSequenceLength = 1,
        currentRewardData = [],
        actionData = []
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

    // Effect to load thumbnail when episode is hovered or clicked
    useEffect(() => {
        const episodeToLoad = clickedEpisode || hoveredEpisode;
        if (episodeToLoad !== null) {
            // Find the matching episode in the loaded episodes list to get the correct ID format
            const matchingEpisode = appState.episodeIDsChronologically?.find(episode => 
                episode.benchmark_id === props.benchmarkId &&
                episode.checkpoint_step === props.checkpointStep &&
                episode.episode_num === episodeToLoad
            );
            
            if (matchingEpisode) {
                const episodeId = IDfromEpisode(matchingEpisode);
                getThumbnailURL(episodeId).then((url) => {
                    if (url !== undefined) {
                        setThumbnailUrl(url);
                    }
                });
            }
        } else {
            setThumbnailUrl(null);
        }
    }, [hoveredEpisode, clickedEpisode, getThumbnailURL, appState.episodeIDsChronologically, props.benchmarkId, props.checkpointStep]);



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
        setIsLoading(true);
        setError(null);
        
        // Clear segment selection
        setSelectedSegment(null);
        setSegmentError(null);
        
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

                // Set projectionStates to be used by GridUncertaintyMap
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
                drawChart(
                    viewMode,
                    data.projection,
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

        if (svgWidth < 0 || svgHeight < 0) return;

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
        const xExtent = d3.extent(processedData.map((d) => d[0]));
        const yExtent = d3.extent(processedData.map((d) => d[1]));

        // Add padding to the domains to show surrounding area
        const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% padding
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% padding

        const xDomain = [xExtent[0] - xPadding, xExtent[1] + xPadding];
        const yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];

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

                // Force initial draw if this is the first load
                if (context) {
                    const initialTransform = d3.zoomIdentity;
                    drawImageToCanvas(context, predictionCacheKey, initialTransform, svgWidth, svgHeight);
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
            // If we have grid data with bounds, use them
            if (bounds) {
                // Add some padding to the bounds to show surrounding area
                const xPadding = (bounds.x_max - bounds.x_min) * 0.1; // 10% padding
                const yPadding = (bounds.y_max - bounds.y_min) * 0.1; // 10% padding

                return {
                    x: xScale(bounds.x_min - xPadding),
                    y: yScale(bounds.y_max + yPadding), // Note: y axis is flipped
                    width: xScale(bounds.x_max + xPadding) - xScale(bounds.x_min - xPadding),
                    height: yScale(bounds.y_min - yPadding) - yScale(bounds.y_max + yPadding)
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

        // Apply previous transform to the view if exists
        if (prevTransform) {
            view.attr('transform', prevTransform);
        }

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

            // Find the closest point in the dataset to the clicked point
            const closest = quadTree.find(xClicked, yClicked, 0.01);

            if (closest) {
                // Find the correct episode index
                let episodeIdx = null;

                // Clear all other selections
                setSelectedCoordinate(null);
                selectedCoordinateRef.current = null;
                setSelectedCluster(null);
                selectedClusterRef.current = null;

                // Clear any existing coordinate marker
                view.selectAll('.coordinate-marker').remove();

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

                if (episodeIdx !== null) {
                    setSelectedTrajectory(episodeIdx);
                    selectedTrajectoryRef.current = episodeIdx;
                    
                    // Set clicked episode for thumbnail display
                    setClickedEpisode(episodeIdx);

                    // Force a redraw to show the highlighted trajectory
                    const currentTransform = d3.zoomTransform(view.node());
                    zoomed({ transform: currentTransform });
                }

                // also save selected point
                const selectedState = processedData[closest[2]];
                setSelectedState(selectedState);
                selectedStateRef.current = selectedState;
            } else {
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
        
        // Render segment overlays if segments exist
       /*if (segments.length > 0) {
            const segmentOverlays = view.append('g').attr('class', 'segment-overlays');
            
            segments.forEach((mergedSegment, index) => {
            
            const segmentGroup = segmentOverlays.append('g')
                .attr('class', 'segment-group')
                .attr('id', `segment-${mergedSegment.id}`);
            
            let pathData: string;
            if (mergedSegment.convexHull) {
                const hullPoints = mergedSegment.convexHull.map(p => [xScale(p[0]), yScale(p[1])]);
                pathData = `M${hullPoints.map(p => `${p[0]},${p[1]}`).join(' L')} Z`;
            }  else {
                // Fallback to simple rectangle
                const bbox = mergedSegment.boundingBox;
                const padding = 10;
                const x = xScale(bbox.minX) - padding;
                const y = yScale(bbox.maxY) - padding;
                const width = xScale(bbox.maxX) - xScale(bbox.minX) + 2 * padding;
                const height = yScale(bbox.minY) - yScale(bbox.maxY) + 2 * padding;
                pathData = `M${x},${y} L${x+width},${y} L${x+width},${y+height} L${x},${y+height} Z`;
            }
            
            // Create segment shape
            segmentGroup.append('path')
                .attr('class', 'segment-bbox')
                .attr('d', pathData)
                .attr('fill', 'rgba(255, 165, 0, 0.2)')
                .attr('stroke', 'rgba(255, 165, 0, 0.8)')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .style('cursor', 'pointer')
                .on('mouseover', function() {
                    d3.select(this)
                        .attr('fill', 'rgba(255, 165, 0, 0.3)')
                        .attr('stroke-width', 3);
                })
                .on('mouseout', function() {
                    const isSelected = selectedSegment?.id === mergedSegment.id;
                    d3.select(this)
                        .attr('fill', isSelected ? 'rgba(255, 165, 0, 0.4)' : 'rgba(255, 165, 0, 0.2)')
                        .attr('stroke-width', isSelected ? 3 : 2);
                })
                .on('click', function(event) {
                    event.stopPropagation();
                    
                    // Update selection
                    setSelectedSegment(mergedSegment);
                    
                    // Update visual state
                    segmentOverlays.selectAll('.segment-bbox')
                        .attr('fill', 'rgba(255, 165, 0, 0.2)')
                        .attr('stroke-width', 2);
                    
                    d3.select(this)
                        .attr('fill', 'rgba(255, 165, 0, 0.4)')
                        .attr('stroke-width', 3);
                });
            
                // Add segment label
                const centroid = mergedSegment.centroid;
                segmentGroup.append('text')
                    .attr('class', 'segment-label')
                    .attr('x', xScale(centroid[0]))
                    .attr('y', yScale(centroid[1]))
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.3em')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#FF8C00')
                    .attr('pointer-events', 'none')
                    .text(`S${index + 1} (${mergedSegment.segments.length})`);
            });
        }*/

        const text_labels_text = glyph_labels;

        const unique_labels = new Set(labels);

        // For each labeled cluster, draw a hull
        for (const label of unique_labels) {
            if (label === -1) continue;

            const label_g = view.append('g').attr('class', 'label-g');

            const cluster_indices = processedData
                .map((element, index) => {
                    if (labels[index] === label) {
                        return index;
                    }
                })
                .filter((element) => element !== undefined);

            const cluster_data = processedData.filter((_, i) => labels[i] === label);
            const clusterPoints = cluster_data.map((d) => [d[0], d[1]]);
            const hull = calculateSimpleConcaveHull(clusterPoints);

            if (!hull || hull.length < 3) continue;

            // Map hull points to screen coordinates
            const mappedHull = hull.map(p => [xScale(p[0]), yScale(p[1])]);

            // Add convex hull path
            label_g
                .append('path')
                .attr('class', "cluster_hull")
                .attr('d', 'M' + mappedHull.join('L') + 'Z')
                /*.attr('fill', () => {
                    const center = d3.polygonCentroid(mappedHull);
                    return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1]));
                })*/
                .attr('fill', 'none')
                .style('opacity', 0.8)
                .style('stroke', () => {
                    const center = d3.polygonCentroid(mappedHull);
                    return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1]));
                })
                .style('stroke-width', 2.5)
                .on('mouseover', function (event) {
                    d3.select(this).style('opacity', 0.6);
                })
                .on('mouseout', function (event) {
                    d3.select(this).style('opacity', 0.4);
                })
                .on('click', function (event) {
                    // Clear other selections
                    setSelectedTrajectory(null);
                    selectedTrajectoryRef.current = null;
                    setSelectedState(null);
                    selectedStateRef.current = null;
                    setSelectedCoordinate(null);
                    selectedCoordinateRef.current = null;

                    // Clear any existing coordinate marker
                    view.selectAll('.coordinate-marker').remove();

                    // Reset all cluster strokes first
                    /*d3.selectAll(".cluster_hull").style('stroke', function() {
                        const center = d3.polygonCentroid(d3.select(this).data()[0]);
                        return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1]));
                    });*/

                    // Highlight this cluster
                    d3.select(this).style('opacity', 0.7).style('stroke', "white");

                    // Get all indices belonging to this cluster
                    const clusterIndices = processedData
                        .map((element, index) => {
                            if (labels[index] === label) {
                                return index;
                            }
                        })
                        .filter((element) => element !== undefined);

                    // Store both the label and the indices
                    setSelectedCluster({ label: label, indices: clusterIndices });
                    selectedClusterRef.current = { label: label, indices: clusterIndices };
                });

            // Check if label in props.annotationSets, if so, use the label in props.annotated_sets
            const label_text = props.annotationSets && label in props.annotationSets ?
                props.annotationSets[label] :
                label;

            // Add center text label
            const center = d3.polygonCentroid(mappedHull);
            label_g
                .append('text')
                .attr('class', 'label')
                .attr('font-size', '20px')
                .attr('font-weight', 'bold')
                .attr('x', center[0])
                .attr('y', center[1])
                .attr('text-anchor', 'middle')
                .attr('fill', '#333333')
                .text(label_text);
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
                        
                        drawTrajectory(context, screenPoints, trajectoryColor, width);
                    });

                    // Batch draw points for better performance
                    //context.globalAlpha = 0.5;
                    context.beginPath();

                    const selectedStateIndex = selectedStateRef.current ? selectedStateRef.current[2] : null;

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

                    context.restore();
                }
            }


            if (selectedCoordinateRef.current?.x) {
                const crossSize = 10;
                const markerGroup = view.append("g")
                    .attr("class", "coordinate-marker");

                // Horizontal line
                markerGroup.append("line")
                    .attr("x1", xScale(selectedCoordinateRef.current.x) - crossSize)
                    .attr("y1", yScale(selectedCoordinateRef.current.y))
                    .attr("x2", xScale(selectedCoordinateRef.current.x) + crossSize)
                    .attr("y2", yScale(selectedCoordinateRef.current.y))
                    .style("stroke", "red")
                    .style("stroke-width", 2);

                // Vertical line
                markerGroup.append("line")
                    .attr("x1", xScale(selectedCoordinateRef.current.x))
                    .attr("y1", yScale(selectedCoordinateRef.current.y) - crossSize)
                    .attr("x2", xScale(selectedCoordinateRef.current.x))
                    .attr("y2", yScale(selectedCoordinateRef.current.y) + crossSize)
                    .style("stroke", "red")
                    .style("stroke-width", 2);
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

        svg.call(zoom);

        // Draw initial state with identity transform
        if (canvasImageCache.has(predictionCacheKey)) {
            const initialTransform = d3.zoomIdentity;
            drawImageToCanvas(context, predictionCacheKey, initialTransform, svgWidth, svgHeight);
        } else {
            // If image is not cached yet but we have the data, it will load asynchronously
            if (grid_prediction_image) {
                // Image will render when loaded
            }
        }

        return () => {
            // Cleanup on unmount
        };
    }, [props, activeLearningState.grid_prediction_image, selectedSegment]);

    return (
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
            <EmbeddingContainer ref={embeddingRef} />

            {/* Thumbnail overlay */}
            {thumbnailUrl && (clickedEpisode !== null || hoveredEpisode !== null) && (
                <ThumbnailOverlay
                    sx={{
                        borderColor: trajectoryColors.get((clickedEpisode || hoveredEpisode) || 0) || getFallbackColor((clickedEpisode || hoveredEpisode) || 0),
                        opacity: clickedEpisode !== null ? 1 : 0.8,
                    }}
                >
                    <CardMedia
                        component="img"
                        height="100%"
                        image={thumbnailUrl}
                        alt={`Episode ${clickedEpisode || hoveredEpisode} thumbnail`}
                        sx={{ objectFit: 'cover' }}
                    />
                    <Box
                        position="absolute"
                        top={8}
                        left={8}
                        bgcolor="rgba(0, 0, 0, 0.7)"
                        color="white"
                        px={1}
                        py={0.5}
                        borderRadius={1}
                        fontSize="12px"
                        fontWeight="bold"
                    >
                        Episode {clickedEpisode || hoveredEpisode}
                    </Box>
                </ThumbnailOverlay>
            )}

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
                            // Clear thumbnail display
                            setClickedEpisode(null);
                            setHoveredEpisode(null);
                        }}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Add to Selection">
                    <IconButton
                        color="default"
                        sx={{
                            backgroundColor: 'rgba(185, 185, 185, 0.7)',
                            '&:hover': { backgroundColor: 'rgba(185, 185, 185, 0.9)' }
                        }}
                        onClick={() => {
                            const selectedTrajectory = selectedTrajectoryRef.current;

                            const selectedCluster = selectedClusterRef.current;

                            const selectedCoordinate = selectedCoordinateRef.current;

                            // add to combined selected if selected
                            const combinedSelection = [];
                            if (selectedTrajectory) {
                                combinedSelection.push({ type: "trajectory", data: selectedTrajectory });
                            }
                            else if (selectedCluster) {
                                // Pass the cluster indices, not just the label
                                combinedSelection.push({ type: "cluster", data: selectedCluster.indices, label: selectedCluster.label });
                            }
                            else if (selectedCoordinate) {
                                combinedSelection.push({ type: "coordinate", data: selectedCoordinate });
                            }
                            if (combinedSelection.length === 0) {
                                return;
                            }

                            const selected = activeLearningState.selection;
                            const newSelection = [...selected, ...combinedSelection];
                            activeLearningDispatch({
                                type: 'SET_SELECTION',
                                payload: newSelection
                            });
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Mark to Correct/Generate">
                    <IconButton
                        color="default"
                        sx={{
                            backgroundColor: 'rgba(185, 185, 185, 0.7)',
                            '&:hover': { backgroundColor: 'rgba(185, 185, 185, 0.9)' }
                        }}
                        onClick={() => {
                            const selectedState = selectedStateRef.current;

                            // add to combined selected if selected
                            const combinedSelection = [];
                            if (selectedState) {
                                combinedSelection.push({ type: "state", data: selectedState });
                            }

                            if (combinedSelection.length === 0) {
                                return;
                            }

                            const selected = activeLearningState.selection;
                            const newSelection = [...selected, ...combinedSelection];
                            activeLearningDispatch({
                                type: 'SET_SELECTION',
                                payload: newSelection
                            });
                        }}
                    >
                        <CreateIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Load Data button and segment controls */}
            <Box
                position="absolute"
                top="10px"
                left="50px"
                sx={{ zIndex: 10, display: 'flex', gap: 2, alignItems: 'center' }}
            >
                <Button variant="contained" color="primary" onClick={loadData} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Load Data'}
                </Button>
                
                {/*<Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 1, borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ mr: 1 }}>Segment Size:</Typography>
                    <input 
                        type="number" 
                        value={segmentSize} 
                        onChange={(e) => setSegmentSize(Math.max(10, parseInt(e.target.value) || 50))}
                        style={{ width: '60px', padding: '2px' }}
                        min="10"
                        max="200"
                    />
                </Box>*/}
                
                
                {segmentError && (
                    <Box sx={{ backgroundColor: 'rgba(244, 67, 54, 0.9)', padding: 1, borderRadius: 1, color: 'white' }}>
                        <Typography variant="caption" fontWeight="bold">
                            Error: {segmentError}
                        </Typography>
                    </Box>
                )}
                
                {selectedSegment && (
                    <Box sx={{ backgroundColor: 'rgba(255, 165, 0, 0.9)', padding: 1, borderRadius: 1, color: 'white' }}>
                        <Typography variant="caption" fontWeight="bold">
                            Selected: {selectedSegment.segments.length} similar segments
                        </Typography>
                    </Box>
                )}
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
        </EmbeddingWrapper>
    );

};

export default StateSequenceProjection;