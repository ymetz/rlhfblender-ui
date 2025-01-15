import React from 'react';
import { Typography, Box } from '@mui/material';
import { UIConfig, SequenceElement } from '../../types';

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

export function getConfigSequence(uiConfigs: UIConfig[], nrOfElements: number, mode: string): SequenceElement[] {
    const sequences: SequenceElement[] = [];

    if (uiConfigs.length === 0) {
        return sequences;
    }

    if (mode === 'sequential') {
        // Sequential means, we first do all elements for the first uiConfig, then for the second, etc.
        for (let i = 0; i < uiConfigs.length; i++) {
            let episode_counter = 0;
            while (episode_counter < nrOfElements) {
                const uiConfig = uiConfigs[i];
                const batchSize = parseInt(String(uiConfig?.max_ranking_elements) || '0') as number;
                const currentEpisodeCounter = episode_counter;
                let elementsInBatch = Array.from({ length: batchSize }, (_, k) => currentEpisodeCounter + k).filter((e) => e < nrOfElements);
                sequences.push({ uiConfig: { id: uiConfig.id, name: uiConfig.name }, batch: elementsInBatch } as SequenceElement);
                episode_counter += batchSize;
            }
        }
    } else if (mode === 'alternating') {
        // Alternating means, we do one element for each uiConfig, then the next, etc.
        let episode_counters = Array.from(uiConfigs, () => 0);
        while (episode_counters.some((e) => e < nrOfElements)) {
            for (let j = 0; j < uiConfigs.length; j++) {
                if (episode_counters[j] >= nrOfElements) {
                    continue;
                }
                const uiConfig = uiConfigs[j];
                const batchSize: number = parseInt(String(uiConfig?.max_ranking_elements) || '0') as number;
                const currentEpisodeCounter = episode_counters[j];
                let elementsInBatch = Array.from({ length: batchSize }, (_, k) => currentEpisodeCounter + k).filter((e) => e < nrOfElements);
                sequences.push({ uiConfig: { id: uiConfig.id, name: uiConfig.name }, batch: elementsInBatch } as SequenceElement);
                episode_counters[j] += batchSize;
            }
        }
    } else if (mode === 'random') {
        // Random means, we randomly shuffle the uiConfigs and then do the same as in sequential mode
        const shuffledConfigs = uiConfigs.sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffledConfigs.length; i++) {
            let episode_counter = 0;
            while (episode_counter < nrOfElements) {
                const uiConfig = shuffledConfigs[i];
                const batchSize = parseInt(String(uiConfig?.max_ranking_elements) || '0') as number;
                const currentEpisodeCounter = episode_counter;
                let elementsInBatch = Array.from({ length: batchSize }, (_, k) => currentEpisodeCounter + k).filter((e) => e < nrOfElements);
                sequences.push({ uiConfig: { id: uiConfig.id, name: uiConfig.name }, batch: elementsInBatch } as SequenceElement);
                episode_counter += batchSize;
            }
        }
    }

    return sequences;
}

