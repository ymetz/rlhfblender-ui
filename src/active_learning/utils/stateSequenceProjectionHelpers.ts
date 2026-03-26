import {
    TrajectorySegment,
    MergedSegment
} from '../types/stateSequenceProjectionTypes';

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
        Math.pow(seg1.points[seg1.points.length - 1][0] - seg2.points[seg2.points.length - 1][0], 2) +
        Math.pow(seg1.points[seg1.points.length - 1][1] - seg2.points[seg2.points.length - 1][1], 2)
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

type Point = [number, number];

const EPSILON = 1e-10;

function pointKey(point: Point): string {
    return `${point[0]}:${point[1]}`;
}

function dedupePoints(points: number[][]): Point[] {
    const seen = new Set<string>();
    const unique: Point[] = [];

    points.forEach(p => {
        const point = [p[0], p[1]] as Point;
        const key = pointKey(point);
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(point);
    });

    return unique;
}

function distance(a: Point, b: Point): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
}

function crossProduct(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function estimatePointSpacing(points: Point[]): number {
    if (points.length < 2) return 0.01;

    const maxSampleSize = 250;
    const stride = Math.max(1, Math.floor(points.length / maxSampleSize));
    const sampled = points.filter((_, index) => index % stride === 0);
    const nearestDistances: number[] = [];

    for (let i = 0; i < sampled.length; i++) {
        let nearest = Number.POSITIVE_INFINITY;
        for (let j = 0; j < sampled.length; j++) {
            if (i === j) continue;
            const d = distance(sampled[i], sampled[j]);
            if (d < nearest) nearest = d;
        }
        if (Number.isFinite(nearest) && nearest > EPSILON) {
            nearestDistances.push(nearest);
        }
    }

    const spacing = median(nearestDistances);
    return spacing > EPSILON ? spacing : 0.01;
}

function polygonSignedArea(points: Point[]): number {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        area += current[0] * next[1] - next[0] * current[1];
    }
    return area / 2;
}

function pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): { distance: number, t: number, cross: number } {
    const abx = segEnd[0] - segStart[0];
    const aby = segEnd[1] - segStart[1];
    const apx = point[0] - segStart[0];
    const apy = point[1] - segStart[1];
    const denom = abx * abx + aby * aby;

    if (denom <= EPSILON) {
        return { distance: distance(point, segStart), t: 0, cross: 0 };
    }

    const tRaw = (apx * abx + apy * aby) / denom;
    const t = Math.max(0, Math.min(1, tRaw));
    const projX = segStart[0] + t * abx;
    const projY = segStart[1] + t * aby;
    const dx = point[0] - projX;
    const dy = point[1] - projY;
    const perpDistance = Math.sqrt(dx * dx + dy * dy);

    return {
        distance: perpDistance,
        t,
        cross: crossProduct(segStart, segEnd, point)
    };
}

function onSegment(a: Point, b: Point, c: Point): boolean {
    return (
        Math.min(a[0], c[0]) - EPSILON <= b[0] && b[0] <= Math.max(a[0], c[0]) + EPSILON &&
        Math.min(a[1], c[1]) - EPSILON <= b[1] && b[1] <= Math.max(a[1], c[1]) + EPSILON
    );
}

function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
    const o1 = crossProduct(p1, p2, q1);
    const o2 = crossProduct(p1, p2, q2);
    const o3 = crossProduct(q1, q2, p1);
    const o4 = crossProduct(q1, q2, p2);

    if ((o1 > EPSILON && o2 < -EPSILON || o1 < -EPSILON && o2 > EPSILON) &&
        (o3 > EPSILON && o4 < -EPSILON || o3 < -EPSILON && o4 > EPSILON)) {
        return true;
    }

    if (Math.abs(o1) <= EPSILON && onSegment(p1, q1, p2)) return true;
    if (Math.abs(o2) <= EPSILON && onSegment(p1, q2, p2)) return true;
    if (Math.abs(o3) <= EPSILON && onSegment(q1, p1, q2)) return true;
    if (Math.abs(o4) <= EPSILON && onSegment(q1, p2, q2)) return true;

    return false;
}

