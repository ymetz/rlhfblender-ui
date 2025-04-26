import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    Tooltip,
    IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
//import RebaseEditIcon from '@mui/icons-material/RebaseEdit';
import CreateIcon from '@mui/icons-material/Create';
import { styled } from '@mui/material/styles';
import * as d3 from 'd3';
import axios from 'axios';
import { Color2D } from './projection_utils/2dcolormaps';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';

const canvasImageCache = new Map();

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


// Color Legend component 
const ColorLegend = ({ colorScale, width, title }) => {
    const legendRef = useRef(null);

    useEffect(() => {
        if (legendRef.current && colorScale) {
            d3.select(legendRef.current).select('*').remove();

            const margin = { top: 20, right: 20, bottom: 20, left: 20 };
            const height = 60 - margin.top - margin.bottom;

            const svg = d3.select(legendRef.current)
                .append('svg')
                .attr('width', width)
                .attr('height', 60)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Create gradient
            const defs = svg.append('defs');
            const linearGradient = defs.append('linearGradient')
                .attr('id', `linear-gradient-${title.replace(/\s+/g, '-').toLowerCase()}`)
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '0%');

            // Set the color for the start (0%)
            linearGradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', colorScale(0));

            // Set the color for the end (100%)
            linearGradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', colorScale(1));

            // Draw the rectangle and fill with gradient
            svg.append('rect')
                .attr('width', width - margin.left - margin.right)
                .attr('height', height)
                .style('fill', `url(#linear-gradient-${title.replace(/\s+/g, '-').toLowerCase()})`);

            // Create axis
            const x = d3.scaleLinear()
                .domain(colorScale.domain())
                .range([0, width - margin.left - margin.right]);

            const xAxis = d3.axisBottom(x)
                .ticks(5);

            svg.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(xAxis);
        }
    }, [colorScale, width, title]);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">{title}</Typography>
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

// Legend positioned on the left side
const BackgroundLegend = styled(LegendContainer)(({ theme }) => ({
    left: theme.spacing(2),
}));

// Legend positioned on the right side
const ObjectLegend = styled(LegendContainer)(({ theme }) => ({
    right: theme.spacing(2),
}));

