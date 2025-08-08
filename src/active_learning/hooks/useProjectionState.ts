import { useState, useRef, useEffect } from 'react';
import { SelectedState, SelectedCoordinate, SelectedCluster } from '../types/projectionTypes';

export function useProjectionState() {
    // Component state variables
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTrajectory, setSelectedTrajectory] = useState<number | null>(null);
    const [selectedState, setSelectedState] = useState<SelectedState | null>(null);
    const [selectedCoordinate, setSelectedCoordinate] = useState<SelectedCoordinate>({ x: null, y: null });
    const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);
    const [hoveredEpisode, setHoveredEpisode] = useState<number | null>(null);
    const [clickedEpisode, setClickedEpisode] = useState<number | null>(null);
    const [selectedStateFrameUrl, setSelectedStateFrameUrl] = useState<string | null>(null);
    const [segmentSize, setSegmentSize] = useState(50);
    const [maxUncertaintySegments, setMaxUncertaintySegments] = useState(10);
    const [segmentError, setSegmentError] = useState<string | null>(null);
    const [trajectoryColors, setTrajectoryColors] = useState(new Map<number, string>());
    const [minMaxScale, setMinMaxScale] = useState<[number, number] | null>(null);

    // Refs for accessing current state in callbacks
    const selectedTrajectoryRef = useRef<number | null>(null);
    const selectedStateRef = useRef<SelectedState | null>(null);
    const selectedCoordinateRef = useRef<SelectedCoordinate>();
    const selectedClusterRef = useRef<SelectedCluster | null>(null);

    // Keep refs in sync with state
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

    const clearSelections = () => {
        setSelectedTrajectory(null);
        setSelectedState(null);
        setSelectedCoordinate({ x: null, y: null });
        setSelectedCluster(null);
        setClickedEpisode(null);
        setSelectedStateFrameUrl(null);
    };

    return {
        // State
        isLoading,
        error,
        selectedTrajectory,
        selectedState,
        selectedCoordinate,
        selectedCluster,
        hoveredEpisode,
        clickedEpisode,
        selectedStateFrameUrl,
        segmentSize,
        maxUncertaintySegments,
        segmentError,
        trajectoryColors,
        minMaxScale,

        // Setters
        setIsLoading,
        setError,
        setSelectedTrajectory,
        setSelectedState,
        setSelectedCoordinate,
        setSelectedCluster,
        setHoveredEpisode,
        setClickedEpisode,
        setSelectedStateFrameUrl,
        setSegmentSize,
        setMaxUncertaintySegments,
        setSegmentError,
        setTrajectoryColors,
        setMinMaxScale,

        // Refs
        selectedTrajectoryRef,
        selectedStateRef,
        selectedCoordinateRef,
        selectedClusterRef,

        // Actions
        clearSelections,
    };
}