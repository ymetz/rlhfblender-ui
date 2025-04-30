import React from 'react';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import StateSequenceProjection from './StateSequenceProjection';
import { useAppState } from '../AppStateContext';

// Wrapper component to connect Evaluation_Embedding to the new context
const ProjectionComponent = (props) => {
    const activeLearningState = useActiveLearningState();
    const activeLearningDispatch = useActiveLearningDispatch();
    const appState = useAppState();

    // Map the global state to props that the component expects
    const mappedProps = {
        ...props,
        // Map global state to expected props
        viewMode: activeLearningState.viewMode,
        annotationMode: activeLearningState.annotationMode,
        embeddingMethod: activeLearningState.embeddingMethod,
        infoTypes: activeLearningState.infoTypes,
        // Add methods to update global state
        setViewMode: (mode, callback) => {
            activeLearningDispatch({ type: 'SET_VIEW_MODE', payload: mode });
            if (callback) callback();
        },
        setAnnotationMode: (mode, callback) => {
            activeLearningDispatch({ type: 'SET_ANNOTATION_MODE', payload: mode });
            if (callback) callback();
        },
        highlightIndices: (indices) => {
            // Convert indices to boolean array
            const highlightedPoints = new Array(activeLearningState.embeddingData.length).fill(false);
            indices.forEach(index => { highlightedPoints[index] = true; });
            activeLearningDispatch({ type: 'SET_HIGHLIGHTED_POINTS', payload: highlightedPoints });
        },
        benchmarkId: appState.selectedExperiment.id,
        checkpointStep: appState.selectedCheckpoint,
    };

    // update mappedProps when benchmarkId or checkpointStep changes
    React.useEffect(() => {
        mappedProps.benchmarkId = appState.selectedExperiment.id;
        mappedProps.checkpointStep = appState.selectedCheckpoint;
    }
    , [appState.selectedExperiment.id, appState.selectedCheckpoint]);
    
    return <StateSequenceProjection {...mappedProps} />;
};


export default ProjectionComponent;