function wouldCreateSelfIntersection(hull: Point[], edgeIndex: number, candidate: Point): boolean {
    const start = hull[edgeIndex];
    const end = hull[(edgeIndex + 1) % hull.length];

    for (let i = 0; i < hull.length; i++) {
        const edgeStart = hull[i];
        const edgeEnd = hull[(i + 1) % hull.length];

        // Skip the edge being split and its immediate neighbors.
        if (i === edgeIndex || i === (edgeIndex - 1 + hull.length) % hull.length || i === (edgeIndex + 1) % hull.length) {
            continue;
        }

        if (segmentsIntersect(start, candidate, edgeStart, edgeEnd)) return true;
        if (segmentsIntersect(candidate, end, edgeStart, edgeEnd)) return true;
    }

    return false;
}

function findBestSplitPoint(
    hull: Point[],
    allPoints: Point[],
    edgeIndex: number,
    orientationSign: number,
    pointSpacing: number
): Point | null {
    const start = hull[edgeIndex];
    const end = hull[(edgeIndex + 1) % hull.length];
    const edgeLength = distance(start, end);
    const minEndpointDistance = Math.max(pointSpacing * 0.5, edgeLength * 0.05);
    const maxDistanceToEdge = Math.max(pointSpacing * 2.2, edgeLength * 0.4);
    const preferredDistanceToEdge = Math.max(pointSpacing * 0.9, Math.min(pointSpacing * 1.8, edgeLength * 0.2));
    const maxPerimeterIncreaseRatio = 1.5;

    let bestCandidate: Point | null = null;
    let bestScore = -Infinity;

    allPoints.forEach(point => {
        if ((point[0] === start[0] && point[1] === start[1]) || (point[0] === end[0] && point[1] === end[1])) {
            return;
        }

        const distStart = distance(point, start);
        const distEnd = distance(point, end);
        if (distStart < minEndpointDistance || distEnd < minEndpointDistance) return;
        if ((distStart + distEnd) / edgeLength > maxPerimeterIncreaseRatio) return;

        const stats = pointToSegmentDistance(point, start, end);
        if (stats.t <= 0.08 || stats.t >= 0.92) return;
        if (stats.distance <= pointSpacing * 0.2 || stats.distance > maxDistanceToEdge) return;

        // Keep points that lie on the interior side of the directed edge.
        if (orientationSign * stats.cross <= pointSpacing * 0.01) return;

        if (wouldCreateSelfIntersection(hull, edgeIndex, point)) return;

        // Favor balanced, moderate-depth splits to avoid cutting too far into clusters.
        const balance = 1 - Math.abs(0.5 - stats.t) * 2;
        const depthPenalty = Math.abs(stats.distance - preferredDistanceToEdge);
        const score = balance * pointSpacing * 1.2 - depthPenalty;

        if (score > bestScore) {
            bestScore = score;
            bestCandidate = point;
        }
    });

    return bestCandidate;
}

function simplifyHull(points: Point[], pointSpacing: number): Point[] {
    if (points.length <= 3) return points;

    const minEdgeLength = pointSpacing * 0.25;
    const simplified = points.slice();

    let changed = true;
    while (changed && simplified.length > 3) {
        changed = false;
        for (let i = 0; i < simplified.length; i++) {
            const prev = simplified[(i - 1 + simplified.length) % simplified.length];
            const current = simplified[i];
            const next = simplified[(i + 1) % simplified.length];

            const prevEdge = distance(prev, current);
            const nextEdge = distance(current, next);
            const span = distance(prev, next);

            if (prevEdge < minEdgeLength || nextEdge < minEdgeLength) {
                simplified.splice(i, 1);
                changed = true;
                break;
            }

            const area2 = Math.abs(crossProduct(prev, current, next));
            const signedHeight = span > EPSILON ? area2 / span : 0;
            if (signedHeight < minEdgeLength * 0.15) {
                simplified.splice(i, 1);
                changed = true;
                break;
            }
        }
    }

    return simplified;
}

