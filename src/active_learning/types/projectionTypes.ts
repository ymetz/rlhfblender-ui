// Types and interfaces for StateSequenceProjection

export interface TrajectorySegment {
    id: string;
    episodeIdx: number;
    startIdx: number;
    endIdx: number;
    points: number[][];
    centroid: [number, number];
    similarity?: number;
}

export interface MergedSegment {
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

export interface SelectedState {
    episode: number | null;
    step: number | null;
    coords: [number, number];
    x: number;
    y: number;
    index: number;
}

export interface SelectedCoordinate {
    x: number | null;
    y: number | null;
}

export interface SelectedCluster {
    label: string;
    indices: number[];
}

export interface SelectionItem {
    type: "trajectory" | "cluster" | "coordinate" | "state";
    data: any;
    label?: string;
}

export interface GridData {
    prediction_image: string | null;
    uncertainty_image: string | null;
    bounds: {
        x_min: number;
        x_max: number;
        y_min: number;
        y_max: number;
        min_val: number;
        max_val: number;
    } | null;
}

export interface ProjectionProps {
    benchmarkId: string;
    checkpointStep: number;
    embeddingMethod: string;
    reproject: boolean;
    appendTimestamp: boolean;
    embeddingSettings: any;
    benchmarkedModels: any[];
    infos?: any[];
    timeStamp: number;
    setHoverStep?: (info: any) => void;
}