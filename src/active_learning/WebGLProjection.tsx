import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
    Button,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Box,
    ToggleButtonGroup,
    ToggleButton,
    Paper,
    Typography,
    CircularProgress,
    Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '@mui/material/styles';
import * as d3 from 'd3';
import axios from 'axios';
import { arc } from 'd3-shape';
import createScatterplot from 'regl-scatterplot';
import { Color2D } from './projection_utils/2dcolormaps';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { legend } from './projection_utils/Color_Legend';

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

const ControlsWrapper = styled(Box)(({ theme }) => ({
    width: 'max(15%, 300px)',
    position: 'absolute',
    right: theme.spacing(2),
    top: theme.spacing(2),
    zIndex: 10,
}));

const ControlOverlay = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
}));

const ViewBoxContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
}));

const ViewBox = styled(Box)(({ theme, selected }) => ({
    width: '100px',
    height: '100px',
    margin: theme.spacing(1),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: selected ? `5px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    transition: theme.transitions.create(['border'], {
        duration: theme.transitions.duration.short,
    }),
}));

// Improved circle generator function
const circleGenerator = (cx = 0, cy = 0, r = 5) => {
    const circlePath = arc()
        .innerRadius(r)
        .outerRadius(r)
        .startAngle(0)
        .endAngle(Math.PI * 2)();

    // Transform to the correct position if cx/cy aren't 0
    return cx || cy ? `translate(${cx}, ${cy}) ${circlePath}` : circlePath;
};

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
    const [annotationMode, setAnnotationMode] = useState('analyze');
    // Get state and dispatch from context
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();

    // Refs
    const embeddingRef = useRef(null);
    const backgroundColorLegendRef = useRef(null);
    const objectColorLegendRef = useRef(null);

    // Component state variables
    const [canvas, setCanvas] = useState(null);
    const [svg, setSvg] = useState<SVGSVGElement | null>(null);
    const [scatterplot, setScatterplot] = useState<any>(null);
    const [lasso, setLasso] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastIndex, setLastIndex] = useState(0);

    // Local UI state
    const [uiState, setUiState] = useState({
        object_layer_colors: [],
        background_layer_colors: [],
        object_color_scale: undefined,
        object_color_d3_scale: undefined,
        background_color_scale: undefined,
        background_color_d3_scale: undefined,
        draw_lasso: false,
        step_images: ['/files/base.jpeg', '/files/traj.jpeg', '/files/latent.jpeg', '/files/transitions.jpeg'],
        x: undefined,
        y: undefined,
        k: 1.0,
    });

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

    // React to color mode changes
    useEffect(() => {
        // Calculate color scales
        const objColorData = getColorsForObjects();
        const bgColorData = getColorsForBackground();

        setUiState(prev => ({
            ...prev,
            object_layer_colors: objColorData.colors,
            background_layer_colors: bgColorData.colors,
            object_color_scale: objColorData.scale,
            object_color_d3_scale: objColorData.d3_scale,
            background_color_scale: bgColorData.scale,
            background_color_d3_scale: bgColorData.d3_scale,
        }));

        updateColorLegend();
    }, [objectColorMode, backgroundColorMode, currentRewardData]);

    // Function to calculate a hash from options
    const computeHashFromOptions = useCallback((
        scheduled_benchmarks,
        embedding_method,
        use_one_d_embedding,
        reproject,
        append_time,
        embedding_settings
    ) => {
        // Create unique non-secure hash from options without the crypto library
        // This is used to cache the embeddings
        const hash =
            JSON.stringify(scheduled_benchmarks) +
            embedding_method +
            use_one_d_embedding +
            reproject +
            append_time +
            JSON.stringify(embedding_settings);
        let hashValue = 0;
        for (let i = 0; i < hash.length; i++) {
            hashValue += hash.charCodeAt(i);
        }
        return hashValue;
    }, []);

    // Function to get color data based on mode
    const getColorData = useCallback((mode) => {
        if (mode === 'none') {
            const color_scale = d3
                .scaleLinear()
                .domain(d3.extent(currentRewardData))
                .range(['grey', 'grey']);
            return {
                data: currentRewardData,
                colors: currentRewardData.map(c => 'grey'),
                scale: color_scale,
            };
        }

        if (mode === 'step_reward') {
            if (currentRewardData.length > 0) {
                const data = props.currentRewardData || currentRewardData;
                // Quantize the reward data into 100 buckets
                const quantize = d3.scaleQuantize().domain(d3.extent(data)).range(d3.range(100));

                // Get the color as a 100 element array for the quantized reward data with d3.interpolateOrRd(t * 0.85 + 0.15)
                const color_scale = d3.scaleSequential((t) => d3.interpolateOrRd(t * 0.85 + 0.15)).domain([0, 100]);
                const colors_array = Array.from({ length: 100 }, (_, i) => d3.color(color_scale(i)));

                return {
                    data: data,
                    colors: data.map((c) => quantize(c)),
                    scale: colors_array.map((d) => [d.r, d.g, d.b, 200]),
                    d3_scale: color_scale,
                };
            } else {
                return {
                    data: [],
                    colors: ['ffffff'],
                    scale: uiState.object_color_scale,
                    d3_scale: uiState.object_color_d3_scale,
                };
            }
        }
        const data = props.infos ? props.infos.map((i) => i[mode]) : [];
        let interpolator = function (t) {
            return d3.interpolateOrRd(t * 0.85 + 0.15);
        };
        if (mode === 'action') {
            const color_scale = d3.scaleOrdinal(d3.schemeSet3).domain(d3.extent(data));
            const colors_array = Array.from({ length: d3.max(data) || 1 }, (_, i) => d3.color(color_scale(i)));
            return {
                data: data,
                colors: data,
                scale: colors_array.map((d) => [d.r, d.g, d.b, 200]),
                d3_scale: color_scale,
            };
        } else if (mode === 'episode index') {
            interpolator = d3.interpolateCool;
        }

        const quantize = d3.scaleQuantize().domain(d3.extent(data)).range(d3.range(100));
        const color_scale = d3.scaleSequential(interpolator).domain([0, 100]);
        const colors_array = Array.from({ length: 100 }, (_, i) => d3.color(color_scale(i)));

        return {
            data: data,
            colors: data.map((c) => quantize(c)),
            scale: colors_array.map((d) => [d.r, d.g, d.b, 200]),
            d3_scale: color_scale,
        };
    }, [currentRewardData, props.currentRewardData, props.infos, uiState.object_color_scale, uiState.object_color_d3_scale]);

    // Function to get colors for objects
    const getColorsForObjects = useCallback(() => {
        return getColorData(objectColorMode);
    }, [getColorData, objectColorMode]);

    // Function to get colors for background
    const getColorsForBackground = useCallback(() => {
        return getColorData(backgroundColorMode);
    }, [getColorData, backgroundColorMode]);

    // Update color legend
    const updateColorLegend = useCallback(() => {
        if (uiState.object_color_d3_scale === undefined || !objectColorLegendRef.current) return;
        d3.select(objectColorLegendRef.current).select('*').remove();

        if (objectColorLegendRef.current && objectColorLegendRef.current.parentElement) {
            d3.select(objectColorLegendRef.current)
                .node()
                .appendChild(
                    legend({
                        color: uiState.object_color_d3_scale,
                        width: objectColorLegendRef.current.parentElement.clientWidth,
                    })
                );
        }

        if (uiState.background_color_d3_scale === undefined || !backgroundColorLegendRef.current) return;
        d3.select(backgroundColorLegendRef.current).select('*').remove();

        if (backgroundColorLegendRef.current && backgroundColorLegendRef.current.parentElement) {
            d3.select(backgroundColorLegendRef.current)
                .node()
                .appendChild(
                    legend({
                        color: uiState.background_color_d3_scale,
                        width: backgroundColorLegendRef.current.parentElement.clientWidth,
                    })
                );
        }
    }, [uiState.object_color_d3_scale, uiState.background_color_d3_scale]);

    // Split array
    const splitArray = useCallback((arr, indices) => {
        var result = [];
        var lastIndex = 0;
        for (var i = 0; i < indices.length; i++) {
            // Note that the last observations of an episode is already from the next episode (i.e. the one give the done flag, so omit drawing the path)
            result.push(arr.slice(lastIndex, indices[i] + 1));
            lastIndex = indices[i] + 1;
        }
        result.push(arr.slice(Math.min(lastIndex, arr.length - 1)));
        return result;
    }, []);

    // Get random color
    const getRandomColor = useCallback(() => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }, []);

    // Polar to Cartesian
    const polarToCartesian = useCallback((centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians),
        };
    }, []);

    // Update chart colors
    const updateChartColors = useCallback((highlightSteps, visibleEpisodes) => {
        updateColorLegend();
        if (!highlightSteps || !scatterplot) return;

        const currentStep = highlightSteps.new?.value;
        if (lastDataUpdateTimestamp === 0 || currentStep === undefined) return;

        scatterplot.select([currentStep], { preventEvent: true });
    }, [updateColorLegend, lastDataUpdateTimestamp, scatterplot]);

    // Toggle lasso
    const toggleLasso = useCallback(() => {
        if (uiState.draw_lasso) {
            d3.select(embeddingRef.current).select('svg').remove('lasso');
        } else if (lasso !== null) {
            d3.select(embeddingRef.current).select('svg').call(lasso);
        }
        setUiState(prev => ({ ...prev, draw_lasso: !prev.draw_lasso }));
    }, [uiState.draw_lasso, lasso]);


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
        labelInfos = [],
        annotationMode = 'analyze'
    ) => {

        switch (mode) {
            case 'state_space':
                drawStateSpace(data, labels, doneData, labelInfos, annotationMode);
                break;
            case 'decision_points':
                drawDecisionPoints(data, merged_points, connections);
                break;
            case 'activation_mapping':
                drawActivationMapping(data, feature_embeddings, doneData);
                break;
            case 'transition_embedding':
                drawTransitionEmbedding(transition_embeddings, actionData, data, annotationMode);
                break;
            default:
                drawStateSpace(data, labels, doneData, labelInfos, annotationMode);
        }
    }, []);

    // Load data from API
    const loadData = useCallback(() => {
        setIsLoading(true);
        setError(null);

        const embedding_method = props.embeddingMethod;
        const use_one_d_embedding = props.embeddingAxisOption !== '2D embedding' ? 1 : 0;
        const reproject = props.reproject ? 1 : 0;
        const append_time = props.appendTimestamp ? 1 : 0;

        console.log("PROPS", props);

        const url = '/projection/generate_projection';
        const params = {
            env_name: props.environment,
            benchmark_type: "random",
            benchmark_id: props.benchmarkId,
            checkpoint_step: -1,
            projection_method: embedding_method,
            sequence_length: embeddingSequenceLength,
            step_range: '[]',
            reproject: reproject,
            use_one_d_projection: use_one_d_embedding,
            append_time: append_time,
            projection_props: props.embeddingSettings,
            projection_hash: computeHashFromOptions(
                props.benchmarkedModels,
                embedding_method,
                use_one_d_embedding,
                reproject,
                append_time,
                props.embeddingSettings
            ),
        };

        // Convert params to query string
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        axios.post(`${url}?${queryString}`, {
            benchmarks: props.benchmarkedModels,
            embedding_props: props.embeddingSettings
        })
            .then(res => {
                const data = res.data;
                const objColorData = getColorsForObjects();
                const bgColorData = getColorsForBackground();
                const selected_points = props.infos ? props.infos.map(i => i['selected']) : [];
                const highlighted_points = props.infos ? props.infos.map(i => i['highlighted']) : [];

                // Update global state
                activeLearningDispatch({ type: 'SET_EMBEDDING_DATA', payload: data.embedding });
                activeLearningDispatch({ type: 'SET_EMBEDDING_LABELS', payload: data.labels });
                activeLearningDispatch({ type: 'SET_CLUSTER_CENTROIDS', payload: data.centroids });
                activeLearningDispatch({ type: 'SET_MERGED_POINTS', payload: data.merged_points });
                activeLearningDispatch({ type: 'SET_POINT_CONNECTIONS', payload: data.connections });
                activeLearningDispatch({ type: 'SET_FEATURE_EMBEDDINGS', payload: data.feature_embedding });
                activeLearningDispatch({ type: 'SET_TRANSITION_EMBEDDINGS', payload: data.transition_embedding });
                activeLearningDispatch({ type: 'SET_LAST_DATA_UPDATE_TIMESTAMP', payload: props.timeStamp });
                activeLearningDispatch({ type: 'SET_SELECTED_POINTS', payload: selected_points });
                activeLearningDispatch({ type: 'SET_HIGHLIGHTED_POINTS', payload: highlighted_points });

                // Update local UI state
                setUiState(prev => ({
                    ...prev,
                    object_layer_colors: objColorData.colors,
                    background_layer_colors: bgColorData.colors,
                    object_color_scale: objColorData.scale,
                    object_color_d3_scale: objColorData.d3_scale,
                    background_color_scale: bgColorData.scale,
                    background_color_d3_scale: bgColorData.d3_scale,
                }));

                drawChart(
                    viewMode,
                    data.embedding,
                    data.labels,
                    data.merged_points,
                    data.connections,
                    data.feature_embedding,
                    data.transition_embedding,
                    actionData,
                    props.currentDoneData,
                    props.labelInfo,
                    annotationMode
                );

                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error loading embedding data:", err);
                setError("Failed to load embedding data. Please try again.");
                setIsLoading(false);
            });
    }, [
        embeddingSequenceLength,
        viewMode,
        annotationMode,
        actionData,
        props.embeddingMethod,
        props.embeddingAxisOption,
        props.reproject,
        props.appendTimestamp,
        props.benchmarkedModels,
        props.embeddingSettings,
        props.selectedCheckpoint,
        props.timeStamp,
        props.infos,
        props.currentDoneData,
        props.labelInfo,
        computeHashFromOptions,
        getColorsForObjects,
        getColorsForBackground,
        drawChart,
        activeLearningDispatch
    ]);

    const drawStateSpace = useCallback((data = [], labels = [], doneData = [], labelInfos = [], annotationMode = 'analyze') => {
        setLastIndex(data.length - 1);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        const margin = { top: 100, right: 20, bottom: 20, left: 20 };
        const done_idx = doneData.reduce((a, elem, i) => (elem === true && a.push(i), a), []);
        const svgHeight = embeddingRef.current.parentElement.clientHeight - margin.top - margin.bottom;
        const svgWidth = embeddingRef.current.parentElement.clientWidth - margin.left - margin.right;

        if (svgWidth < 0 || svgHeight < 0) return;

        // Handle 1D embeddings by adding time dimension
        let processedData = [...data];
        if (data.length > 0 && data[0].length === 1) {
            processedData = data.map((k, i) => [
                props.infos?.[i]?.['episode step'] || 0,
                ...k
            ]);
        }

        // Filter data to only include visible models
        if (props.showModels && props.infos) {
            processedData = processedData.filter((k, i) =>
                props.showModels[props.infos[i]['model_index']]
            );
        }

        // Set up scales
        const xScale = d3.scaleLinear().domain([-1, 1]).range([0, svgWidth]); // Add range!
        const yScale = d3.scaleLinear().domain([-1, 1]).range([svgHeight, 0]); // Add range!

        // Clean up existing scatterplot if needed
        if (scatterplot) {
            try {
                scatterplot.destroy();
            } catch (e) {
                console.error("Error destroying scatterplot:", e);
            }
        }

        // Initialize or clear visualization elements
        const container = d3.select(embeddingRef.current);
        container.style('position', 'relative');

        // Clear any existing elements
        container.selectAll('*').remove();

        // Create canvas for scatterplot
        const newCanvas = container.append('canvas').node();

        // Set explicit dimensions on the canvas
        if (newCanvas) {
            newCanvas.width = svgWidth;
            newCanvas.height = svgHeight;
        }

        setCanvas(newCanvas);

        // Create SVG overlay for annotations
        const newSvg = container
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('pointer-events', 'none')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        setSvg(newSvg);

        // Wait until next frame to ensure DOM is updated
        requestAnimationFrame(() => {
            try {
                // Initialize scatterplot
                const newScatterplot = createScatterplot({
                    canvas: newCanvas,
                    width: svgWidth,
                    height: svgHeight,
                    lassoMinDelay: 10,
                    lassoMinDist: 2,
                    pointSize: 5,
                    showReticle: false,
                    reticleColor: [],
                    showPointConnections: true,
                    pointConnectionColor: [0, 0, 0, 0.8],
                    pointConnectionSize: 3,
                    lassoInitiator: true,
                    xScale: xScale,
                    yScale: yScale,
                    resize: false,
                });

                // Add selection handler
                newScatterplot.subscribe('select', (selection) => {
                    if (selection.points.length > 0 && props.setHoverStep && props.selectDatapoint && props.infos) {
                        props.setHoverStep(props.infos[selection.points[0]]);
                        props.selectDatapoint(selection.points[0]);
                    }
                });

                setScatterplot(newScatterplot);

                // Configure scatterplot
                newScatterplot.set({
                    colorBy: 'valueZ',
                    pointColor: uiState.object_color_scale,
                    pointConnectionColorBy: 'valueZ',
                    pointConnectionColor: 'inherit',
                    pointConnectionMaxIntPointsPerSegment: 5,
                    pointConnectionTolerance: 0.5,
                });

                // Prepare points data for scatterplot
                const points = processedData.map((d, i) => [
                    d[0],
                    d[1],
                    uiState.object_layer_colors[i],
                    0,
                    props.infos?.[i]?.['episode index'] || 0,
                ]);

                // Draw points
                newScatterplot.draw(points);

                // Continue with rest of visualization setup
                continueDraw(newScatterplot, newSvg, processedData, xScale, yScale);
            } catch (e) {
                console.error("Error initializing scatterplot:", e);
                setError("Failed to initialize visualization. Please try again.");
            }
        });

        // Helper function to continue drawing after scatterplot is created
        const continueDraw = (plot, svg, processedData, xScale, yScale) => {
            // Set up color range for 2D color mapping
            Color2D.ranges = { x: [-1, 1], y: [-1, 1] };

            // Create view group for annotations
            const view = svg.append('g');

            // Build map of point labels
            const label_data_map = new Map();

            // Add 'Start' labels
            const start_label_data = [0].concat(done_idx.slice(0, -1).map((d) => d + 1));
            for (let i = 0; i < start_label_data.length; i++) {
                label_data_map.set(start_label_data[i], ['Start']);
            }

            // Add 'Done' labels
            for (let i = 0; i < done_idx.length; i++) {
                if (!label_data_map.has(done_idx[i])) {
                    label_data_map.set(done_idx[i], ['Done']);
                } else {
                    label_data_map.get(done_idx[i]).push('Done');
                }
            }

            // Add custom labels from labelInfos
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

            // Create text labels for labeled points
            const text_labels = view
                .selectAll('label-g')
                .data(processedData.map((d, i) => [d[0], d[1], i]).filter((d) => label_data_map.has(d[2])))
                .enter()
                .append('g')
                .attr('class', 'label-g')
                .attr('id', (d) => 'label-g_' + d[2]);

            // Update color legend
            updateColorLegend();

            // Add text labels
            const text_labels_text = text_labels
                .append('text')
                .attr('class', 'label')
                .attr('x', (d) => xScale(d[0]) + 10)
                .attr('y', (d) => yScale(d[1]) + 10)
                .attr('text-anchor', 'start')
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

            // Generate density contours
            try {
                if (canvas) {
                    const context2D = canvas.getContext('2d');
                    if (context2D) {
                        context2D.save();
                        const path = d3.geoPath().context(context2D);

                        context2D.beginPath();
                        for (const c of d3.contourDensity()
                            .size([svgWidth, svgHeight])
                            .bandwidth(8)
                            .thresholds(10)(
                                processedData.map((d, i) => [
                                    xScale(d[0]) * svgWidth,
                                    svgHeight - yScale(d[1]) * svgHeight,
                                    i
                                ])
                            )) {
                            path(c);
                        }
                        context2D.stroke();
                        context2D.restore();
                    }
                }
            } catch (e) {
                console.error("Error drawing contours:", e);
            }

            // Generate cluster hulls
            const hulls: any[] = [];
            const unique_labels = new Set(labels);
            let label_idx = 0;

            // For each labeled cluster, draw a convex hull
            for (const label of unique_labels) {
                if (label === -1) continue;

                const cluster_indices = processedData
                    .map((element, index) => {
                        if (labels[index] === label) {
                            return index;
                        }
                        return -1;
                    })
                    .filter((element) => element >= 0);

                const cluster_data = processedData.filter((_, i) => labels[i] === label);
                const hull = d3.polygonHull(cluster_data);

                if (hull === null) continue;

                const label_text = props.annotationSets && label in props.annotationSets
                    ? props.annotationSets[label]
                    : label;

                hulls.push({
                    coords: hull,
                    label: label_text,
                    indices: cluster_indices,
                    idx: label_idx
                });

                label_idx++;
            }

            // Delete old convex hulls
            view.selectAll('.convex-g').remove();

            // Add convex hulls for clusters
            const convex_g = view
                .selectAll('path')
                .data(hulls)
                .enter()
                .append('g')
                .attr('class', 'convex-g');

            // Add label text in the center of the convex hull
            const convex_g_texts = convex_g
                .append('text')
                .datum((d) => {
                    return {
                        centroid: d3.polygonCentroid(d.coords),
                        text: d.label,
                        idx: d.idx
                    };
                })
                .attr('class', 'label')
                .attr('x', (d) => xScale(d.centroid[0]))
                .attr('y', (d) => yScale(d.centroid[1]))
                .attr('text-anchor', 'middle')
                .attr('font-size', '20px')
                .attr('font-weight', 'bold')
                .attr('fill', '#333333')
                .text((d) => d.text);

            // Add convex hull paths
            const convex_g_paths = convex_g
                .append('path')
                .attr('d', (d) => 'M' + d.coords.map((p) => [xScale(p[0]), yScale(p[1])]).join('L') + 'Z')
                .attr('fill', (d) => {
                    const center = d3.polygonCentroid(d.coords);
                    return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1]));
                })
                .style('opacity', 0.4)
                .style('pointer-events', 'visibleFill')
                .on('mouseover', function (event) {
                    d3.select(this).style('opacity', 0.6);
                })
                .on('mouseout', function (event) {
                    d3.select(this).style('opacity', 0.4);
                })
                .on('click', function (event, data) {
                    d3.select(this).style('opacity', 0.7);

                    // Open text edit field to change label
                    const new_label = prompt('Please enter a new label', '');
                    if (new_label !== null && props.annotateState) {
                        // Update label text
                        convex_g_texts
                            .filter((d) => d.idx === data.idx)
                            .text(new_label);

                        // Call props function to update annotation state
                        props.annotateState(data.indices, new_label, data.label);
                    }
                });

            // Bring text to front
            convex_g_texts.raise();

            // Show/hide annotations based on mode
            if (annotationMode === 'annotate') {
                convex_g_paths.style('visibility', 'visible');
                convex_g_texts.style('visibility', 'visible');
            } else {
                convex_g_paths.style('visibility', 'hidden');
                convex_g_texts.style('visibility', 'hidden');
            }

            // Update text and line positions on zoom/pan
            if (scatterplot) {
                scatterplot.subscribe('view', ({ xScale, yScale }) => {
                    // Update label positions
                    text_labels_text
                        .attr('x', (d) => xScale(d[0]) + 10)
                        .attr('y', (d) => yScale(d[1]) + 10);

                    text_labels_lines
                        .attr('x1', (d) => xScale(d[0]))
                        .attr('y1', (d) => yScale(d[1]))
                        .attr('x2', (d) => xScale(d[0]) + 10)
                        .attr('y2', (d) => yScale(d[1]) + 10);

                    // Update convex hull positions if in annotation mode
                    if (annotationMode === 'annotate') {
                        convex_g_paths.attr(
                            'd',
                            (d) => 'M' + d.coords.map((p) => [xScale(p[0]), yScale(p[1])]).join('L') + 'Z'
                        );

                        // Update text at the center of the convex hull
                        convex_g_texts
                            .attr('x', (d) => xScale(d.centroid[0]))
                            .attr('y', (d) => yScale(d.centroid[1]));
                    }
                });
            }
        };
    }, [
        props.infos,
        props.showModels,
        props.annotationSets,
        props.annotateState,
        uiState.object_color_scale,
        uiState.object_layer_colors,
        embeddingRef,
        scatterplot, // Add this as a dependency
        updateColorLegend,
        setError, // Make sure to add this to your component state
    ]);

    // Draw decision points visualization
    const drawDecisionPoints = useCallback((data = [], merged_points = [], connections = []) => {
        setLastIndex(data.length - 1);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const svgHeight = embeddingRef.current.parentElement.clientHeight;
        const svgWidth = embeddingRef.current.parentElement.clientWidth;

        if (svgWidth < 0 || svgHeight < 0) return;

        // Check if merged points array is empty
        if (!merged_points.length) return;

        const max_value = d3.max(merged_points, (d) => d[2]) || 1;

        // Handle 1D embeddings by adding time dimension
        let processedData = [...data];
        if (data.length > 0 && data[0].length === 1) {
            processedData = data.map((k, i) => [
                props.infos?.[i]?.['episode step'] || 0,
                ...k
            ]);
        }

        // Create quad tree for fast point lookup
        const quadTree = d3.quadtree(
            processedData.map((d, i) => [d[0], d[1], i]),
            (d) => d[0],
            (d) => d[1]
        );

        // Clear and recreate visualization elements
        const container = d3.select(embeddingRef.current);
        container.selectAll('*').remove();
        container.style('position', 'relative');

        // Create canvas for drawing points and connections
        const newCanvas = container.append('canvas').node();
        setCanvas(newCanvas);

        if (newCanvas) {
            newCanvas.width = svgWidth;
            newCanvas.height = svgHeight;
        }

        // Get canvas context
        const context = newCanvas.getContext('2d');

        // Create SVG for interactive elements
        const newSvg = container
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        setSvg(newSvg);

        // Set up scales
        const xDomain = [
            d3.min(merged_points.map((d) => d[0])) || -1,
            d3.max(merged_points.map((d) => d[0])) || 1
        ];
        const xScale = d3.scaleLinear().domain(xDomain).range([0, svgWidth]);

        const yDomain = [
            d3.min(merged_points.map((d) => d[1])) || -1,
            d3.max(merged_points.map((d) => d[1])) || 1
        ];
        const yScale = d3.scaleLinear().range([svgHeight, 0]).domain(yDomain);

        // Set up color mapping
        Color2D.ranges = { x: xDomain, y: yDomain };

        // Set up zoom behavior
        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 15])
            .translateExtent([
                [-600, -600],
                [svgWidth + 600, svgHeight + 600],
            ])
            .on('zoom', handleZoom)
            .on('end', (event) => {
                setUiState(prev => ({ ...prev, k: event.transform.k }));
            });

        // Create view group
        const view = newSvg.append('g');

        // Add invisible rect to capture events
        const view_rect = view
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', svgHeight)
            .attr('width', svgWidth)
            .style('opacity', '0');

        // Add mouse movement handler
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

        // Add click handler
        view_rect.on('click', function (event) {
            const mouse = d3.pointer(event);

            // Map the clicked point to the data space
            const xClicked = xScale.invert(mouse[0]);
            const yClicked = yScale.invert(mouse[1]);

            // Find the closest point in the dataset to the clicked point
            const closest = quadTree.find(xClicked, yClicked, 10);

            if (closest && props.setHoverStep && props.selectDatapoint && props.infos) {
                props.setHoverStep(props.infos[closest[2]]);
                props.selectDatapoint(closest[2]);
            }
        });

        // Create line function for curves
        const lineFunction = d3
            .line()
            .curve(d3.curveCatmullRom)
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]));

        // Add marker for the current step
        view.append('g')
            .append('path')
            .datum(processedData[0] || [0, 0])
            .attr('d', (d) => circleGenerator(xScale(d[0]), yScale(d[1]), 5))
            .attr('fill-opacity', 0.5)
            .attr('fill', '#ff3737')
            .attr('stroke', '#ff3737')
            .attr('id', 'step_marker');

        // Set up scales for point sizes and colors
        const radius_log = d3.scaleLog().domain([1, max_value]).range([1, 2]);

        // Color scale for merged points based on type
        const merged_points_color = function (d) {
            const color_scale = d3.scaleSequential(d3.interpolateOrRd).domain([0, 1]);
            if (d < 1) return 'grey';
            else if (d === 1) return color_scale(0.5);
            else if (d === 2) return color_scale(0.75);
            else if (d === 3) return color_scale(1);
            else return '#ff0000';
        };

        // Set up scales for connection lines
        const max_line_value = d3.max(connections.map((d) => d[2])) || 1;
        const line_width_log = d3.scaleLog().domain([1, max_line_value]).range([1, 4]);
        const line_color_scale = d3.scaleSequential(d3.interpolateViridis).domain([0, max_line_value]);

        // Zoom handler function
        function handleZoom(event) {
            const transform = event.transform;
            view.attr('transform', transform);

            if (!context) return;

            context.save();
            context.clearRect(0, 0, svgWidth, svgHeight);
            context.translate(transform.x, transform.y);
            context.scale(transform.k, transform.k);

            // Draw the original points
            const r = Math.round((2 / transform.k) * 100) / 100;
            for (const [x, y, i] of processedData.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {
                if (selectedPoints && !selectedPoints[i]) continue;

                // Set opacity
                context.globalAlpha = 0.5;
                context.beginPath();
                context.moveTo(x + r, y);

                // Draw highlighted points as rectangles
                if (highlightedPoints && highlightedPoints[i]) {
                    context.rect(x - r, y - r, 2 * r, 2 * r);
                    context.lineWidth = 1 / transform.k;
                    context.strokeStyle = '#000000';
                    context.stroke();
                } else {
                    context.arc(x, y, r, 0, 2 * Math.PI);
                }

                context.fillStyle = '#666666';
                context.fill();
                context.closePath();
            }

            // Draw the merged points
            const base_radius = Math.round((5 / transform.k) * 100) / 100;
            for (const [x, y, r, c, i] of merged_points.map((d, i) => [
                xScale(d[0]),
                yScale(d[1]),
                d[2],
                d[5] || 0,
                i
            ])) {
                context.beginPath();
                context.moveTo(x + radius_log(r) * base_radius, y);
                context.arc(x, y, radius_log(r) * base_radius, 0, 2 * Math.PI);
                context.fillStyle = merged_points_color(c);
                context.globalAlpha = 0.95;
                context.fill();
                context.closePath();
            }

            // Draw connections between points
            for (const [start, end, value] of connections) {
                const start_point = merged_points[start];
                const end_point = merged_points[end];

                if (!start_point || !end_point) continue;

                context.beginPath();
                context.moveTo(xScale(start_point[0]), yScale(start_point[1]));
                context.lineTo(xScale(end_point[0]), yScale(end_point[1]));
                context.lineWidth = line_width_log(value);
                context.strokeStyle = line_color_scale(value);
                context.stroke();
            }

            context.restore();
        }

        // Apply zoom behavior
        newSvg.call(zoom);

        // Initialize view
        handleZoom({ transform: d3.zoomIdentity });

        // Update UI state with scales
        setUiState(prev => ({
            ...prev,
            x: xScale,
            y: yScale
        }));

    }, [highlightedPoints, selectedPoints, props.infos, props.setHoverStep, props.selectDatapoint, circleGenerator]);

    // Draw activation mapping visualization
    const drawActivationMapping = useCallback((data = [], feature_embeddings = [], doneData = []) => {
        setLastIndex(data.length - 1);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const done_idx = doneData.reduce((a, elem, i) => (elem === true && a.push(i), a), []);
        const svgHeight = embeddingRef.current.parentElement.clientHeight;
        const svgWidth = embeddingRef.current.parentElement.clientWidth;

        if (svgWidth < 0 || svgHeight < 0) return;

        // Handle 1D embeddings by adding time dimension
        let processedData = [...data];
        if (data.length > 0 && data[0].length === 1) {
            processedData = data.map((k, i) => [
                props.infos?.[i]?.['episode step'] || 0,
                ...k
            ]);
        }

        // Create quad trees for fast point lookup
        const quadTree = d3.quadtree(
            processedData.map((d, i) => [d[0], d[1], i]),
            (d) => d[0],
            (d) => d[1]
        );

        const featureQuadTree = d3.quadtree(
            feature_embeddings.map((d, i) => [d[0], d[1], i]),
            (d) => d[0],
            (d) => d[1]
        );

        // Shift feature embeddings for side-by-side view
        const shiftedFeatureEmbeddings = feature_embeddings.map((e, i) => [e[0] + 1, e[1], i]);

        // Clear and recreate visualization elements
        const container = d3.select(embeddingRef.current);
        container.selectAll('*').remove();
        container.style('position', 'relative');

        // Create canvas for drawing points
        const newCanvas = container.append('canvas').node();
        setCanvas(newCanvas);

        if (newCanvas) {
            newCanvas.width = svgWidth;
            newCanvas.height = svgHeight;
        }

        // Get canvas context
        const context = newCanvas.getContext('2d');

        // Create SVG for interactive elements
        const newSvg = container
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        setSvg(newSvg);

        // Set up scales
        const xDomain = [0, 2];
        const xScale = d3.scaleLinear().domain(xDomain).range([0, svgWidth]);

        const yDomain = [0, 1];
        const yScale = d3.scaleLinear().range([svgHeight, 0]).domain(yDomain);

        // Set up color mapping
        Color2D.ranges = { x: xDomain, y: yDomain };

        // Set up zoom behavior
        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 15])
            .translateExtent([
                [-600, -600],
                [svgWidth + 600, svgHeight + 600],
            ])
            .on('zoom', handleZoom)
            .on('end', (event) => {
                setUiState(prev => ({ ...prev, k: event.transform.k }));
            })
            .filter(function (event) {
                return !event.ctrlKey && !event.metaKey;
            });

        // Set up brush for selection
        const brush = d3
            .brush()
            .extent([
                [0, 0],
                [svgWidth, svgHeight],
            ])
            .filter(function (event) {
                return (event.ctrlKey || event.metaKey) && event.type === 'mousedown';
            })
            .on('start', brushStart)
            .on('end', brushEnd);

        function brushStart() {
            // Clear the brush
            newSvg.selectAll('.brush').call(brush.move, null);
        }

        function brushEnd(event) {
            const selection = event.selection;

            const selected = [];
            if (selection) {
                let [[xmin, ymin], [xmax, ymax]] = selection;
                xmin = xScale.invert(xmin);
                xmax = xScale.invert(xmax);
                ymin = yScale.invert(ymin);
                ymax = yScale.invert(ymax);

                quadTree.visit((node, x1, y1, x2, y2) => {
                    if (!node.length) {
                        do {
                            const d = node.data;
                            if (d[0] >= xmin && d[0] < xmax && d[1] <= ymin && d[1] > ymax) {
                                selected.push(d);
                            }
                        } while ((node = node.next));
                    }
                    return;
                });
            }

            if (props.highlightIndices) {
                props.highlightIndices(selected.map((d) => d[2]));
            }

            // Clear the brush
            newSvg.selectAll('.brush').call(brush.move, null);
        }

        // Create view group
        const view = newSvg.append('g');

        // Add invisible rect to capture events
        const view_rect = view
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', svgHeight)
            .attr('width', svgWidth)
            .style('opacity', '0');

        // Draw a vertical line to separate the two canvases
        view.append('line')
            .attr('x1', svgWidth / 2)
            .attr('y1', 0)
            .attr('x2', svgWidth / 2)
            .attr('y2', svgHeight)
            .attr('stroke', 'black')
            .attr('stroke-width', 1);

        // Add titles for the two sections
        view.append('text')
            .attr('x', svgWidth / 4)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '20px')
            .attr('font-weight', 'bold')
            .text('Observations');

        view.append('text')
            .attr('x', (svgWidth / 4) * 3)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '20px')
            .attr('font-weight', 'bold')
            .text('Latents');

        // Add click handler
        view_rect.on('click', function (event) {
            if (event.ctrlKey || event.metaKey) {
                // If ctrl is pressed, ignore click (for brush)
                return;
            }

            const mouse = d3.pointer(event);

            // Map the clicked point to the data space
            const xClicked = xScale.invert(mouse[0]);
            const yClicked = yScale.invert(mouse[1]);

            // Find the closest point in the appropriate dataset
            let closest = null;
            if (xClicked < 1) {
                closest = quadTree.find(xClicked, yClicked, 10);
            } else {
                closest = featureQuadTree.find(xClicked - 1.0, yClicked, 10);
            }

            if (closest && props.setHoverStep && props.selectDatapoint && props.infos) {
                props.setHoverStep(props.infos[closest[2]]);
                props.selectDatapoint(closest[2]);
            }
        });

        // Update color legend
        updateColorLegend();

        // Add marker for the current step
        view.append('g')
            .append('path')
            .datum(processedData[0] || [0, 0])
            .attr('d', (d) => circleGenerator(xScale(d[0]), yScale(d[1]), 5))
            .attr('fill-opacity', 0.5)
            .attr('fill', '#ff3737')
            .attr('stroke', '#ff3737')
            .attr('id', 'step_marker');

        // Draw connecting lines between observations and latents
        const lines = view
            .selectAll('line.connector')
            .data(processedData.map((d, i) => [d[0], d[1], i]))
            .enter()
            .append('line')
            .attr('class', 'connector')
            .attr('x1', (d) => xScale(d[0]))
            .attr('y1', (d) => yScale(d[1]))
            .attr('x2', (d) => xScale(shiftedFeatureEmbeddings[d[2]][0]))
            .attr('y2', (d) => yScale(shiftedFeatureEmbeddings[d[2]][1]))
            .attr('stroke', 'black')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.5)
            .attr('id', (d) => 'line_' + d[2])
            .style('visibility', 'hidden');

        // Zoom handler function
        function handleZoom(event) {
            const transform = event.transform;
            view.attr('transform', transform);

            if (!context) return;

            const r = Math.round((5 / transform.k) * 100) / 100;
            const width = Math.round((1 / transform.k) * 100) / 100;

            context.save();
            context.clearRect(0, 0, svgWidth, svgHeight);
            context.translate(transform.x, transform.y);
            context.scale(transform.k, transform.k);

            // Draw observation points
            for (const [x, y, i] of processedData.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {
                context.beginPath();
                context.moveTo(x + r, y);
                context.arc(x, y, r, 0, 2 * Math.PI);
                context.fillStyle = uiState.object_layer_colors[i] || '#aaaaaa';
                context.globalAlpha = 0.5;
                context.fill();
                context.closePath();
            }

            // Draw latent points
            for (const [x, y, i] of shiftedFeatureEmbeddings.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {
                context.beginPath();
                context.moveTo(x + r, y);
                context.arc(x, y, r, 0, 2 * Math.PI);
                context.fillStyle = highlightedPoints && highlightedPoints[i]
                    ? uiState.object_layer_colors[i] || '#aaaaaa'
                    : '#cccccc';
                context.globalAlpha = 0.5;
                context.fill();
                context.closePath();
            }

            context.restore();

            // Update visibility of connecting lines based on highlighted state
            lines.style('visibility', (d) =>
                highlightedPoints && highlightedPoints[d[2]] ? 'visible' : 'hidden'
            );

            lines.attr('stroke', (d) =>
                highlightedPoints && highlightedPoints[d[2]]
                    ? uiState.object_layer_colors[d[2]] || '#aaaaaa'
                    : '#cccccc'
            );
        }

        // Apply zoom behavior
        newSvg.call(zoom);

        // Initialize view
        handleZoom({ transform: d3.zoomIdentity });

        // Update UI state with scales
        setUiState(prev => ({
            ...prev,
            x: xScale,
            y: yScale
        }));

    }, [
        highlightedPoints,
        uiState.object_layer_colors,
        updateColorLegend,
        props.infos,
        props.setHoverStep,
        props.selectDatapoint,
        props.highlightIndices,
        circleGenerator
    ]);



    // Draw transition embedding visualization
    const drawTransitionEmbedding = useCallback((transition_embeddings = [], actions = [], data = [], annotationMode = 'analyze') => {
        setLastIndex(transition_embeddings.length - 1);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const svgHeight = embeddingRef.current.parentElement.clientHeight;
        const svgWidth = embeddingRef.current.parentElement.clientWidth;

        if (svgWidth < 0 || svgHeight < 0) return;

        // Set object layer colors to action
        activeLearningDispatch({
            type: 'SET_OBJECT_COLOR_MODE',
            payload: 'action'
        });

        // Handle 1D embeddings by adding time dimension
        let processedTransitions = [...transition_embeddings];
        if (transition_embeddings.length > 0 && transition_embeddings[0].length === 1) {
            processedTransitions = transition_embeddings.map((k, i) => [
                props.infos?.[i]?.['episode step'] || 0,
                ...k
            ]);
        }

        // Create quad tree for fast point lookup
        const quadTree = d3.quadtree(
            processedTransitions.map((d, i) => [d[0], d[1], i]),
            (d) => d[0],
            (d) => d[1]
        );

        // Clear and recreate visualization elements
        const container = d3.select(embeddingRef.current);
        container.selectAll('*').remove();
        container.style('position', 'relative');

        // Create canvas for drawing points
        const newCanvas = container.append('canvas').node();
        setCanvas(newCanvas);

        if (newCanvas) {
            newCanvas.width = svgWidth;
            newCanvas.height = svgHeight;
        }

        // Get canvas context
        const context = newCanvas.getContext('2d');

        // Create SVG for interactive elements
        const newSvg = container
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        setSvg(newSvg);

        // Set up scales
        const xDomain = [
            d3.min(processedTransitions.map((d) => d[0])) || -1,
            d3.max(processedTransitions.map((d) => d[0])) || 1
        ];
        const xScale = d3.scaleLinear().domain(xDomain).range([0, svgWidth]);

        const yDomain = [
            d3.min(processedTransitions.map((d) => d[1])) || -1,
            d3.max(processedTransitions.map((d) => d[1])) || 1
        ];
        const yScale = d3.scaleLinear().range([svgHeight, 0]).domain(yDomain);

        // Set up color mapping
        Color2D.ranges = { x: xDomain, y: yDomain };

        // Set up zoom behavior
        const zoom = d3
            .zoom()
            .scaleExtent([0.2, 15])
            .translateExtent([
                [-600, -600],
                [svgWidth + 600, svgHeight + 600],
            ])
            .on('zoom', handleZoom)
            .on('end', (event) => {
                setUiState(prev => ({ ...prev, k: event.transform.k }));
            });

        // Create view group
        const view = newSvg.append('g');

        // Add invisible rect to capture events
        const view_rect = view
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', svgHeight)
            .attr('width', svgWidth)
            .style('opacity', '0');

        // Add click handler
        view_rect.on('click', function (event) {
            const mouse = d3.pointer(event);

            // Map the clicked point to the data space
            const xClicked = xScale.invert(mouse[0]);
            const yClicked = yScale.invert(mouse[1]);

            // Find the closest point
            const closest = quadTree.find(xClicked, yClicked, 10);

            if (closest && props.setHoverStep && props.selectDatapoint && props.infos) {
                props.setHoverStep(props.infos[closest[2]]);
                props.selectDatapoint(closest[2]);
            }
        });

        // Create line function for curves
        const lineFunction = d3
            .line()
            .curve(d3.curveCatmullRom)
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]));

        // Add marker for the current step
        view.append('g')
            .append('path')
            .datum(processedTransitions[0] || [0, 0])
            .attr('d', (d) => circleGenerator(xScale(d[0]), yScale(d[1]), 5))
            .attr('fill-opacity', 0.5)
            .attr('fill', '#ff3737')
            .attr('stroke', '#ff3737')
            .attr('id', 'step_marker');

        // Create color scale for actions
        const action_color_scale = d3.scaleOrdinal(d3.schemeSet3)
            .domain(d3.extent(actions) || [0, 1]);

        // Draw connecting lines between data points and transitions
        const lines = view
            .selectAll('line.connector')
            .data(data.map((d, i) => [d[0], d[1], i]))
            .enter()
            .append('line')
            .attr('class', 'connector')
            .attr('x1', (d) => xScale(d[0]))
            .attr('y1', (d) => yScale(d[1]))
            .attr('x2', (d) => xScale(processedTransitions[d[2]][0]))
            .attr('y2', (d) => yScale(processedTransitions[d[2]][1]))
            .attr('stroke', 'black')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.5)
            .attr('id', (d) => 'line_' + d[2])
            .style('visibility', 'hidden');

        // Zoom handler function
        function handleZoom(event) {
            const transform = event.transform;
            view.attr('transform', transform);

            if (!context) return;

            context.save();
            context.clearRect(0, 0, svgWidth, svgHeight);
            context.translate(transform.x, transform.y);
            context.scale(transform.k, transform.k);

            // Draw transitions as diamond glyphs
            const base_radius = Math.round((10 / transform.k) * 100) / 100;
            for (const [x, y, i] of processedTransitions.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {
                // Draw diamond shape
                context.beginPath();
                context.moveTo(x, y - base_radius * 0.75);
                context.lineTo(x + base_radius * 0.75, y);
                context.lineTo(x, y + base_radius * 0.75);
                context.lineTo(x - base_radius * 0.75, y);
                context.globalAlpha = 0.75;
                context.closePath();
                context.lineWidth = 1 / transform.k;
                context.strokeStyle = '#000000';
                context.stroke();
                context.fillStyle = action_color_scale(actions[i] || 0);
                context.fill();
            }

            // Draw original data points as smaller opaque circles
            const base_radius2 = Math.round((3 / transform.k) * 100) / 100;
            context.globalAlpha = 0.5;
            for (const [x, y, i] of data.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {
                context.beginPath();
                context.arc(x, y, base_radius2, 0, 2 * Math.PI);
                context.fillStyle = '#cccccc';
                context.fill();
                context.closePath();
            }

            context.restore();

            // Update connecting lines visibility based on highlighting
            lines.style('visibility', (d) =>
                highlightedPoints && highlightedPoints[d[2]] ? 'visible' : 'hidden'
            );

            lines.attr('stroke', (d) =>
                highlightedPoints && highlightedPoints[d[2]]
                    ? uiState.object_layer_colors[d[2]] || '#aaaaaa'
                    : '#cccccc'
            );
        }

        // Apply zoom behavior
        newSvg.call(zoom);

        // Initialize view
        handleZoom({ transform: d3.zoomIdentity });

        // Update UI state with scales
        setUiState(prev => ({
            ...prev,
            x: xScale,
            y: yScale
        }));

    }, [
        highlightedPoints,
        uiState.object_layer_colors,
        activeLearningDispatch,
        props.infos,
        props.setHoverStep,
        props.selectDatapoint,
        circleGenerator
    ]);

    // Handler functions for UI interactions

    // Handler for setting background layer color mode
    const handleBackgroundLayerColorMode = useCallback((mode) => {
        activeLearningDispatch({
            type: 'SET_BACKGROUND_COLOR_MODE',
            payload: mode
        });
    }, [activeLearningDispatch]);

    // Handler for setting object layer color mode
    const handleObjectLayerColorMode = useCallback((mode) => {
        activeLearningDispatch({
            type: 'SET_OBJECT_COLOR_MODE',
            payload: mode
        });
    }, [activeLearningDispatch]);

    // Generate list items for object layer controls
    const getObjectLayerListItems = useCallback(() => {
        const infoTypes = props.infoTypes || [];
        return ['none', 'step_reward', ...infoTypes].map(type => (
            <ListItem key={type} disablePadding>
                <ListItemButton
                    selected={objectColorMode === type}
                    onClick={() => handleObjectLayerColorMode(type)}
                >
                    <ListItemText primary={type} />
                </ListItemButton>
            </ListItem>
        ));
    }, [objectColorMode, props.infoTypes, handleObjectLayerColorMode]);

    // Generate list items for background layer controls
    const getBackgroundLayerListItems = useCallback(() => {
        const infoTypes = props.infoTypes || [];
        return ['none', 'step_reward', ...infoTypes].map(type => (
            <ListItem key={type} disablePadding>
                <ListItemButton
                    selected={backgroundColorMode === type}
                    onClick={() => handleBackgroundLayerColorMode(type)}
                >
                    <ListItemText primary={type} />
                </ListItemButton>
            </ListItem>
        ));
    }, [backgroundColorMode, props.infoTypes, handleBackgroundLayerColorMode]);

    // If there's an error, display it
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    // Define view modes and annotation modes
    const modes = [
        { name: 'Analyze', value: 'analyze' },
        { name: 'Annotate', value: 'annotate' },
    ];

    const views = [
        { name: 'State Space', value: 'state_space' },
        { name: 'Decision Points', value: 'decision_points' },
        { name: 'Activation Mapping', value: 'activation_mapping' },
        { name: 'Transition Embedding', value: 'transition_embedding' },
    ];

    const handleViewModeChange = (newMode) => {
        //setViewMode(newMode);

        activeLearningDispatch({
            type: 'SET_VIEW_MODE',
            payload: newMode
        });
    }

    const handleAnnotationModeChange = (event, newMode) => {
        if (newMode !== null) {
            setAnnotationMode(newMode);
            activeLearningDispatch({
                type: 'SET_ANNOTATION_MODE',
                payload: newMode
            });
        }
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

            {/* Controls */}
            <ControlsWrapper>
                {/* View selector */}
                <ControlOverlay elevation={3}>
                    <ViewBoxContainer>
                        {views.map((view, i) => (
                            <ViewBox
                                key={i}
                                selected={viewMode === view.value}
                                onClick={() => handleViewModeChange(view.value)}
                                sx={{
                                    backgroundImage: `url(${uiState.step_images[i]})`,
                                    opacity: viewMode === view.value ? 1 : 0.7
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        backgroundColor: 'rgba(255,255,255,0.7)',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}
                                >
                                    {view.name}
                                </Typography>
                            </ViewBox>
                        ))}
                    </ViewBoxContainer>
                </ControlOverlay>

                {/* Mode selector */}
                <ControlOverlay>
                    <Typography variant="subtitle1" gutterBottom>Mode</Typography>
                    <ToggleButtonGroup
                        value={annotationMode}
                        exclusive
                        onChange={handleAnnotationModeChange}
                        aria-label="annotation mode"
                        fullWidth
                    >
                        {modes.map((mode) => (
                            <ToggleButton
                                key={mode.value}
                                value={mode.value}
                                aria-label={mode.name}
                            >
                                {mode.name}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </ControlOverlay>

                {/* Layer controls */}
                <ControlOverlay>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Object Layer</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                            <List
                                sx={{
                                    maxHeight: '250px',
                                    overflowY: 'auto'
                                }}
                            >
                                {getObjectLayerListItems()}
                            </List>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Background Layer</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                            <List
                                sx={{
                                    maxHeight: '250px',
                                    overflowY: 'auto'
                                }}
                            >
                                {getBackgroundLayerListItems()}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                </ControlOverlay>

                {/* Additional controls can be added here */}
            </ControlsWrapper>

            {/* Button to load data */}
            <Box
                position="absolute"
                top="50%"
                left="50%"
                sx={{ transform: 'translate(-50%, -50%)', zIndex: 10 }}
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