const WebGLProjection = (props) => {
    // Get state and dispatch from context
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();

    // Refs
    const embeddingRef = useRef(null);
    const backgroundColorLegendRef = useRef(null);
    const objectColorLegendRef = useRef(null);

    // Component state variables
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedTrajectory, setSelectedTrajectory] = useState(null);
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCoordinate, setSelectedCoordinate] = useState({ x: null, y: null });
    const [selectedCluster, setSelectedCluster] = useState(null);
    const selectedTrajectoryRef = useRef(null);
    const selectedStateRef = useRef(null);
    const selectedCoordinateRef = useRef();
    const selectedClusterRef = useRef(null);

    // Extract props from activeLearningState
    const {
        viewMode = 'state_space',
        highlightedPoints = [],
        selectedPoints = [],
        objectColorMode = 'step_reward',
        backgroundColorMode = 'none',
        embeddingSequenceLength = 1,
        lastDataUpdateTimestamp = 0,
        currentRewardData = [],
        actionData = []
    } = activeLearningState;

    // Initialize chart on mount
    useEffect(() => {
        drawChart(viewMode || 'state_space', []);
    }, [viewMode]);


    // React to selection changes
    useEffect(() => {
        if (props.selectionTimestamp !== props.prevSelectionTimestamp) {
            updateChartColors(props.highlightSteps, props.visibleEpisodes);
        }
    }, [props.selectionTimestamp]);

    useEffect(() => {
        selectedTrajectoryRef.current = selectedTrajectory;
    }, [selectedTrajectory]);

    useEffect(() => {
        selectedStateRef.current = selectedState
    }, [selectedState]);

    useEffect(() => {
        selectedCoordinateRef.current = selectedCoordinate
    }, [selectedCoordinate]);

    // Drawing function dispatches to specific visualizations
    const drawChart = useCallback((
        mode = 'state_space',
        data = [],
        labels = [],
        merged_points = [],
        connections = [],
        feature_embeddings = [],
        transition_embeddings = [],
        actionData = [],
        doneData = [],
        episodeIndices = [],
        labelInfos = [],
        gridData = {
            prediction_image: null,
            uncertainty_image: null,
            bounds: null,
        },
    ) => {

        switch (mode) {
            case 'state_space':
                drawStateSpace(data, labels, doneData, labelInfos, episodeIndices, gridData);
                break;
            default:
                drawStateSpace(data, labels, doneData, labelInfos, episodeIndices, gridData);
        }
    }, []);

    // Load data from API
    const loadData = useCallback(() => {
        setIsLoading(true);
        setError(null);

        const embedding_method = props.embeddingMethod;
        const use_one_d_embedding = 0;
        const reproject = props.reproject ? 1 : 0;
        const append_time = props.appendTimestamp ? 1 : 0;

        const url = '/projection/generate_projection';
        const grid_projection_url = '/projection/load_grid_projection_image';

        const params = {
            benchmark_id: props.benchmarkId,
            checkpoint_step: 160000,
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

        // call load_grid_projection_image a second time for uncertainty, replace map type in the querying string
        const uncertainty_grid_projection_params = {
            ...params,
            map_type: 'uncertainty',
        };

        const uncertainty_grid_projection_queryString = Object.entries(uncertainty_grid_projection_params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        // Use Promise.all to wait for both API calls to complete
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

                console.log("Grid data received:", {
                    prediction: grid_data.image ? grid_data.image.substring(0, 50) + "..." : "null",
                    uncertainty: grid_uncertainty_data.image ? grid_uncertainty_data.image.substring(0, 50) + "..." : "null"
                });

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

                // Update global state - grid data
                // activeLearningDispatch({ type: 'SET_GRID_COORDINATES', payload: grid_coordinates });
                // activeLearningDispatch({ type: 'SET_GRID_PREDICTIONS', payload: grid_predictions });
                // activeLearningDispatch({ type: 'SET_GRID_UNCERTAINTIES', payload: grid_uncertainties });

                const grid_prediction_image_path = grid_data.image || '';
                const grid_uncertainty_image_path = grid_uncertainty_data.image || '';

                // Now that we have all data, draw the chart with the grid data included
                drawChart(
                    viewMode,
                    data.projection,
                    data.labels,
                    data.merged_points,
                    data.connections,
                    data.feature_projection,
                    data.transition_projection,
                    data.actions,
                    data.dones,
                    data.episode_indices,
                    [],
                    { // Pass grid data directly as an object
                        "prediction_image": grid_prediction_image_path,
                        "uncertainty_image": grid_uncertainty_image_path,
                        "bounds": grid_data.projection_bounds
                    },
                );

                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error loading data:", err);
                setError("Failed to load data. Please try again.");
                setIsLoading(false);
            });
    }, [embeddingSequenceLength, viewMode, props.benchmarkId, props.embeddingMethod, props.reproject, props.appendTimestamp, props.benchmarkedModels, props.embeddingSettings, props.timeStamp, props.infos, drawChart, activeLearningDispatch]);

    const drawStateSpace = useCallback((data = [], labels = [], doneData = [], labelInfos = [], episodeIndices = [], gridData = { prediction_image: null, uncertainty_image: null, bounds: null }) => {

        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const done_idx = doneData.reduce((a, elem, i) => (elem === true && a.push(i), a), []);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        d3.select(embeddingRef.current).selectAll('*').remove();

        const svgHeight = embeddingRef.current.parentElement.clientHeight;
        const svgWidth = embeddingRef.current.parentElement.clientWidth;

        if (svgWidth < 0 || svgHeight < 0) return;

        // Handle 1D embeddings by adding time dimension
        let processedData = [...data];
        if (data?.length > 0 && data[0].length === 1) {
            processedData = processedData.map((k, i) => [
                props.infos?.[i]?.['episode step'] || 0,
                ...k,
            ]);
        }

        processedData = processedData.map((k, i) => [...k, episodeIndices[i] || 0]);

        // Filter data to only include visible models if needed
        if (props.showModels && props.infos) {
            processedData = processedData.filter((k, i) =>
                props.showModels[props.infos[i]['model_index']]
            );
        }

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

        // Preload and cache grid images with their bounds
        if (grid_prediction_image && !canvasImageCache.has('prediction')) {
            console.log('Preloading grid prediction image');
            const img = new Image();
            img.onload = () => {
                console.log('Grid prediction image loaded successfully:', img.width, 'x', img.height);
                // Store image with metadata
                canvasImageCache.set('prediction', {
                    image: img,
                    bounds: gridData.bounds
                });

                // Force initial draw if this is the first load
                if (context) {
                    const initialTransform = d3.zoomIdentity;
                    drawImageToCanvas(context, 'prediction', initialTransform, svgWidth, svgHeight);
                }
            };

            img.onerror = (e) => {
                console.error('Failed to load grid prediction image:', e);
            };

            img.src = `data:image/png;base64,${grid_prediction_image}`;
        }

        // Similarly for uncertainty image
        if (gridData.uncertainty_image && !canvasImageCache.has('uncertainty')) {
            console.log('Preloading grid uncertainty image');
            const img = new Image();
            img.onload = () => {
                console.log('Grid uncertainty image loaded successfully:', img.width, 'x', img.height);
                canvasImageCache.set('uncertainty', {
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
            ctx.globalAlpha = 0.7; // Slightly transparent so we can see points on top
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
            }
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

                // Clear the references
                setSelectedCoordinate(null);
                selectedCoordinateRef.current = null;

                setSelectedCluster(null);
                selectedClusterRef.current = null;
                // d3.selectAll(".cluster_hull").style("stroke", "none");

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

                    // Force a redraw to show the highlighted trajectory
                    const currentTransform = d3.zoomTransform(view.node());
                    zoomed({ transform: currentTransform });
                }

                // also save selected point
                const selectedState = processedData[closest[2]];
                setSelectedState(selectedState);
                selectedStateRef.current = selectedState;
            } else {

                // clear the other refs
                setSelectedTrajectory(null);
                selectedTrajectoryRef.current = null;

                setSelectedState(null);
                selectedStateRef.current = null;

                // in case we click in an empty region, just save the coordinate
                setSelectedCoordinate({ x: xClicked, y: yClicked });
                selectedCoordinateRef.current = { x: xClicked, y: yClicked };

                // draw an svg maeker at the position
                view.append("circle").attr("cx", xScale(xClicked)).attr("cy", yScale(yClicked)).attr("r", "5px").style('fill', 'red');

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
            if (!label_data_map.has(done_idx[i])) {
                label_data_map.set(done_idx[i], ['Done']);
            } else {
                label_data_map.get(done_idx[i]).push('Done');
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

        // Create text labels
        const text_labels = view
            .selectAll('label-g')
            .data(processedData.map((d, i) => [d[0], d[1], i]).filter((d) => label_data_map.has(d[2])))
            .enter()
            .append('g')
            .attr('class', 'label-g')
            .attr('id', (d) => 'label-g_' + d[2]);

        // Add text labels
        const text_labels_text = text_labels
            .append('text')
            .attr('class', 'label')
            .attr('x', (d) => xScale(d[0]) + 10)
            .attr('y', (d) => yScale(d[1]) + 10)
            .attr('text-anchor', 'center')
            .attr('fill', '#333333')
            .attr('font-size', '12px')
            .text((d) => label_data_map.get(d[2]).join('/'));

        // Add connector lines for labels
        const text_labels_lines = text_labels
            .append('line')
            .attr('class', 'label-line')
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('x1', (d) => xScale(d[0]))
            .attr('y1', (d) => yScale(d[1]))
            .attr('x2', (d) => xScale(d[0]) + 10)
            .attr('y2', (d) => yScale(d[1]) + 10)
            .attr('stroke', '#a1a1a1')
            .attr('stroke-width', '1px');

        // Grid data is handled by the preloading section above
        // No need to render it here as it's handled by the zoom function

        // Handle annotations based on mode
        if (true) {
            const unique_labels = new Set(labels);

            // For each labeled cluster, draw a convex hull
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
                const hull = d3.polygonHull(cluster_data.map((d) => [d[0], d[1]]));

                if (!hull) continue;

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
                        d3.selectAll(".cluster_hull").style('stroke', "none");
                        d3.select(this).style('opacity', 0.7).style('stroke', "white");

                        setSelectedCluster(label);
                        selectedClusterRef.current = label;


                        // Open text edit field to change label
                        /*const new_label = prompt('Please enter a new label', '');
                        if (new_label !== null && props.annotateState) {
                            // Update label
                            this_label_text.text(new_label);
                            props.annotateState(cluster_indices, new_label, label);
                        }*/
                    });

                // Check if label in props.annotationSets, if so, use the label in props.annotated_sets
                const label_text = props.annotationSets && label in props.annotationSets ?
                    props.annotationSets[label] :
                    label;

                // Add center text label
                const center = d3.polygonCentroid(mappedHull);
                const this_label_text = label_g
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
        }

        // Zoom handler function
        function zoomed(event) {
            const transform = event.transform;
            view.attr('transform', transform);

            const currentHighlightedTrajectory = selectedTrajectoryRef.current;

            //const isZoomEnd = event.sourceEvent &&
            //    (event.sourceEvent.type === 'mouseup' || event.sourceEvent.type === 'touchend');
            const isZoomEnd = true;

            // First, draw the grid image to the canvas with proper transformation
            if (context) {
                // Draw the appropriate image based on visualization mode
                const imageKey = 'prediction'; // or 'uncertainty' based on UI state
                drawImageToCanvas(context, imageKey, transform, svgWidth, svgHeight);

                // Draw additional items on top if needed
                if (isZoomEnd) {
                    const r = Math.round((5 / transform.k) * 100) / 100;
                    const width = Math.round((1 / transform.k) * 100) / 100;

                    // Save current context
                    context.save();

                    // Apply the same transformation as the background image
                    context.translate(transform.x, transform.y);
                    context.scale(transform.k, transform.k);

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

                    // Draw paths with efficient batching
                    episodeToPaths.forEach((pathPoints, episodeIdx) => {
                        if (pathPoints.length === 0) return;

                        // Highlight the selected trajectory
                        const isHighlighted = currentHighlightedTrajectory === episodeIdx;

                        if (!isHighlighted)
                            return;

                        // Set path styling
                        context.strokeStyle = d3.interpolateCool(episodeIdx / episodeToPaths.size);
                        context.lineWidth = isHighlighted ? width * 3 : width;
                        context.globalAlpha = isHighlighted ? 0.9 : 0.5;

                        // Draw the path
                        context.beginPath();
                        context.moveTo(xScale(pathPoints[0][0]), yScale(pathPoints[0][1]));

                        for (let j = 1; j < pathPoints.length; j++) {
                            // Don't draw lines between distant points
                            /*if (Math.hypot(pathPoints[j][0] - pathPoints[j - 1][0], pathPoints[j][1] - pathPoints[j - 1][1]) > 0.3) {
                                context.moveTo(xScale(pathPoints[j][0]), yScale(pathPoints[j][1]));
                            } else {
                                context.lineTo(xScale(pathPoints[j][0]), yScale(pathPoints[j][1]));
                            }*/
                            context.lineTo(xScale(pathPoints[j][0]), yScale(pathPoints[j][1]));
                        }

                        context.stroke();
                    });

                    // Batch draw points for better performance
                    context.globalAlpha = 0.5;
                    context.beginPath();

                    const selectedStateIndex = selectedStateRef.current ? selectedStateRef.current[2] : null;

                    for (const [x, y, i] of processedData.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {

                        // Check if point is part of highlighted trajectory
                        const pointEpisodeIdx = episodeIndices[i] || 0;
                        const isHighlighted = currentHighlightedTrajectory === pointEpisodeIdx;
                        const fillStyle = d3.interpolateCool(pointEpisodeIdx / episodeToPaths.size);

                        // Draw rectangle for highlighted points
                        if (selectedStateIndex && selectedStateIndex === i) {
                            context.rect(x - r, y - r, 5 * r, 5 * r);
                        } else {
                            // Create a new path for each point to allow different colors
                            context.beginPath();
                            context.arc(x, y, isHighlighted ? r * 1.5 : r, 0, 2 * Math.PI);
                            context.fillStyle = fillStyle;
                            context.fill();
                            context.closePath();
                        }
                    }

                    context.restore();
                }
            }


            if (selectedCoordinateRef.current?.x) {
                view
                    .append("circle")
                    .attr("cx", xScale(selectedCoordinateRef.current.x))
                    .attr("cy", yScale(selectedCoordinateRef.current.y))
                    .attr("r", "5px")
                    .style('fill', 'red');
            }

            // Update SVG elements visibility based on zoom level
            if (transform.k > 2) {
                text_labels.attr('display', 'inline');
            } else {
                text_labels.attr('display', 'none');
            }

            // Update text size
            text_labels_text.attr('font-size', 16 / transform.k);
        }

        svg.call(zoom);

        // Draw initial state with identity transform
        if (canvasImageCache.has('prediction')) {
            const initialTransform = d3.zoomIdentity;
            drawImageToCanvas(context, 'prediction', initialTransform, svgWidth, svgHeight);
        } else {
            // If image is not cached yet but we have the data, trigger a redraw when the image loads
            if (grid_prediction_image) {
                console.log('Waiting for image to load before initial render');
            }
        }

        // Add cleanup for component unmount
        return () => {
            // Reset any resources that need cleanup
        };
    }, [props, activeLearningState.grid_prediction_image]);

    // If there's an error, display it
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <EmbeddingWrapper>
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
                            backgroundColor: 'rgba(128, 128, 128, 0.7)',
                            '&:hover': { backgroundColor: 'rgba(128, 128, 128, 0.9)' }
                        }}
                        onClick={() => {
                            activeLearningDispatch({
                                type: 'SET_SELECTION',
                                payload: []
                            });
                        }}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Add to Selection">
                    <IconButton
                        color="default"
                        sx={{
                            backgroundColor: 'rgba(128, 128, 128, 0.7)',
                            '&:hover': { backgroundColor: 'rgba(128, 128, 128, 0.9)' }
                        }}
                        onClick={() => {
                            const selectedTrajectory = selectedTrajectoryRef.current;

                            const selectedCluster = selectedClusterRef.current;

                            // add to combined selected if selected
                            const combinedSelection: { type: string, data: any }[] = [];
                            if (selectedTrajectory) {
                                combinedSelection.push({ type: "trajectory", data: selectedTrajectory });
                            }
                            else if (selectedCluster) {
                                combinedSelection.push({ type: "cluster", data: selectedCluster });
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
                            backgroundColor: 'rgba(128, 128, 128, 0.7)',
                            '&:hover': { backgroundColor: 'rgba(128, 128, 128, 0.9)' }
                        }}
                        onClick={() => {
                            const selectedState = selectedStateRef.current;

                            const selectedCoordinate = selectedCoordinateRef.current;

                            // add to combined selected if selected
                            const combinedSelection: { type: string, data: any }[] = [];
                            if (selectedState) {
                                combinedSelection.push({ type: "state", data: selectedState });
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
                        <CreateIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Button to load data, should be on top left corner*/}
            <Box
                position="absolute"
                top="10px"
                left="50px"
                sx={{ transform: 'translate(-50%, -50%)', zIndex: 10, visible: isLoading ? 'hidden' : 'visible' }}

            >
                <Button variant="contained" color="primary" onClick={loadData}>
                    Load Data
                </Button>
            </Box>

            {/* Legend for background color */}
            <BackgroundLegend>
                <Typography variant="caption" fontWeight="bold">
                    Background: {backgroundColorMode}
                </Typography>
                <Box ref={backgroundColorLegendRef} />
            </BackgroundLegend>

            {/* Legend for object color */}
            <ObjectLegend>
                <Typography variant="caption" fontWeight="bold">
                    Objects: {objectColorMode}
                </Typography>
                <Box ref={objectColorLegendRef} />
            </ObjectLegend>
        </EmbeddingWrapper>
    );

};

export default WebGLProjection;