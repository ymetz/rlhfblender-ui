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

function calculateSimpleConcaveHull(points: number[][], maxEdgeLength?: number): [number, number][] {
    if (points.length < 3) return points.map(p => [p[0], p[1]] as [number, number]);
    
    // Calculate threshold - always assign a definite value
    let edgeThreshold: number;
    if (maxEdgeLength !== undefined) {
        edgeThreshold = maxEdgeLength;
    } else {
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
        edgeThreshold = (totalDistance / count) * 2; // 2x average distance
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
        if (edgeLength > edgeThreshold) {
            const intermediatePoints = points.filter(p => {
                const distToCurrent = Math.sqrt(Math.pow(p[0] - current[0], 2) + Math.pow(p[1] - current[1], 2));
                const distToNext = Math.sqrt(Math.pow(p[0] - next[0], 2) + Math.pow(p[1] - next[1], 2));
                
                // Point should be closer to the edge than the edge length threshold
                return distToCurrent < edgeThreshold && distToNext < edgeThreshold && 
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

export {
    extractSegments,
    calculateConvexHull,
    calculateSimpleConcaveHull,
    mergeSegments,
} 