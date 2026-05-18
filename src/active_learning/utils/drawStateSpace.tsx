import { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import * as d3 from 'd3';
import * as vsup from 'vsup';

import { UserDemoTrajectory } from '../../ActiveLearningContext';
import { Color2D } from '../projection_utils/2dcolormaps';
import {
    ProjectionBackgroundMode,
    ProjectionRegionAnnotation,
    SelectedCluster,
    SelectedCoordinate,
    SelectedState,
    SelectionItem,
} from '../types/stateSequenceProjectionTypes';
import { canvasImageCache } from './canvasCache';
import { computeTrajectoryColors, getFallbackColor } from './trajectoryColors';
import { buildGridAxesFromBounds } from './projectionGrid';
import { interpolateBrightCividis } from './vsupColors';

let lastTrajectoryDebugSignature = '';


export interface DrawStateSpaceArgs {
    data?: number[][];
    labels?: any[];
    doneData?: any[];
    labelInfos?: any[];
    episodeIndices?: number[];
    gridData?: { prediction_image: string | null; uncertainty_image: string | null; bounds: any };
    predicted_rewards?: number[];
    predicted_uncertainties?: number[];
    segments?: any[];
    props?: any;
    activeLearningDispatch: Dispatch<any>;
    embeddingRef: RefObject<HTMLDivElement | null>;
    selectedStateRef: MutableRefObject<SelectedState | null>;
    selectedTrajectoryRef: MutableRefObject<number | null>;
    selectedCoordinateRef: MutableRefObject<SelectedCoordinate | null>;
    selectedClusterRef: MutableRefObject<SelectedCluster | null>;
    selectedUserTrajectoryIdRef: MutableRefObject<string | null>;
    multiSelectModeRef: MutableRefObject<boolean>;
    currentSelectionRef: MutableRefObject<SelectionItem[]>;
    feedbackHighlightsRef: MutableRefObject<{
        episodes: Set<number>;
        states: Set<number>;
        coordinates: Set<string>;
        clustersSignatures?: Set<string>;
    } | null>;
    currentTransformRef: MutableRefObject<d3.ZoomTransform | null>;
    zoomBehaviorRef: MutableRefObject<any>;
    zoomedFunctionRef: MutableRefObject<((event: any) => void) | null>;
    fitEpisodeInViewRef: MutableRefObject<((episodeIdx: number) => void) | null>;
    handleUserTrajectorySelection: (trajectory: UserDemoTrajectory, pointIndex?: number) => void;
    setSelectedState: Dispatch<SetStateAction<SelectedState | null>>;
    setSelectedTrajectory: Dispatch<SetStateAction<number | null>>;
    setSelectedCoordinate: Dispatch<SetStateAction<SelectedCoordinate>>;
    setSelectedCluster: Dispatch<SetStateAction<SelectedCluster | null>>;
    maxUncertaintySegments: number;
    userGeneratedTrajectories: UserDemoTrajectory[];
    userTrajectoryCoordinateTransform?: { sx: number; sy: number; tx: number; ty: number } | null;
    gridPredictionImage: string | null;
    currentPhase: number;
    latentPaintMode?: boolean;
    projectionLassoMode?: boolean;
    projectionBackgroundMode?: ProjectionBackgroundMode;
    projectionRegionAnnotations?: ProjectionRegionAnnotation[];
    onLatentTrajectoryPainted?: (coordinates: number[][]) => void;
    onProjectionRegionLassoed?: (polygon: number[][]) => void;
    onProjectionRegionAnnotationClicked?: (annotationId: string) => void;
}

const annotationPalette: Record<
    ProjectionRegionAnnotation['intent'],
    { fill: string; stroke: string; label: string }
> = {
    explore: { fill: 'rgba(46, 125, 50, 0.20)', stroke: '#2E7D32', label: 'Explore' },
    avoid: { fill: 'rgba(198, 40, 40, 0.18)', stroke: '#C62828', label: 'Avoid' },
    neutral: { fill: 'rgba(120, 144, 156, 0.16)', stroke: '#78909C', label: 'Neutral' },
    high_reward: { fill: 'rgba(255, 179, 0, 0.22)', stroke: '#FFB300', label: 'Higher Reward' },
    low_reward: { fill: 'rgba(94, 53, 177, 0.18)', stroke: '#5E35B1', label: 'Lower Reward' },
    trust: { fill: 'rgba(0, 121, 107, 0.20)', stroke: '#00796B', label: 'Trust' },
    distrust: { fill: 'rgba(239, 108, 0, 0.18)', stroke: '#EF6C00', label: 'Distrust' },
};


const drawTrajectory = (
    context: CanvasRenderingContext2D | null,
    points: number[][],
    color: string,
    lineWidth = 2
) => {
    if (!context || points.length < 2) return;

    //context.strokeStyle = color;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i][0], points[i][1]);
    }
    context.stroke();
};

