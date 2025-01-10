import React from 'react';
import { Typography, Box } from '@mui/material';
import { UIConfig } from '../../types';

type BackendConfigSequenceVisualizerProps = {
    uiCOnfigIds: string[];
    nrOfBatches: number;
    mode: string;
};

export function BackendConfigSequenceVisualizer(props: BackendConfigSequenceVisualizerProps) {

    const uiConfigs = props.uiCOnfigIds;

    // compute possible sequences of pairs with the given settings as text (max. nrOfExamples examples)
    const sequences: string[] = [];
    if (props.mode === 'sequential') {
        for (let i = 0; i < uiConfigs.length; i++) {
            const sequence: string[] = [];
            for (let j = 0; j < props.nrOfBatches; j++) {
                sequence.push(`(${uiConfigs[i]}, ${j})`);
            }
            sequences.push(sequence.join(', '));
        }
    } else if (props.mode === 'alternating') {
        for (let i = 0; i < props.nrOfBatches; i++) {
            const sequence: string[] = [];
            for (let j = 0; j < uiConfigs.length; j++) {
                sequence.push(`(${uiConfigs[j]}, ${i})`);
            }
            sequences.push(sequence.join(', '));
        }
    }

    return (
        <Box>
            <Typography variant="body1">
                Preview of Experiment Sequence
            </Typography>
            <Box mt={2} sx={{ borderRadius: 1, p: 1, bgcolor: 'grey.200' }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {sequences.join(' , ')}
                </Typography>
            </Box>
        </Box>
    );
}

export type SequenceElement = {
    uiConfig: { id: number; name: string };
    batch: number;
};

export function getConfigSequence(uiConfigs: UIConfig[], nrOfElements: number, mode: string): SequenceElement[] {
    const sequences: SequenceElement[] = [];

    if (uiConfigs.length === 0) {
        return sequences;
    }

    if (uiConfigs.length === 1) {
        // If there is only one uiConfig, we can just return the sequence for this one
        let remainingElements = nrOfElements;
        let batch_counter = 0;
        while (remainingElements > 0) {
            const uiConfig = uiConfigs[0];
            sequences.push({ uiConfig: { id: uiConfig.id, name: uiConfig.name }, batch: batch_counter } as SequenceElement);
            remainingElements -= uiConfig.max_ranking_elements;
            batch_counter++;
        }
        return sequences;
    }

    if (mode === 'sequential') {
        // Sequential means, we first do all elements for the first uiConfig, then for the second, etc.
        for (let i = 0; i < uiConfigs.length; i++) {
            let remainingElements = nrOfElements;
            let batch_counter = 0;
            while (remainingElements > 0) {
                const uiConfig = uiConfigs[i];
                sequences.push({ uiConfig: { id: uiConfig.id, name: uiConfig.name }, batch: batch_counter } as SequenceElement);
                remainingElements -= uiConfig.max_ranking_elements;
                batch_counter++;
            }
        }
    } else if (mode === 'alternating') {
        // Alternating means, we do one element for each uiConfig, then the next, etc.

        // start by initializing independent counters for each uiConfig
        let remainingElements = Array.from(uiConfigs, (uiConfig) => uiConfig.max_ranking_elements);
        let batch_counter = 0;
        while (remainingElements.some((e) => e > 0)) {
            for (let j = 0; j < uiConfigs.length; j++) {
                const uiConfig = uiConfigs[j];
                sequences.push({ uiConfig: {id: uiConfig.id, name: uiConfig.name}, batch: batch_counter } as SequenceElement);
                remainingElements[j] -= uiConfig.max_ranking_elements;
            }
            batch_counter++;
        }
    } else if (mode === 'random') {
        // Random means, we randomly shuffle the uiConfigs and then do the same as in sequential mode
        const shuffledConfigs = uiConfigs.sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffledConfigs.length; i++) {
            let remainingElements = nrOfElements;
            while (remainingElements > 0) {
                const uiConfig = shuffledConfigs[i];
                sequences.push({ uiConfig: {id: uiConfig.id, name: uiConfig.name}, batch: i } as SequenceElement);
                remainingElements -= uiConfig.max_ranking_elements;
            }
        }
    }

    return sequences;
}

