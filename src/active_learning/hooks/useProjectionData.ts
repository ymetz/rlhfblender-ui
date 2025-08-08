import { useCallback } from 'react';
import axios from 'axios';
import { useActiveLearningDispatch } from '../../ActiveLearningContext';
import { extractSegments, mergeSegments } from '../utils/segmentUtils';
import { canvasImageCache } from '../utils/canvasUtils';
import { ProjectionProps } from '../types/projectionTypes';

export function useProjectionData(
    props: ProjectionProps,
    embeddingSequenceLength: number,
    segmentSize: number,
    setIsLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    setSegmentError: (error: string | null) => void,
    setMinMaxScale: (scale: [number, number] | null) => void,
    drawChart: (mode: string, data: any[], labels: any[], actionData: any[], doneData: any[], episodeIndices: any[], labelInfos: any[], predictedRewards: any[], predictedUncertainties: any[], gridData: any, segments: any[]) => void
) {
    const activeLearningDispatch = useActiveLearningDispatch();

    const loadData = useCallback(() => {
        setIsLoading(true);
        setError(null);
        
        // Clear the shouldLoadNewData flag when loading starts
        activeLearningDispatch({
            type: 'SET_SHOULD_LOAD_NEW_DATA',
            payload: false
        });
        
        // Clear segment selection
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
                activeLearningDispatch({ type: 'SET_PROJECTION_STATES', payload: data.projection });
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

                const grid_prediction_image_path = grid_data.image || '';
                const grid_uncertainty_image_path = grid_uncertainty_data.image || '';

                // Create color scales based on grid bounds
                if (grid_data.projection_bounds) {
                    const bounds = grid_data.projection_bounds;
                    setMinMaxScale([bounds.min_val, bounds.max_val]);
                }

                // Process segments with the loaded data
                let processedSegments: any[] = [];
                if (data.projection && data.episode_indices) {
                    const episodeToPaths = new Map();
                    data.episode_indices.forEach((episodeIdx: any, i: any) => {
                        if (!episodeToPaths.has(episodeIdx)) {
                            episodeToPaths.set(episodeIdx, []);
                        }
                        if (i < data.projection.length) {
                            episodeToPaths.get(episodeIdx).push(data.projection[i]);
                        }
                    });
                    
                    // Trim last observation from each trajectory
                    episodeToPaths.forEach((pathPoints: any, episodeIdx: any) => {
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
                    'state_space',
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
    }, [
        props.embeddingMethod, props.reproject, props.appendTimestamp, props.benchmarkId, 
        props.checkpointStep, props.embeddingSettings, props.benchmarkedModels, props.infos, 
        props.timeStamp, embeddingSequenceLength, activeLearningDispatch, drawChart, segmentSize,
        setIsLoading, setError, setSegmentError, setMinMaxScale
    ]);

    return { loadData };
}