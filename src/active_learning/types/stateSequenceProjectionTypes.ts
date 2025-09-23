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

interface SelectedState {
    episode: number | null;
    step: number | null;
    coords: [number, number];
    x: number;
    y: number;
    index: number;
}

interface SelectedCoordinate {
    x: number | null;
    y: number | null;
}

interface SelectedCluster {
    label: string;
    indices: number[];
}

interface SelectionItem {
    type: "trajectory" | "cluster" | "coordinate" | "state" | "user_demo";
    data: any;
    label?: string;
}

export type {
    TrajectorySegment,
    MergedSegment,
    SelectedState,
    SelectedCoordinate,
    SelectedCluster,
    SelectionItem
};
