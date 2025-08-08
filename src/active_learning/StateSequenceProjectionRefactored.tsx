import React, { useRef, useCallback } from 'react';
import {
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    CardMedia,
    Paper
} from '@mui/material';
import * as d3 from 'd3';
import * as vsup from 'vsup';
import { Color2D } from './projection_utils/2dcolormaps';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { computeTrajectoryColors, getFallbackColor } from './utils/trajectoryColors';

// Import extracted components and utilities
import { ProjectionProps } from './types/projectionTypes';
import { useProjectionState } from './hooks/useProjectionState';
import { useProjectionData } from './hooks/useProjectionData';
import { useFrameLoading } from './hooks/useFrameLoading';
import { ColorLegend } from './components/ColorLegend';
import { GlyphLegendComponent } from './components/GlyphLegend';
import { ActionButtons } from './components/ActionButtons';
import {
    EmbeddingWrapper,
    EmbeddingContainer,
    ThumbnailOverlay,
    ObjectLegend,
    GlyphLegend
} from './components/StyledComponents';
import {
    canvasImageCache,
    drawTrajectory,
    drawImageToCanvas,
    createStartGlyph,
    createEndGlyph
} from './utils/canvasUtils';

const StateSequenceProjection: React.FC<ProjectionProps> = (props) => {
    // Get state and dispatch from context
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();

    // Refs
    const embeddingRef = useRef<HTMLDivElement>(null);

    // Extract props from activeLearningState
    const {
        viewMode = 'state_space',
        embeddingSequenceLength = 1,
    } = activeLearningState;

    // Use custom hooks for state management
    const {
        isLoading,
        error,
        selectedState,
        selectedStateFrameUrl,
        minMaxScale,
        segmentSize,
        setIsLoading,
        setError,
        setSegmentError,
        setMinMaxScale,
        selectedTrajectoryRef,
        selectedStateRef,
        selectedCoordinateRef,
        selectedClusterRef,
        setSelectedState,
        setSelectedStateFrameUrl,
    } = useProjectionState();

    // Main drawing function
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
        if (mode === 'state_space') {
            drawStateSpace(data, labels, doneData, labelInfos, episodeIndices, gridData, predictedRewards, predictedUncertainties, segments);
        }
    }, []);

    // Core visualization drawing logic
    const drawStateSpace = useCallback((data = [], labels = [], doneData = [], labelInfos = [], episodeIndices = [], gridData = { prediction_image: null, uncertainty_image: null, bounds: null }, predicted_rewards = [], predicted_uncertainties = [], segments = []) => {
        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const done_idx = doneData.reduce((a: number[], elem: boolean, i: number) => (elem === true && a.push(i), a), []);

        if (!embeddingRef.current || !embeddingRef.current.parentElement) return;

        // Clear any existing SVG content
        d3.select(embeddingRef.current).selectAll('*').remove();

        const svgHeight = embeddingRef.current.parentElement.clientHeight;
        const svgWidth = embeddingRef.current.parentElement.clientWidth;

        if (svgWidth <= 0 || svgHeight <= 0) return;

        let processedData = data.map((k: any, i: number) => [...k, episodeIndices[i] || 0]);

        // Create quad tree for fast point lookup
        const quadTree = d3.quadtree(
            processedData.map((d: any, i: number) => [d[0], d[1], i]),
            (d: any) => d[0],
            (d: any) => d[1]
        );

        const container = d3.select(embeddingRef.current);
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

        const context = canvas ? (canvas as HTMLCanvasElement).getContext('2d') : null;

        // Create SVG overlay
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
        const xExtent = d3.extent(processedData.map((d: any) => d[0])) as [number, number];
        const yExtent = d3.extent(processedData.map((d: any) => d[1])) as [number, number];

        // Add padding to the domains
        const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

        const xDomain = [xExtent[0] - xPadding, xExtent[1] + xPadding];
        const yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];

        const xScale = d3.scaleLinear().domain(xDomain).range([0, svgWidth]);
        const yScale = d3.scaleLinear().range([svgHeight, 0]).domain(yDomain);

        // Set up color mapping
        Color2D.ranges = { x: xDomain, y: yDomain };

        // Setup VSUP color scale
        const colorScale = vsup.scale()
            .quantize(vsup.quantization().branching(2).layers(4).valueDomain([0, 1]).uncertaintyDomain([1.0, 0.01]))
            .range(d3.interpolateBrBG);

        // Pre-compute colors
        const point_colors = processedData.map((d: any, i: number) => {
            const reward = predicted_rewards[i] || 0;
            const uncertainty = predicted_uncertainties[i] || 0;
            return colorScale(reward, uncertainty);
        });

        // Create view group for zoom transformations
        const view = svg.append('g').attr('class', 'view');

        // Add invisible rect to capture events
        const view_rect = view
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('height', svgHeight)
            .attr('width', svgWidth)
            .style('opacity', '0');

        // Draw background grid image if available
        const grid_prediction_image = gridData.prediction_image;
        if (grid_prediction_image && !canvasImageCache.has('prediction')) {
            const img = new Image();
            img.onload = () => {
                canvasImageCache.set('prediction', { image: img, bounds: gridData.bounds });
                if (context) {
                    drawImageToCanvas(context, 'prediction', d3.zoomIdentity, svgWidth, svgHeight, xScale, yScale);
                }
            };
            img.src = `data:image/png;base64,${grid_prediction_image}`;
        }

        // Function to redraw points with current zoom transform
        function redrawPoints(transform = d3.zoomIdentity) {
            if (!context) return;
            
            context.save();
            context.clearRect(0, 0, svgWidth, svgHeight);
            
            // Draw background image first if available
            if (canvasImageCache.has('prediction')) {
                drawImageToCanvas(context, 'prediction', transform, svgWidth, svgHeight, xScale, yScale);
            }
            
            // Apply transformation
            context.translate(transform.x, transform.y);
            context.scale(transform.k, transform.k);

            // Draw points
            processedData.forEach((d: any, i: number) => {
                const x = xScale(d[0]);
                const y = yScale(d[1]);
                const color = point_colors[i];
                
                context.fillStyle = color;
                context.strokeStyle = color;
                context.lineWidth = 1;
                context.beginPath();
                context.arc(x, y, 3, 0, 2 * Math.PI);
                context.fill();
                context.stroke();
            });

            context.restore();
        }

        // Initial draw
        redrawPoints();

        // Add zoom functionality that updates both SVG and Canvas
        const zoom = d3.zoom()
            .scaleExtent([0.2, 15])
            .translateExtent([
                [-svgWidth * 2, -svgHeight * 2],
                [svgWidth * 3, svgHeight * 3],
            ])
            .on('zoom', (event: any) => {
                const transform = event.transform;
                view.attr('transform', transform);
                redrawPoints(transform);
            });

        svg.call(zoom as any);

        // Add basic click interaction for state selection
        view_rect.on('click', function (event: any) {
            event.preventDefault();
            event.stopPropagation();

            const mouse = d3.pointer(event, this);
            const transform = d3.zoomTransform(view.node() as Element);
            
            // Map the clicked point to the data space (accounting for zoom)
            const xClicked = xScale.invert((mouse[0] - transform.x) / transform.k);
            const yClicked = yScale.invert((mouse[1] - transform.y) / transform.k);

            // Find the closest point in the dataset
            const closest = quadTree.find(xClicked, yClicked, 0.1);

            if (closest) {
                console.log('Clicked on point:', closest);
                // You can add state selection logic here
                // For now, just highlight the selected area
                const selectedX = xScale(closest[0]);
                const selectedY = yScale(closest[1]);
                
                // Draw a highlight circle on the SVG
                view.selectAll('.selection-marker').remove();
                view.append('circle')
                    .attr('class', 'selection-marker')
                    .attr('cx', selectedX)
                    .attr('cy', selectedY)
                    .attr('r', 8)
                    .style('fill', 'none')
                    .style('stroke', '#ff0000')
                    .style('stroke-width', 3);
            }
        });

        console.log(`Rendered ${processedData.length} data points`);
    }, []);

    // Use custom hook for data loading
    const { loadData } = useProjectionData(
        props,
        embeddingSequenceLength,
        segmentSize,
        setIsLoading,
        setError,
        setSegmentError,
        setMinMaxScale,
        drawChart
    );

    // Use custom hook for frame loading
    useFrameLoading(selectedState, props, setSelectedStateFrameUrl);

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

            {/* Selected State Frame overlay */}
            {selectedStateFrameUrl && selectedState && selectedState.episode !== null && selectedState.step !== null && (
                <ThumbnailOverlay
                    sx={{
                        borderColor: '#ff6b6b',
                        opacity: 1,
                    }}
                >
                    <CardMedia
                        component="img"
                        height="100%"
                        image={selectedStateFrameUrl}
                        alt="Selected state frame"
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
                        Ep. {selectedState.episode}, Step {selectedState.step}
                    </Box>
                </ThumbnailOverlay>
            )}

            {/* Action Buttons */}
            <ActionButtons
                isLoading={isLoading}
                selectedTrajectoryRef={selectedTrajectoryRef}
                selectedStateRef={selectedStateRef}
                selectedClusterRef={selectedClusterRef}
                selectedCoordinateRef={selectedCoordinateRef}
                setSelectedState={setSelectedState}
                setSelectedStateFrameUrl={setSelectedStateFrameUrl}
            />

            {/* Load Data button and episode info */}
            <Box
                position="absolute"
                top="10px"
                left="50px"
                sx={{ zIndex: 10, display: 'flex', gap: 2, alignItems: 'center' }}
            >
                <Button variant="contained" color="primary" onClick={loadData} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Load Data'}
                </Button>
                
                {/* Episodes overview */}
                <Box sx={{ backgroundColor: 'rgba(158, 158, 158, 0.9)', padding: 1, borderRadius: 1, color: 'white' }}>
                    <Typography variant="caption" fontWeight="bold">
                        Episodes: {new Set(activeLearningState.episodeIndices).size} displayed
                    </Typography>
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
    );
};

export default StateSequenceProjection;