import React from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateIcon from '@mui/icons-material/Create';
import { useActiveLearningState, useActiveLearningDispatch } from '../../ActiveLearningContext';
import { SelectionItem, SelectedState, SelectedCluster, SelectedCoordinate } from '../types/projectionTypes';

interface ActionButtonsProps {
    isLoading: boolean;
    selectedTrajectoryRef: React.MutableRefObject<number | null>;
    selectedStateRef: React.MutableRefObject<SelectedState | null>;
    selectedClusterRef: React.MutableRefObject<SelectedCluster | null>;
    selectedCoordinateRef: React.MutableRefObject<SelectedCoordinate | undefined>;
    setSelectedState: (state: SelectedState | null) => void;
    setSelectedStateFrameUrl: (url: string | null) => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    isLoading,
    selectedTrajectoryRef,
    selectedStateRef,
    selectedClusterRef,
    selectedCoordinateRef,
    setSelectedState,
    setSelectedStateFrameUrl,
}) => {
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();

    const handleClearSelection = () => {
        activeLearningDispatch({
            type: 'SET_SELECTION',
            payload: []
        });
        setSelectedState(null);
        setSelectedStateFrameUrl(null);
    };

    const handleAddToSelection = () => {
        const selectedTrajectory = selectedTrajectoryRef.current;
        const selectedCluster = selectedClusterRef.current;
        const selectedCoordinate = selectedCoordinateRef.current;

        const combinedSelection: SelectionItem[] = [];
        if (selectedTrajectory !== null && selectedTrajectory !== undefined) {
            combinedSelection.push({ type: "trajectory", data: selectedTrajectory });
        }
        else if (selectedCluster) {
            combinedSelection.push({ type: "cluster", data: selectedCluster.indices, label: selectedCluster.label });
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
    };

    const handleMarkToCorrect = () => {
        const selectedState = selectedStateRef.current;

        const combinedSelection: SelectionItem[] = [];
        if (selectedState) {
            combinedSelection.push({ type: "state", data: selectedState });
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
    };

    return (
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
                        backgroundColor: 'rgba(185, 185, 185, 0.7)',
                        '&:hover': { backgroundColor: 'rgba(185, 185, 185, 0.9)' }
                    }}
                    onClick={handleClearSelection}
                >
                    <DeleteIcon />
                </IconButton>
            </Tooltip>

            <Tooltip title="Add to Selection">
                <IconButton
                    color="default"
                    sx={{
                        backgroundColor: 'rgba(185, 185, 185, 0.7)',
                        '&:hover': { backgroundColor: 'rgba(185, 185, 185, 0.9)' }
                    }}
                    onClick={handleAddToSelection}
                >
                    <AddIcon />
                </IconButton>
            </Tooltip>

            <Tooltip title="Mark to Correct/Generate">
                <IconButton
                    color="default"
                    sx={{
                        backgroundColor: 'rgba(185, 185, 185, 0.7)',
                        '&:hover': { backgroundColor: 'rgba(185, 185, 185, 0.9)' }
                    }}
                    onClick={handleMarkToCorrect}
                >
                    <CreateIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};