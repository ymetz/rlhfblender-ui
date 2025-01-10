import React from 'react';
import { Typography, Box, Stack } from '@mui/material';

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
    uiConfig: string;
    batch: number;
};

export function getConfigSequence(uiConfigs: string[], nrOfBatches: number, mode: string): SequenceElement[] {
    const sequences: SequenceElement[] = [];
    if (mode === 'sequential') {
        for (let i = 0; i < uiConfigs.length; i++) {
            for (let j = 0; j < nrOfBatches; j++) {
                sequences.push({ uiConfig: uiConfigs[i], batch: j } as SequenceElement);
            }
        }
    } else if (mode === 'alternating') {
        for (let i = 0; i < nrOfBatches; i++) {
            for (let j = 0; j < uiConfigs.length; j++) {
                sequences.push({ uiConfig: uiConfigs[j], batch: i } as SequenceElement);
            }
        }
    } else if (mode === 'random') {
        const shuffledConfigs = uiConfigs.sort(() => Math.random() - 0.5);
        for (let i = 0; i < nrOfBatches; i++) {
            for (let j = 0; j < shuffledConfigs.length; j++) {
                sequences.push({ uiConfig: shuffledConfigs[j], batch: i } as SequenceElement);
            }
        }
    } else {
        throw new Error('Invalid mode');
    }

    console.log("THE SEQUENCES ARE: ", sequences);

    return sequences;
}