function expandPolygon(points: Point[], offset: number): Point[] {
    if (points.length < 3 || offset <= 0) return points.slice();

    const area = polygonSignedArea(points);
    const ccw = area >= 0;

    return points.map((current, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];

        const e1x = current[0] - prev[0];
        const e1y = current[1] - prev[1];
        const e2x = next[0] - current[0];
        const e2y = next[1] - current[1];

        const len1 = Math.sqrt(e1x * e1x + e1y * e1y);
        const len2 = Math.sqrt(e2x * e2x + e2y * e2y);
        if (len1 <= EPSILON || len2 <= EPSILON) return current;

        const u1x = e1x / len1;
        const u1y = e1y / len1;
        const u2x = e2x / len2;
        const u2y = e2y / len2;

        const n1x = ccw ? u1y : -u1y;
        const n1y = ccw ? -u1x : u1x;
        const n2x = ccw ? u2y : -u2y;
        const n2y = ccw ? -u2x : u2x;

        let nx = n1x + n2x;
        let ny = n1y + n2y;
        let nLen = Math.sqrt(nx * nx + ny * ny);

        if (nLen <= EPSILON) {
            nx = n1x;
            ny = n1y;
            nLen = Math.sqrt(nx * nx + ny * ny);
            if (nLen <= EPSILON) return current;
        }

        nx /= nLen;
        ny /= nLen;

        // Mild miter correction avoids huge spikes on sharp corners.
        const miterDot = Math.abs(nx * n1x + ny * n1y);
        const miterScale = Math.min(2.5, 1 / Math.max(0.35, miterDot));

        return [current[0] + nx * offset * miterScale, current[1] + ny * offset * miterScale] as Point;
    });
}

// Calculate convex hull using Andrew's monotone chain algorithm.
function calculateConvexHull(points: number[][]): Point[] {
    const uniquePoints = dedupePoints(points);
    if (uniquePoints.length < 3) return uniquePoints;

    const sorted = uniquePoints
        .slice()
        .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

    const lower: Point[] = [];
    sorted.forEach(point => {
        while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
            lower.pop();
        }
        lower.push(point);
    });

    const upper: Point[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const point = sorted[i];
        while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
            upper.pop();
        }
        upper.push(point);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

function calculateSimpleConcaveHull(points: number[][], maxEdgeLength?: number): Point[] {
    const uniquePoints = dedupePoints(points);
    if (uniquePoints.length < 3) return uniquePoints;

    const convexHull = calculateConvexHull(uniquePoints);
    if (convexHull.length < 3) return convexHull;

    const pointSpacing = estimatePointSpacing(uniquePoints);
    const hullEdgeLengths = convexHull.map((point, i) => distance(point, convexHull[(i + 1) % convexHull.length]));
    const medianHullEdgeLength = median(hullEdgeLengths);
    const edgeThreshold = maxEdgeLength !== undefined
        ? maxEdgeLength
        : Math.max(pointSpacing * 4, medianHullEdgeLength * 1.35);

    const hull = convexHull.slice();
    const hullPointSet = new Set(hull.map(pointKey));
    const candidatePoints = uniquePoints.filter(point => !hullPointSet.has(pointKey(point)));

    const maxIterations = Math.min(1200, uniquePoints.length * 4);
    const orientationSign = Math.sign(polygonSignedArea(hull)) || 1;

    let changed = true;
    let iterations = 0;

    while (changed && iterations < maxIterations) {
        iterations += 1;
        changed = false;

        for (let i = 0; i < hull.length; i++) {
            const edgeLength = distance(hull[i], hull[(i + 1) % hull.length]);
            if (edgeLength <= edgeThreshold) continue;

            const bestSplitPoint = findBestSplitPoint(hull, candidatePoints, i, orientationSign, pointSpacing);
            if (!bestSplitPoint) continue;

            hull.splice(i + 1, 0, bestSplitPoint);
            const candidateIndex = candidatePoints.findIndex(
                point => point[0] === bestSplitPoint[0] && point[1] === bestSplitPoint[1]
            );
            if (candidateIndex !== -1) {
                candidatePoints.splice(candidateIndex, 1);
            }

            changed = true;
            break;
        }
    }

    const simplifiedHull = simplifyHull(hull, pointSpacing);
    const expansionDistance = Math.max(pointSpacing * 0.35, Math.min(pointSpacing * 1.2, edgeThreshold * 0.12));

    return expandPolygon(simplifiedHull, expansionDistance);
}

export {
    extractSegments,
    calculateConvexHull,
    calculateSimpleConcaveHull,
    mergeSegments,
} 