export const drawStateSpaceVisualization = (args: DrawStateSpaceArgs) => {
    const {
        data = [],
        labels = [],
        doneData = [],
        labelInfos = [],
        episodeIndices = [],
        gridData = { prediction_image: null, uncertainty_image: null, bounds: null },
        predicted_rewards = [],
        predicted_uncertainties = [],
        segments = [],
        props = {},
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
        userGeneratedTrajectories,
        userTrajectoryCoordinateTransform = null,
        gridPredictionImage,
        currentPhase = 0,
        latentPaintMode = false,
        projectionLassoMode = false,
        projectionBackgroundMode = 'policy',
        projectionRegionAnnotations = [],
        onLatentTrajectoryPainted,
        onProjectionRegionLassoed,
        onProjectionRegionAnnotationClicked,
    } = args;



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
    const userTrajectories = (userGeneratedTrajectories || [])
        .filter((trajectory) => trajectory.phase === currentPhase)
        .map((trajectory) => {
            if (!userTrajectoryCoordinateTransform || !Array.isArray(trajectory.projection) || trajectory.projection.length === 0) {
                return trajectory;
            }

            const { sx, sy, tx, ty } = userTrajectoryCoordinateTransform;
            const transformedProjection = trajectory.projection.map((point: number[]) => [
                sx * Number(point[0]) + tx,
                sy * Number(point[1]) + ty,
            ]);

            return {
                ...trajectory,
                projection: transformedProjection,
            };
        });

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
        const xExtent = d3.extent(processedData.map((d) => d[0])) as [
            number | undefined,
            number | undefined
        ];
        const yExtent = d3.extent(processedData.map((d) => d[1])) as [
            number | undefined,
            number | undefined
        ];
        const x0 = xExtent[0] ?? 0;
        const x1 = xExtent[1] ?? x0 + 1;
        const y0 = yExtent[0] ?? 0;
        const y1 = yExtent[1] ?? y0 + 1;
        const xPadding = (x1 - x0) * 0.1; // 10% padding
        const yPadding = (y1 - y0) * 0.1; // 10% padding
        xDomain = [x0 - xPadding, x1 + xPadding];
        yDomain = [y0 - yPadding, y1 + yPadding];
    }

    const xScale = d3.scaleLinear().domain(xDomain).range([0, svgWidth]);
    const yScale = d3.scaleLinear().range([svgHeight, 0]).domain(yDomain);
    const projectionGridAxes = buildGridAxesFromBounds(
        {
            x_min: xDomain[0],
            x_max: xDomain[1],
            y_min: yDomain[0],
            y_max: yDomain[1],
            grid_resolution: gridData?.bounds?.grid_resolution,
        },
        gridData?.bounds?.grid_resolution,
    );

    // Set up color mapping
    Color2D.ranges = { x: xDomain, y: yDomain };
    void Color2D.ensureReady();

    // Get grid data
    const grid_prediction_image = gridData.prediction_image || gridPredictionImage;

    // Setup VSUP color scale for predicted reward and uncertainty
    const colorScale = vsup.scale()
        .quantize(vsup.quantization().branching(2).layers(4).valueDomain([0, 1]).uncertaintyDomain([1.0, 0.01]))
        .range(interpolateBrightCividis);

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
            if (context) {
                const viewNode = view.node();
                if (viewNode) {
                    const currentTransform = d3.zoomTransform(viewNode as Element);
                    zoomed({ transform: currentTransform });
                }
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
    function calculateImageBounds(
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        bounds: any,
    ) {
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
    function drawImageToCanvas(
        ctx: CanvasRenderingContext2D | null,
        imageKey: string,
        transform: d3.ZoomTransform,
        width: number,
        height: number,
    ) {
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

    function drawProjectionCrossGrid(
        ctx: CanvasRenderingContext2D | null,
        transform: d3.ZoomTransform,
    ) {
        if (!ctx || !projectionGridAxes) return;

        const { xValues, yValues } = projectionGridAxes;
        if (!xValues.length || !yValues.length) return;

        const xSpacing = xValues.length > 1 ? Math.abs(xScale(xValues[1]) - xScale(xValues[0])) : svgWidth;
        const ySpacing = yValues.length > 1 ? Math.abs(yScale(yValues[1]) - yScale(yValues[0])) : svgHeight;
        const minSpacingScreenPx = Math.max(1, Math.min(xSpacing, ySpacing) * transform.k);

        const targetMaxCrosses = 2000;
        const countStride = Math.max(1, Math.ceil(Math.sqrt((xValues.length * yValues.length) / targetMaxCrosses)));
        const spacingStride = Math.max(1, Math.ceil(8 / minSpacingScreenPx));
        const stride = Math.max(countStride, spacingStride);

        const crossHalfScreenPx = Math.max(1.4, Math.min(4.2, minSpacingScreenPx * 0.18));
        const crossHalfLocal = crossHalfScreenPx / Math.max(transform.k, 0.2);
        const majorGridInterval = 5;
        const maxMajorGridLines = 120;
        const zeroCoordEpsilon = 1e-9;

        ctx.save();
        ctx.globalAlpha = 1;

        const firstX = xScale(xValues[0]);
        const lastX = xScale(xValues[xValues.length - 1]);
        const firstY = yScale(yValues[0]);
        const lastY = yScale(yValues[yValues.length - 1]);

        const majorXIndices = xValues
            .map((_, index) => index)
            .filter((index) =>
                index > 0 &&
                index < xValues.length - 1 &&
                index % majorGridInterval === 0 &&
                Math.abs(xValues[index]) > zeroCoordEpsilon
            );
        const majorYIndices = yValues
            .map((_, index) => index)
            .filter((index) =>
                index > 0 &&
                index < yValues.length - 1 &&
                index % majorGridInterval === 0 &&
                Math.abs(yValues[index]) > zeroCoordEpsilon
            );
        const xLineStride = Math.max(1, Math.ceil(majorXIndices.length / maxMajorGridLines));
        const yLineStride = Math.max(1, Math.ceil(majorYIndices.length / maxMajorGridLines));

        // Major grid as full lines.
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(86, 94, 102, 0.55)';
        ctx.lineWidth = 0.9 / Math.max(transform.k, 0.2);
        for (let idx = 0; idx < majorXIndices.length; idx += xLineStride) {
            const px = xScale(xValues[majorXIndices[idx]]);
            ctx.moveTo(px, firstY);
            ctx.lineTo(px, lastY);
        }
        for (let idx = 0; idx < majorYIndices.length; idx += yLineStride) {
            const py = yScale(yValues[majorYIndices[idx]]);
            ctx.moveTo(firstX, py);
            ctx.lineTo(lastX, py);
        }
        ctx.stroke();

        // Minor grid as crosses.
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(150, 158, 166, 0.58)';
        ctx.lineWidth = 0.8 / Math.max(transform.k, 0.2);
        for (let xi = 0; xi < xValues.length; xi += stride) {
            for (let yi = 0; yi < yValues.length; yi += stride) {
                const px = xScale(xValues[xi]);
                const py = yScale(yValues[yi]);
                ctx.moveTo(px - crossHalfLocal, py);
                ctx.lineTo(px + crossHalfLocal, py);
                ctx.moveTo(px, py - crossHalfLocal);
                ctx.lineTo(px, py + crossHalfLocal);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawPolicyOccupancyBackground(ctx: CanvasRenderingContext2D) {
        const binsX = 30;
        const binsY = 30;
        const binCounts = Array.from({ length: binsX * binsY }, () => 0);
        const xSpan = Math.max(xDomain[1] - xDomain[0], 1e-6);
        const ySpan = Math.max(yDomain[1] - yDomain[0], 1e-6);

        processedData.forEach((point) => {
            const xi = Math.max(0, Math.min(binsX - 1, Math.floor(((point[0] - xDomain[0]) / xSpan) * binsX)));
            const yi = Math.max(0, Math.min(binsY - 1, Math.floor(((point[1] - yDomain[0]) / ySpan) * binsY)));
            binCounts[yi * binsX + xi] += 1;
        });

        const maxCount = Math.max(...binCounts, 0);
        if (maxCount <= 0) return;

        const smoothedCounts = Array.from({ length: binsX * binsY }, () => 0);
        const kernel = [
            [1, 2, 1],
            [2, 4, 2],
            [1, 2, 1],
        ];
        const kernelWeight = 16;

        for (let yi = 0; yi < binsY; yi++) {
            for (let xi = 0; xi < binsX; xi++) {
                let weightedSum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const nx = xi + kx;
                        const ny = yi + ky;
                        if (nx < 0 || nx >= binsX || ny < 0 || ny >= binsY) continue;
                        weightedSum += binCounts[ny * binsX + nx] * kernel[ky + 1][kx + 1];
                    }
                }
                smoothedCounts[yi * binsX + xi] = weightedSum / kernelWeight;
            }
        }

        const maxSmoothedCount = Math.max(...smoothedCounts, 0);
        if (maxSmoothedCount <= 0) return;

        for (let yi = 0; yi < binsY; yi++) {
            for (let xi = 0; xi < binsX; xi++) {
                const count = smoothedCounts[yi * binsX + xi];
                if (count <= 0) continue;

                const intensity = Math.pow(count / maxSmoothedCount, 0.78);
                const x0 = xDomain[0] + (xi / binsX) * xSpan;
                const x1 = xDomain[0] + ((xi + 1) / binsX) * xSpan;
                const y0 = yDomain[0] + (yi / binsY) * ySpan;
                const y1 = yDomain[0] + ((yi + 1) / binsY) * ySpan;
                const rectX = xScale(x0);
                const rectY = yScale(y1);
                const rectW = xScale(x1) - xScale(x0);
                const rectH = yScale(y0) - yScale(y1);

                ctx.fillStyle = `rgba(25, 118, 210, ${0.05 + intensity * 0.30})`;
                ctx.fillRect(rectX, rectY, rectW, rectH);
            }
        }
    }

    function drawRewardModelFallback(ctx: CanvasRenderingContext2D) {
        const cellSize = Math.max(10, Math.floor(processedData.length / 180));
        for (let i = 0; i < processedData.length; i += cellSize) {
            const point = processedData[i];
            const cellWidth = Math.max(12, svgWidth * 0.02);
            const cellHeight = Math.max(12, svgHeight * 0.02);
            ctx.fillStyle = point_colors[i] || 'rgba(144, 164, 174, 0.3)';
            ctx.globalAlpha = 0.16;
            ctx.fillRect(xScale(point[0]) - cellWidth / 2, yScale(point[1]) - cellHeight / 2, cellWidth, cellHeight);
        }
        ctx.globalAlpha = 1;
    }

    function drawWorldModelBackground(ctx: CanvasRenderingContext2D) {
        const binsX = 20;
        const binsY = 20;
        const xSpan = Math.max(xDomain[1] - xDomain[0], 1e-6);
        const ySpan = Math.max(yDomain[1] - yDomain[0], 1e-6);
        const rewardRange = d3.extent(predicted_rewards) as [number | undefined, number | undefined];
        const uncertaintyRange = d3.extent(predicted_uncertainties) as [number | undefined, number | undefined];
        const rewardMin = rewardRange[0] ?? 0;
        const rewardMax = rewardRange[1] ?? 1;
        const uncertaintyMin = uncertaintyRange[0] ?? 0;
        const uncertaintyMax = uncertaintyRange[1] ?? 1;

        for (let yi = 0; yi < binsY; yi++) {
            for (let xi = 0; xi < binsX; xi++) {
                const nx = xi / Math.max(binsX - 1, 1);
                const ny = yi / Math.max(binsY - 1, 1);
                const x0 = xDomain[0] + (xi / binsX) * xSpan;
                const x1 = xDomain[0] + ((xi + 1) / binsX) * xSpan;
                const y0 = yDomain[0] + (yi / binsY) * ySpan;
                const y1 = yDomain[0] + ((yi + 1) / binsY) * ySpan;
                const centerX = (x0 + x1) / 2;
                const centerY = (y0 + y1) / 2;
                const nearest = quadTree.find(centerX, centerY);
                const reward = nearest ? predicted_rewards[nearest[2]] ?? 0 : 0;
                const uncertainty = nearest ? predicted_uncertainties[nearest[2]] ?? 0 : 0;
                const rewardNorm = (reward - rewardMin) / Math.max(rewardMax - rewardMin, 1e-6);
                const uncertaintyNorm = (uncertainty - uncertaintyMin) / Math.max(uncertaintyMax - uncertaintyMin, 1e-6);
                const neighborhoodShift = Math.abs(Math.sin(nx * Math.PI * 3.2) * Math.cos(ny * Math.PI * 2.5));
                const stability = Math.max(0, Math.min(1, 0.78 - neighborhoodShift * 0.42 + rewardNorm * 0.14 - uncertaintyNorm * 0.34));
                const rectX = xScale(x0);
                const rectY = yScale(y1);
                const rectW = xScale(x1) - xScale(x0);
                const rectH = yScale(y0) - yScale(y1);
                const hue = 28 + stability * 138;
                const alphaValue = 0.12 + stability * 0.28;
                ctx.fillStyle = `hsla(${hue}, 70%, ${45 + stability * 18}%, ${alphaValue})`;
                ctx.fillRect(rectX, rectY, rectW, rectH);
            }
        }
    }

    function drawProjectionRegionBlobs(ctx: CanvasRenderingContext2D) {
        projectionRegionAnnotations
            .filter((annotation) => annotation.mode === projectionBackgroundMode && annotation.polygon.length >= 3)
            .forEach((annotation) => {
                const palette = annotationPalette[annotation.intent];
                ctx.beginPath();
                annotation.polygon.forEach((point, index) => {
                    const px = xScale(point[0]);
                    const py = yScale(point[1]);
                    if (index === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                });
                ctx.closePath();
                ctx.fillStyle = palette.fill;
                ctx.strokeStyle = palette.stroke;
                ctx.lineWidth = 2.4 / Math.max(currentTransformRef.current?.k ?? 1, 0.2);
                ctx.fill();
                ctx.stroke();
            });
    }

    function redrawProjectionRegionAnnotations() {
        const lineGenerator = d3
            .line<number[]>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveLinearClosed);

        const visibleAnnotations = projectionRegionAnnotations.filter(
            (annotation) => annotation.mode === projectionBackgroundMode && annotation.polygon.length >= 3
        );

        const annotationGroups = projectionRegionLayer
            .selectAll<SVGGElement, ProjectionRegionAnnotation>('g.projection-region-annotation')
            .data(visibleAnnotations, (d: any) => d.id);

        const annotationGroupsEnter = annotationGroups
            .enter()
            .append('g')
            .attr('class', 'projection-region-annotation')
            .attr('pointer-events', 'all')
            .style('cursor', onProjectionRegionAnnotationClicked ? 'pointer' : 'default');

        annotationGroupsEnter.append('path').attr('class', 'projection-region-fill');
        annotationGroupsEnter.append('path').attr('class', 'projection-region-outline');
        annotationGroupsEnter
            .append('text')
            .attr('class', 'projection-region-label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-weight', 700)
            .style('paint-order', 'stroke')
            .style('stroke', 'rgba(255,255,255,0.92)')
            .style('stroke-width', 3);

        const mergedGroups = annotationGroupsEnter.merge(annotationGroups as any);

        mergedGroups
            .attr('pointer-events', 'all')
            .style('cursor', onProjectionRegionAnnotationClicked ? 'pointer' : 'default')
            .on('click', (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                onProjectionRegionAnnotationClicked?.(d.id);
            });

        mergedGroups.select<SVGPathElement>('path.projection-region-fill')
            .attr('d', (d) => lineGenerator(d.polygon) || '')
            .attr('fill', (d) => annotationPalette[d.intent].fill)
            .attr('opacity', 0.95)
            .attr('pointer-events', 'fill');

        mergedGroups.select<SVGPathElement>('path.projection-region-outline')
            .attr('d', (d) => lineGenerator(d.polygon) || '')
            .attr('fill', 'none')
            .attr('stroke', (d) => annotationPalette[d.intent].stroke)
            .attr('stroke-dasharray', '7,5')
            .attr('stroke-width', Math.max(1.5, 2.8 / Math.max(currentTransformRef.current?.k ?? 1, 0.2)))
            .attr('opacity', 0.95)
            .attr('pointer-events', 'stroke');

        mergedGroups.select<SVGTextElement>('text.projection-region-label')
            .text((d) => annotationPalette[d.intent].label)
            .attr('x', (d) => xScale(d3.polygonCentroid(d.polygon as [number, number][])[0]))
            .attr('y', (d) => yScale(d3.polygonCentroid(d.polygon as [number, number][])[1]))
            .style('font-size', `${Math.max(9, 12 / Math.max(currentTransformRef.current?.k ?? 1, 0.65))}px`)
            .attr('fill', (d) => annotationPalette[d.intent].stroke)
            .attr('pointer-events', 'all');

        annotationGroups.exit().remove();
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
            if (latentPaintMode || projectionLassoMode) return false;

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

    const userTrajectoryLayer = view.append('g').attr('class', 'user-trajectory-layer');
    const projectionRegionLayer = view.append('g').attr('class', 'projection-region-layer');
    const latentPaintLayer = view.append('g').attr('class', 'latent-paint-layer');
    const projectionLassoLayer = view.append('g').attr('class', 'projection-lasso-layer');
    const modeCaptureRect = view
        .append('rect')
        .attr('class', 'projection-mode-capture')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', svgHeight)
        .attr('width', svgWidth)
        .style('opacity', '0')
        .style('cursor', latentPaintMode || projectionLassoMode ? 'crosshair' : 'default')
        .style('pointer-events', latentPaintMode || projectionLassoMode ? 'all' : 'none');
    let isPaintingLatentTrajectory = false;
    let paintedLatentCoordinates: number[][] = [];
    let isDrawingProjectionLasso = false;
    let projectionLassoCoordinates: number[][] = [];

    view_rect.style('cursor', latentPaintMode || projectionLassoMode ? 'crosshair' : 'default');

    const pointerToProjectionCoordinate = (event: any): [number, number] => {
        const pointerTarget = (latentPaintMode || projectionLassoMode ? modeCaptureRect.node() : view_rect.node()) as any;
        const mouse = d3.pointer(event, pointerTarget);
        return [xScale.invert(mouse[0]), yScale.invert(mouse[1])];
    };

    const redrawPaintPreview = () => {
        const lineGenerator = d3
            .line<number[]>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveCatmullRom.alpha(0.5));

        const previewPath = latentPaintLayer
            .selectAll<SVGPathElement, number[][]>('path.latent-paint-preview')
            .data(paintedLatentCoordinates.length > 1 ? [paintedLatentCoordinates] : []);

        previewPath
            .enter()
            .append('path')
            .attr('class', 'latent-paint-preview')
            .attr('fill', 'none')
            .attr('stroke', '#9C27B0')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('pointer-events', 'none')
            .merge(previewPath as any)
            .attr('stroke-width', Math.max(2.5, 5 / Math.max(currentTransformRef.current?.k ?? 1, 0.2)))
            .attr('opacity', 0.9)
            .attr('d', (points) => lineGenerator(points) || '');

        previewPath.exit().remove();

        const previewPoints = latentPaintLayer
            .selectAll<SVGCircleElement, number[]>('circle.latent-paint-point')
            .data(paintedLatentCoordinates.filter((_, index) => index === 0 || index === paintedLatentCoordinates.length - 1));

        previewPoints
            .enter()
            .append('circle')
            .attr('class', 'latent-paint-point')
            .attr('fill', '#9C27B0')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.4)
            .attr('pointer-events', 'none')
            .merge(previewPoints as any)
            .attr('cx', (d) => xScale(d[0]))
            .attr('cy', (d) => yScale(d[1]))
            .attr('r', Math.max(3, 5 / Math.max(currentTransformRef.current?.k ?? 1, 0.2)));

        previewPoints.exit().remove();
    };

    const appendPaintCoordinate = (event: any) => {
        const coordinate = pointerToProjectionCoordinate(event);
        const previous = paintedLatentCoordinates[paintedLatentCoordinates.length - 1];
        if (previous) {
            const dx = coordinate[0] - previous[0];
            const dy = coordinate[1] - previous[1];
            const minDistance = Math.max((xDomain[1] - xDomain[0]), (yDomain[1] - yDomain[0])) * 0.0025;
            if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
                return;
            }
        }
        paintedLatentCoordinates.push(coordinate);
        redrawPaintPreview();
    };

    if (latentPaintMode) {
        modeCaptureRect.raise();
        modeCaptureRect
            .on('pointerdown.latentPaint', function (event) {
                event.preventDefault();
                event.stopPropagation();
                try {
                    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
                } catch {}
                isPaintingLatentTrajectory = true;
                paintedLatentCoordinates = [];
                latentPaintLayer.selectAll('*').remove();
                appendPaintCoordinate(event);
            })
            .on('pointermove.latentPaint', function (event) {
                if (!isPaintingLatentTrajectory) return;
                event.preventDefault();
                event.stopPropagation();
                appendPaintCoordinate(event);
            })
            .on('pointerup.latentPaint pointerleave.latentPaint', function (event) {
                if (!isPaintingLatentTrajectory) return;
                event.preventDefault();
                event.stopPropagation();
                isPaintingLatentTrajectory = false;
                try {
                    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
                } catch {}

                if (paintedLatentCoordinates.length >= 2 && onLatentTrajectoryPainted) {
                    onLatentTrajectoryPainted(paintedLatentCoordinates.map((point) => [...point]));
                }
            });
    } else {
        modeCaptureRect.on('pointerdown.latentPaint pointermove.latentPaint pointerup.latentPaint pointerleave.latentPaint', null);
    }

    const redrawProjectionLassoPreview = () => {
        const lineGenerator = d3
            .line<number[]>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveLinearClosed);

        const preview = projectionLassoLayer
            .selectAll<SVGPathElement, number[][]>('path.projection-lasso-preview')
            .data(projectionLassoCoordinates.length > 2 ? [projectionLassoCoordinates] : []);

        preview
            .enter()
            .append('path')
            .attr('class', 'projection-lasso-preview')
            .attr('fill', 'rgba(2,136,209,0.08)')
            .attr('stroke', '#0288D1')
            .attr('stroke-dasharray', '8,5')
            .attr('pointer-events', 'none')
            .merge(preview as any)
            .attr('stroke-width', Math.max(1.5, 3 / Math.max(currentTransformRef.current?.k ?? 1, 0.2)))
            .attr('d', (points) => lineGenerator(points) || '');

        preview.exit().remove();
    };

    const appendLassoCoordinate = (event: any) => {
        const coordinate = pointerToProjectionCoordinate(event);
        const previous = projectionLassoCoordinates[projectionLassoCoordinates.length - 1];
        if (previous) {
            const dx = coordinate[0] - previous[0];
            const dy = coordinate[1] - previous[1];
            const minDistance = Math.max((xDomain[1] - xDomain[0]), (yDomain[1] - yDomain[0])) * 0.0025;
            if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
                return;
            }
        }
        projectionLassoCoordinates.push(coordinate);
        redrawProjectionLassoPreview();
    };

    if (projectionLassoMode) {
        modeCaptureRect.raise();
        modeCaptureRect
            .on('pointerdown.projectionLasso', function (event) {
                event.preventDefault();
                event.stopPropagation();
                try {
                    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
                } catch {}
                isDrawingProjectionLasso = true;
                projectionLassoCoordinates = [];
                projectionLassoLayer.selectAll('*').remove();
                appendLassoCoordinate(event);
            })
            .on('pointermove.projectionLasso', function (event) {
                if (!isDrawingProjectionLasso) return;
                event.preventDefault();
                event.stopPropagation();
                appendLassoCoordinate(event);
            })
            .on('pointerup.projectionLasso pointerleave.projectionLasso', function (event) {
                if (!isDrawingProjectionLasso) return;
                event.preventDefault();
                event.stopPropagation();
                isDrawingProjectionLasso = false;
                try {
                    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
                } catch {}

                if (projectionLassoCoordinates.length < 3) {
                    projectionLassoLayer.selectAll('*').remove();
                    return;
                }

                if (onProjectionRegionLassoed) {
                    onProjectionRegionLassoed(projectionLassoCoordinates.map((point) => [...point]));
                    return;
                }

                const selectedIndices = processedData
                    .map((point, index) => ({ point, index }))
                    .filter(({ point }) => d3.polygonContains(projectionLassoCoordinates as [number, number][], [point[0], point[1]]))
                    .map(({ index }) => index);

                if (selectedIndices.length > 0) {
                    const clusterInfo = {
                        label: `Lasso Region (${selectedIndices.length})`,
                        indices: selectedIndices,
                    };
                    setSelectedCluster(clusterInfo);
                    selectedClusterRef.current = clusterInfo;
                    setSelectedTrajectory(null);
                    selectedTrajectoryRef.current = null;
                    setSelectedState(null);
                    selectedStateRef.current = null;
                    setSelectedCoordinate({ x: null, y: null });
                    selectedCoordinateRef.current = { x: null, y: null };
                    activeLearningDispatch({
                        type: 'SET_SELECTION',
                        payload: [{ type: 'cluster', data: selectedIndices, label: 'Lasso Region' }],
                    });

                    const viewNode = view.node();
                    if (viewNode) {
                        const currentTransform = d3.zoomTransform(viewNode as Element);
                        zoomed({ transform: currentTransform });
                    }
                }
            });
    } else {
        modeCaptureRect.on(
            'pointerdown.projectionLasso pointermove.projectionLasso pointerup.projectionLasso pointerleave.projectionLasso',
            null
        );
    }

    // Add mouse events
    /*view_rect.on('mousemove', function (event) {
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
    });*/

    /*view_rect.on('mouseout', function (event) {
        setHoveredEpisode(null);
    });*/

    view_rect.on('click', function (event) {
        if (latentPaintMode || projectionLassoMode) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // Prevent default to avoid any interference
        event.preventDefault();

        // Stop propagation to prevent zoom from catching it
        event.stopPropagation();
        const isMultiSelectEvent =
            multiSelectModeRef.current || Boolean((event as any)?.shiftKey);

        const mouse = d3.pointer(event);

        // Map the clicked point to the data space
        const xClicked = xScale.invert(mouse[0]);
        const yClicked = yScale.invert(mouse[1]);

        // Find the closest point in the dataset to the clicked point (increased search radius)
        const closest = quadTree.find(xClicked, yClicked, 0.05);

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
                return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1])) ?? '#888888';
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

                if (isMultiSelectEvent) {

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
                const viewNode = view.node();
                if (viewNode) {
                    const currentTransform = d3.zoomTransform(viewNode as Element);
                    zoomed({ transform: currentTransform });
                }
            }
        } else {
            // Skip coordinate selection in multi-select mode
            if (isMultiSelectEvent) {
                return;
            }

            // Clear all selections
            setSelectedTrajectory(null);
            selectedTrajectoryRef.current = null;
            setSelectedState(null);
            selectedStateRef.current = null;
            setSelectedCluster(null);
            selectedClusterRef.current = null;
            //setClickedEpisode(null);

            // Reset cluster hull strokes
            /*d3.selectAll(".cluster_hull").style("stroke", function() {
                const center = d3.polygonCentroid(
                return Color2D.getColor(xScale.invert(center[0]), yScale.invert(center[1])) ?? '#888888';
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
            const viewNode = view.node();
            if (viewNode) {
                const currentTransform = d3.zoomTransform(viewNode as Element);
                zoomed({ transform: currentTransform });
            }
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
    const label_data_map = new Map<number, string[]>();
    const start_label_data = [0].concat(done_idx.slice(0, -1).map((d: number) => d + 1));

    for (let i = 0; i < start_label_data.length; i++) {
        label_data_map.set(start_label_data[i], ['Start']);
    }

    for (let i = 0; i < done_idx.length; i++) {
        // Place "Done" label one step earlier (on the last actual step before termination)
        const donePosition = Math.max(0, done_idx[i] - 1);
        if (!label_data_map.has(donePosition)) {
            label_data_map.set(donePosition, ['Done']);
        } else {
            const existing = label_data_map.get(donePosition);
            if (existing) {
                existing.push('Done');
            }
        }
    }

    for (let i = 0; i < labelInfos.length; i++) {
        const label = labelInfos[i].label;
        const ids = labelInfos[i].ids;

        for (let j = 0; j < ids.length; j++) {
            if (!label_data_map.has(ids[j])) {
                label_data_map.set(ids[j], [label]);
            } else {
                const existing = label_data_map.get(ids[j]);
                if (existing) {
                    existing.push(label);
                }
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
    const createStartGlyph = (container: any, size = 12, isHighlighted = false) => {
        const triangle = container.append('polygon')
            .attr('class', 'start-glyph')
            .attr('points', `${-size / 2},${-size / 2} ${size / 2},0 ${-size / 2},${size / 2}`)
            .attr('fill', '#000000')
            .attr('stroke', isHighlighted ? '#C62828' : '#000000')
            .attr('stroke-width', isHighlighted ? 3 : 2);

        // Add highlight glow effect for selected episodes
        if (isHighlighted) {
            //triangle.attr('filter', 'drop-shadow(0 0 4px #C62828)');
        }

        return triangle;
    };

    // Function to create end glyph (square stop)
    const createEndGlyph = (container: any, size = 10, isHighlighted = false) => {
        const square = container.append('rect')
            .attr('class', 'end-glyph')
            .attr('x', -size / 2)
            .attr('y', -size / 2)
            .attr('width', size)
            .attr('height', size)
            .attr('fill', '#000000')
            .attr('stroke', isHighlighted ? '#C62828' : '#000000')
            .attr('stroke-width', isHighlighted ? 3 : 2);

        // Add highlight glow effect for selected episodes
        if (isHighlighted) {
            // square.attr('filter', 'drop-shadow(0 0 4px #C62828)');
        }

        return square;
    };

    // Add appropriate glyphs based on label type
    glyph_labels.each(function (d) {
        const labels = label_data_map.get(d[2]) ?? [];
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


    // Styling helpers for cluster hulls so rated clusters can be visually muted
    const clusterHullStyles = {
        defaultStroke: '#333333',
        defaultWidth: 2,
        defaultOpacity: 0.7,
        selectedWidth: 4,
        selectedOpacity: 0.95,
        feedbackStroke: '#d3d3d3',
        feedbackWidth: 2.6,
        feedbackOpacity: 0.55,
    } as const;

    const buildClusterSignature = (indices: number[]) =>
        JSON.stringify(Array.from(new Set(indices)).sort((a, b) => a - b).slice(0, 200));

    // Render top K merged segments by uncertainty 
    const maxSegments = maxUncertaintySegments;
    if (segments.length > 0 && predicted_uncertainties.length > 0) {
        // Calculate average uncertainty for each merged segment
        const mergedSegmentsWithUncertainty = segments.map((mergedSegment: any) => {
            // Get uncertainty values for all points in this merged segment
            const segmentUncertainties: number[] = [];
            const segmentGlobalIndices: number[] = [];

            // Iterate through all inner segments within this merged segment
            mergedSegment.segments.forEach((innerSegment: any) => {
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
        const selectedSegments: Array<{
            mergedSegment: any;
            avgUncertainty: number;
            globalIndices: number[];
        }> = [];
        const minDistance = 0.15; // Adjust based on your data scale

        for (const segmentData of sortedSegments) {
            const tooClose = selectedSegments.some((selected) => {
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

            // Hull growth is handled in stateSequenceProjectionHelpers to preserve concavity.
            const mappedHull = mergedSegment.convexHull.map((p: number[]) => [xScale(p[0]), yScale(p[1])]);

            const segmentElement = segmentGroup.append('g')
                .attr('class', 'uncertainty-segment')
                .attr('id', `uncertainty-segment-${mergedSegment.id}`);
            // Precompute a stable signature based on member indices for highlight matching
            const segmentIndices = topMergedSegments[index].globalIndices || [];
            const segmentSignature = buildClusterSignature(segmentIndices);
            segmentElement.attr('data-cluster-sig', segmentSignature);

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
                    const isMultiSelectEvent =
                        multiSelectModeRef.current || Boolean((event as any)?.shiftKey);

                    // Skip cluster selection in multi-select mode
                    if (isMultiSelectEvent) {
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
                    const viewNode = view.node();
                    if (viewNode) {
                        const currentTransform = d3.zoomTransform(viewNode as Element);
                        zoomed({ transform: currentTransform });
                    }
                });

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

    const normalTrajectoryEntry = Array.from(episodeToPaths.entries()).find(([, points]) => points.length >= 2);
    const userTrajectoryEntry = userTrajectories.find(
        (trajectory) => Array.isArray(trajectory.projection) && trajectory.projection.length >= 2
    );
    if (normalTrajectoryEntry && userTrajectoryEntry) {
        const [, normalPoints] = normalTrajectoryEntry;
        const userPoints = userTrajectoryEntry.projection || [];
        const sampleCount = 3;
        const normalRawSample = normalPoints.slice(0, sampleCount).map((point: number[]) => [Number(point[0]), Number(point[1])]);
        const userRawSample = userPoints.slice(0, sampleCount).map((point: number[]) => [Number(point[0]), Number(point[1])]);
        const toScaled = (point: number[]) => [xScale(point[0]), yScale(point[1])];
        const toZoomed = (point: number[]) => {
            const scaled = toScaled(point);
            return [finalTransform.applyX(scaled[0]), finalTransform.applyY(scaled[1])];
        };

        const payload = {
            phase: currentPhase,
            xDomain,
            yDomain,
            zoom: { x: finalTransform.x, y: finalTransform.y, k: finalTransform.k },
            userTrajectoryCoordinateTransform,
            normal: {
                episode: normalTrajectoryEntry[0],
                raw: normalRawSample,
                scaled: normalRawSample.map(toScaled),
                zoomed: normalRawSample.map(toZoomed),
            },
            user: {
                id: userTrajectoryEntry.id,
                raw: userRawSample,
                scaled: userRawSample.map(toScaled),
                zoomed: userRawSample.map(toZoomed),
            },
        };

        const signature = JSON.stringify({
            phase: payload.phase,
            normal: payload.normal.raw[0],
            user: payload.user.raw[0],
            zoom: payload.zoom,
            transform: payload.userTrajectoryCoordinateTransform,
        });
        if (signature !== lastTrajectoryDebugSignature) {
            lastTrajectoryDebugSignature = signature;
            console.log('[ProjectionDebug] normal vs user trajectory samples', payload);
        }
        if (typeof window !== 'undefined') {
            (window as any).__trajectoryProjectionDebug = payload;
        }
    }

    // Compute similarity-based colors for all trajectories outside the canvas context
    const computedTrajectoryColors = computeTrajectoryColors(episodeToPaths);

    // Dispatch the colors to the active learning context
    activeLearningDispatch({
        type: 'SET_TRAJECTORY_COLORS',
        payload: computedTrajectoryColors
    });

    const buildEpisodeDrawOrder = () => {
        const highlightedEpisodes = feedbackHighlightsRef.current?.episodes ?? new Set<number>();
        return Array.from(episodeToPaths.keys()).sort((a, b) => {
            const aHighlighted = highlightedEpisodes.has(a);
            const bHighlighted = highlightedEpisodes.has(b);
            if (aHighlighted === bHighlighted) return 0;
            return aHighlighted ? -1 : 1;
        });
    };

    const getHighlightedEpisodes = () => {
        const episodes = new Set<number>();
        const selectionItems = currentSelectionRef.current || [];

        for (const item of selectionItems) {
            if (!item) continue;
            if (item.type === 'state' && item.data && typeof item.data.episode === 'number') {
                episodes.add(item.data.episode);
            } else if (item.type === 'trajectory' && typeof item.data === 'number') {
                episodes.add(item.data);
            }
        }

        const selectedTrajectoryIdx = selectedTrajectoryRef.current;
        if (typeof selectedTrajectoryIdx === 'number') {
            episodes.add(selectedTrajectoryIdx);
        }

        const selectedState = selectedStateRef.current;
        if (selectedState && typeof selectedState.episode === 'number') {
            episodes.add(selectedState.episode);
        }

        return episodes;
    };

    // Zoom handler function
    function zoomed(event: any) {

        const transform = event.transform;
        view.attr('transform', transform);

        // Store the current transform for future data reloads
        currentTransformRef.current = transform;

        const selectedEpisodes = getHighlightedEpisodes();

        //const isZoomEnd = event.sourceEvent &&
        //    (event.sourceEvent.type === 'mouseup' || event.sourceEvent.type === 'touchend');
        const isZoomEnd = true;

        // First, draw the grid image to the canvas with proper transformation
        if (context) {
            const imageKey = projectionBackgroundMode === 'reward_model' ? predictionCacheKey : null;
            context.clearRect(0, 0, svgWidth, svgHeight);
            if (imageKey) {
                drawImageToCanvas(context, imageKey, transform, svgWidth, svgHeight);
            }

            // Draw additional items on top if needed
            if (isZoomEnd) {
                const r = Math.round((3 / transform.k) * 100) / 100;
                const width = Math.round((2.5 / transform.k) * 100) / 100;
                const hasBackgroundMap = imageKey ? canvasImageCache.has(imageKey) : false;

                // Save current context
                context.save();

                // Apply the same transformation as the background image
                context.translate(transform.x, transform.y);
                context.scale(transform.k, transform.k);

                if (projectionBackgroundMode === 'policy') {
                    drawPolicyOccupancyBackground(context);
                } else if (projectionBackgroundMode === 'reward_model' && !hasBackgroundMap) {
                    drawRewardModelFallback(context);
                } else if (projectionBackgroundMode === 'world_model') {
                    drawWorldModelBackground(context);
                }

                drawProjectionRegionBlobs(context);

                if (hasBackgroundMap || projectionBackgroundMode !== 'reward_model') {
                    drawProjectionCrossGrid(context, transform);
                }

                // Draw paths with efficient batching
                buildEpisodeDrawOrder().forEach((episodeIdx) => {
                    const pathPoints = episodeToPaths.get(episodeIdx);
                    if (!pathPoints || pathPoints.length === 0) return;

                    // Highlight the selected trajectory
                    const isHighlighted = selectedEpisodes.has(episodeIdx);

                    // Use similarity-based color
                    const trajectoryColor = computedTrajectoryColors.get(episodeIdx) || getFallbackColor(episodeIdx);

                    // Transform points to screen coordinates
                    const screenPoints = pathPoints.map((p: number[]) => [xScale(p[0]), yScale(p[1])]);

                    // Use thicker stroke for selected episode
                    const strokeWidth = isHighlighted ? width * 2 : width;
                    drawTrajectory(context, screenPoints, trajectoryColor, strokeWidth);
                });

                if (userTrajectories.length > 0) {
                    context.save();
                    context.globalAlpha = 0.92;
                    const overlayWidth = Math.max(2.5, width * 2.5);
                    userTrajectories.forEach((trajectory) => {
                        if (!trajectory.projection || trajectory.projection.length === 0) return;
                        const screenPoints = trajectory.projection.map((p: number[]) => [xScale(p[0]), yScale(p[1])]);
                        const trajectoryColor = (trajectory.metadata?.color as string) || '#FF6B35';
                        const isSelected = selectedUserTrajectoryIdRef.current === trajectory.id;
                        drawTrajectory(
                            context,
                            screenPoints,
                            trajectoryColor,
                            isSelected ? overlayWidth * 1.4 : overlayWidth
                        );
                    });
                    context.restore();

                    userTrajectoryLayer.raise();
                    projectionRegionLayer.raise();
                    latentPaintLayer.raise();
                    projectionLassoLayer.raise();
                    if (latentPaintMode || projectionLassoMode) {
                        modeCaptureRect.raise();
                    }

                    const lineGenerator = d3
                        .line<number[]>()
                        .x((d) => xScale(d[0]))
                        .y((d) => yScale(d[1]));

                    const userPaths = userTrajectoryLayer
                        .selectAll<SVGPathElement, UserDemoTrajectory>('path.user-demo-path')
                        .data(userTrajectories, (d: any) => d.id);

                    userPaths
                        .enter()
                        .append('path')
                        .attr('class', 'user-demo-path')
                        .attr('fill', 'none')
                        .attr('pointer-events', 'stroke')
                        .style('cursor', 'pointer')
                        .on('click', (event, trajectory) => {
                            event.stopPropagation();
                            handleUserTrajectorySelection(trajectory);
                        })
                        .merge(userPaths as any)
                        .attr('stroke', (d: UserDemoTrajectory) => d.metadata?.color ?? '#2D2D2D')
                        .attr('stroke-width', (d: UserDemoTrajectory) =>
                            selectedUserTrajectoryIdRef.current === d.id ? overlayWidth * 1.4 : overlayWidth
                        )
                        .attr('opacity', (d: UserDemoTrajectory) =>
                            selectedUserTrajectoryIdRef.current === d.id ? 0.8 : 0.6
                        )
                        .attr('d', (d: UserDemoTrajectory) => lineGenerator(d.projection || []));

                    userPaths.exit().remove();

                    const userPointData = userTrajectories.flatMap((trajectory) =>
                        (trajectory.projection || []).map((coord, idx) => ({
                            trajectory,
                            idx,
                            coord,
                        }))
                    );

                    const userPoints = userTrajectoryLayer
                        .selectAll<SVGCircleElement, { trajectory: UserDemoTrajectory; idx: number; coord: number[] }>('circle.user-demo-point')
                        .data(userPointData, (d: any) => `${d.trajectory.id}-${d.idx}`);

                    userPoints
                        .enter()
                        .append('circle')
                        .attr('class', 'user-demo-point')
                        .attr('stroke', '#ffffff')
                        .attr('stroke-width', 0.8)
                        .style('cursor', 'pointer')
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            handleUserTrajectorySelection(d.trajectory, d.idx);
                        })
                        .merge(userPoints as any)
                        .attr('fill', (d) => d.trajectory.metadata?.color ?? '#2D2D2D')
                        .attr('opacity', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 0.95 : 0.75
                        )
                        .attr('cx', (d) => xScale(d.coord[0]))
                        .attr('cy', (d) => yScale(d.coord[1]))
                        .attr('r', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id
                                ? Math.max(r * 1.4, 3 / transform.k)
                                : Math.max(r * 0.9, 2 / transform.k)
                        );

                    userPoints.exit().remove();

                    const userStartGlyphData = userTrajectories.flatMap((trajectory) => {
                        const projection = trajectory.projection || [];
                        if (projection.length === 0) return [];
                        return [
                            {
                                trajectory,
                                idx: 0,
                                coord: projection[0],
                            },
                        ];
                    });

                    const userEndGlyphData = userTrajectories.flatMap((trajectory) => {
                        const projection = trajectory.projection || [];
                        if (projection.length === 0) return [];
                        const endIdx = projection.length - 1;
                        return [
                            {
                                trajectory,
                                idx: endIdx,
                                coord: projection[endIdx],
                            },
                        ];
                    });

                    const trianglePoints = (size: number) =>
                        `${-size / 2},${-size / 2} ${size / 2},0 ${-size / 2},${size / 2}`;

                    const userStartGlyphs = userTrajectoryLayer
                        .selectAll<
                            SVGGElement,
                            { trajectory: UserDemoTrajectory; idx: number; coord: number[] }
                        >('g.user-demo-start-glyph')
                        .data(userStartGlyphData, (d: any) => `${d.trajectory.id}-start`);

                    const userStartGlyphsEnter = userStartGlyphs
                        .enter()
                        .append('g')
                        .attr('class', 'user-demo-start-glyph')
                        .style('cursor', 'pointer')
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            handleUserTrajectorySelection(d.trajectory, d.idx);
                        });

                    userStartGlyphsEnter
                        .append('polygon')
                        .attr('class', 'user-demo-start-glyph-shape');

                    userStartGlyphsEnter
                        .merge(userStartGlyphs as any)
                        .attr(
                            'transform',
                            (d) =>
                                `translate(${xScale(d.coord[0])}, ${yScale(d.coord[1])}) scale(${1 / transform.k})`
                        )
                        .select('.user-demo-start-glyph-shape')
                        .attr('points', (d) =>
                            trianglePoints(selectedUserTrajectoryIdRef.current === d.trajectory.id ? 15 : 13)
                        )
                        .attr('fill', (d) => d.trajectory.metadata?.color ?? '#2D2D2D')
                        .attr('stroke', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? '#C62828' : '#ffffff'
                        )
                        .attr('stroke-width', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 3 : 2
                        )
                        .attr('opacity', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 0.98 : 0.92
                        );

                    userStartGlyphs.exit().remove();

                    const userEndGlyphs = userTrajectoryLayer
                        .selectAll<
                            SVGGElement,
                            { trajectory: UserDemoTrajectory; idx: number; coord: number[] }
                        >('g.user-demo-end-glyph')
                        .data(userEndGlyphData, (d: any) => `${d.trajectory.id}-end`);

                    const userEndGlyphsEnter = userEndGlyphs
                        .enter()
                        .append('g')
                        .attr('class', 'user-demo-end-glyph')
                        .style('cursor', 'pointer')
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            handleUserTrajectorySelection(d.trajectory, d.idx);
                        });

                    userEndGlyphsEnter
                        .append('rect')
                        .attr('class', 'user-demo-end-glyph-shape');

                    userEndGlyphsEnter
                        .merge(userEndGlyphs as any)
                        .attr(
                            'transform',
                            (d) =>
                                `translate(${xScale(d.coord[0])}, ${yScale(d.coord[1])}) scale(${1 / transform.k})`
                        )
                        .select('.user-demo-end-glyph-shape')
                        .attr('x', (d) =>
                            -(selectedUserTrajectoryIdRef.current === d.trajectory.id ? 6.5 : 5.5)
                        )
                        .attr('y', (d) =>
                            -(selectedUserTrajectoryIdRef.current === d.trajectory.id ? 6.5 : 5.5)
                        )
                        .attr('width', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 13 : 11
                        )
                        .attr('height', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 13 : 11
                        )
                        .attr('fill', (d) => d.trajectory.metadata?.color ?? '#2D2D2D')
                        .attr('stroke', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? '#C62828' : '#ffffff'
                        )
                        .attr('stroke-width', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 3 : 2
                        )
                        .attr('opacity', (d) =>
                            selectedUserTrajectoryIdRef.current === d.trajectory.id ? 0.98 : 0.92
                        );

                    userEndGlyphs.exit().remove();
                } else {
                    userTrajectoryLayer.selectAll('.user-demo-path').remove();
                    userTrajectoryLayer.selectAll('.user-demo-point').remove();
                    userTrajectoryLayer.selectAll('.user-demo-start-glyph').remove();
                    userTrajectoryLayer.selectAll('.user-demo-end-glyph').remove();
                    projectionRegionLayer.raise();
                    latentPaintLayer.raise();
                    projectionLassoLayer.raise();
                    if (latentPaintMode || projectionLassoMode) {
                        modeCaptureRect.raise();
                    }
                }

                redrawProjectionRegionAnnotations();

                // Batch draw points for better performance
                //context.globalAlpha = 0.5;
                context.beginPath();

                for (const [x, y, i] of processedData.map((d, i) => [xScale(d[0]), yScale(d[1]), i])) {

                    // Check if point is part of highlighted trajectory
                    const pointEpisodeIdx = episodeIndices[i] || 0;
                    const isHighlighted = selectedEpisodes.has(pointEpisodeIdx);
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

                // Overlay highlights for feedback-marked items (current phase)
                try {
                    const highlights = feedbackHighlightsRef.current;

                    if (highlights) {
                        // Highlight whole episodes with a purple overlay path
                        if (highlights.episodes && highlights.episodes.size > 0) {
                            const highlightColor = '#acacacff'; // yellow
                            const overlayWidth = Math.max(1.2, width * 1.5);
                            highlights.episodes.forEach((ep: number) => {
                                const pathPoints = episodeToPaths.get(ep);
                                if (!pathPoints || pathPoints.length === 0) return;
                                const screenPoints = pathPoints.map((p: number[]) => [xScale(p[0]), yScale(p[1])]);
                                drawTrajectory(context, screenPoints, highlightColor, overlayWidth);
                            });
                        }

                        // Highlight specific states with an outlined purple ring
                        if (highlights.states && highlights.states.size > 0) {
                            const ringColor = '#b1b1b1ff';
                            const ringWidth = Math.max(1.2, width * 1.5);
                            for (const gi of Array.from(highlights.states)) {
                                if (gi < 0 || gi >= processedData.length) continue;
                                const [sx, sy] = [xScale(processedData[gi][0]), yScale(processedData[gi][1])];
                                context.beginPath();
                                context.strokeStyle = ringColor;
                                context.lineWidth = ringWidth;
                                context.globalAlpha = 0.9;
                                context.arc(sx, sy, r * 1.8, 0, 2 * Math.PI);
                                context.stroke();
                                context.closePath();
                            }
                        }

                        // Draw small purple crosses for coordinates
                        if (highlights.coordinates && highlights.coordinates.size > 0) {
                            const crossColor = '#b1b1b1ff';
                            const cs = Math.max(6, 8 / Math.max(0.5, transform.k));
                            highlights.coordinates.forEach((key: string) => {
                                const parts = key.split(',');
                                if (parts.length !== 2) return;
                                const cx = parseFloat(parts[0]);
                                const cy = parseFloat(parts[1]);
                                if (Number.isNaN(cx) || Number.isNaN(cy)) return;
                                const px = xScale(cx);
                                const py = yScale(cy);
                                context.beginPath();
                                context.strokeStyle = crossColor;
                                context.lineWidth = Math.max(1, width * 1.2);
                                context.globalAlpha = 0.9;
                                context.moveTo(px - cs, py);
                                context.lineTo(px + cs, py);
                                context.moveTo(px, py - cs);
                                context.lineTo(px, py + cs);
                                context.stroke();
                                context.closePath();
                            });
                        }
                    }
                } catch (e) {
                    // noop
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
        glyph_labels.each(function (d) {
            const glyphEpisodeIdx = episodeIndices[d[2]] || 0;
            const isHighlighted = selectedEpisodes.has(glyphEpisodeIdx);

            d3.select(this).selectAll('.start-glyph, .end-glyph')
                .attr('stroke-width', (isHighlighted ? 4 : 2) * glyphScale)
                .attr('stroke', isHighlighted ? '#C62828' : '#333333')
                .attr('filter', isHighlighted ? 'drop-shadow(0 0 6px #C62828)' : null)

        })
            // raise if highlighted
            .filter(function (d) {
                const glyphEpisodeIdx = episodeIndices[d[2]] || 0;
                return selectedEpisodes.has(glyphEpisodeIdx);
            })
            .raise();

        // Update cluster hull highlighting based on current feedback highlights
        try {
            const hl = feedbackHighlightsRef.current;
            if (hl && hl.clustersSignatures && hl.clustersSignatures.size > 0) {
                view.selectAll('.uncertainty-segment').each(function () {
                    const seg = d3.select(this);
                    const sig = seg.attr('data-cluster-sig');
                    const highlighted = !!sig && hl.clustersSignatures!.has(sig);
                    seg.select('.uncertainty-segment-hull')
                        .attr('stroke', highlighted ? clusterHullStyles.feedbackStroke : clusterHullStyles.defaultStroke)
                        .attr('stroke-width', highlighted ? clusterHullStyles.feedbackWidth : clusterHullStyles.defaultWidth)
                        .attr('opacity', highlighted ? clusterHullStyles.feedbackOpacity : clusterHullStyles.defaultOpacity);
                });
            } else {
                // reset to default
                view.selectAll('.uncertainty-segment-hull')
                    .attr('stroke', clusterHullStyles.defaultStroke)
                    .attr('stroke-width', clusterHullStyles.defaultWidth)
                    .attr('opacity', clusterHullStyles.defaultOpacity);
            }
        } catch (e) {
            // noop
        }

        const selectedCluster = selectedClusterRef.current;
        if (selectedCluster?.indices?.length) {
            const selectedSignature = buildClusterSignature(selectedCluster.indices);
            const highlightSet = feedbackHighlightsRef.current?.clustersSignatures;
            view.selectAll('.uncertainty-segment').each(function () {
                const seg = d3.select(this);
                if (seg.attr('data-cluster-sig') === selectedSignature) {
                    const isRated = !!highlightSet && highlightSet.has(selectedSignature);
                    const baseWidth = isRated ? clusterHullStyles.feedbackWidth : clusterHullStyles.defaultWidth;
                    seg.select('.uncertainty-segment-hull')
                        .attr('stroke-width', Math.max(clusterHullStyles.selectedWidth, baseWidth))
                        .attr('opacity', isRated ? clusterHullStyles.feedbackOpacity : clusterHullStyles.selectedOpacity);
                }
            });
        }
    }

    // Store the zoomed function reference for external calls
    zoomedFunctionRef.current = zoomed;

    // Expose a helper to fit an episode's bounding box into view
    fitEpisodeInViewRef.current = (episodeToFit: number) => {
        try {
            // gather points for the episode
            const pts = processedData.filter((_, i) => episodeIndices[i] === episodeToFit);
            if (!pts || pts.length === 0) return;

            const xs = pts.map((p: number[]) => p[0]);
            const ys = pts.map((p: number[]) => p[1]);
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
            view.attr('transform', t.toString());
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
};
