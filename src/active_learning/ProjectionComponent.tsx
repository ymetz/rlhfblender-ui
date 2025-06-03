import React from 'react';
import { useActiveLearningState } from '../ActiveLearningContext';
import StateSequenceProjection from './StateSequenceProjection';
import { useAppState } from '../AppStateContext';

// Wrapper component to connect StateSequenceProjection to the new context
const ProjectionComponent = (props) => {
    const activeLearningState = useActiveLearningState();
    const appState = useAppState();

    // Map the global state to props that the component expects
    // Include benchmarkId and checkpointStep directly in the mappedProps
    const mappedProps = {
        ...props,
        // Map global state to expected props
        viewMode: activeLearningState.viewMode,
        annotationMode: activeLearningState.annotationMode,
        embeddingMethod: activeLearningState.embeddingMethod,
        infoTypes: activeLearningState.infoTypes,
        benchmarkId: appState.selectedExperiment.id,
        checkpointStep: appState.selectedCheckpoint,
        // Add methods to update global state
        setViewMode: () => {},
        setAnnotationMode: () => {},
        highlightIndices: [],
    };
    
    return <StateSequenceProjection {...mappedProps} />;
};

export default ProjectionComponent;