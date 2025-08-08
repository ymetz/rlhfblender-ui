import { useEffect } from 'react';
import { useAppState } from '../../AppStateContext';
import { SelectedState, ProjectionProps } from '../types/projectionTypes';

export function useFrameLoading(
    selectedState: SelectedState | null,
    props: ProjectionProps,
    setSelectedStateFrameUrl: (url: string | null) => void
) {
    const appState = useAppState();

    useEffect(() => {
        if (selectedState && selectedState.episode !== null && selectedState.step !== null) {
            const matchingEpisode = appState.episodeIDsChronologically.find(episode => {
                return String(episode.benchmark_id) === String(props.benchmarkId) &&
                    Number(episode.checkpoint_step) === Number(props.checkpointStep) &&
                    Number(episode.episode_num) === Number(selectedState.episode);
            });

            if (matchingEpisode) {
                // Fetch frame using get_cluster_frames endpoint
                const fetchFrame = async () => {
                    try {
                        console.log(`Fetching frame for episode ${selectedState.episode}, step ${selectedState.step}`);
                        const response = await fetch('/data/get_cluster_frames', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                cluster_indices: [selectedState.step], // Single step within episode
                                episode_data: [{
                                    env_name: matchingEpisode.env_name,
                                    benchmark_id: matchingEpisode.benchmark_id,
                                    checkpoint_step: matchingEpisode.checkpoint_step,
                                    episode_num: matchingEpisode.episode_num,
                                }],
                                max_states_to_show: 1
                            }),
                        });
                        
                        if (response.ok) {
                            const frameImages = await response.json();
                            console.log(`Received frame image:`, frameImages[0] ? `${frameImages[0].substring(0, 50)}...` : 'null');
                            setSelectedStateFrameUrl(frameImages[0] || null);
                        } else {
                            console.error(`Failed to fetch frame: ${response.status} ${response.statusText}`);
                            setSelectedStateFrameUrl(null);
                        }
                    } catch (error) {
                        console.error('Error fetching state frame:', error);
                        setSelectedStateFrameUrl(null);
                    }
                };
                
                fetchFrame();
            } else {
                console.log('No matching episode found for frame loading');
                setSelectedStateFrameUrl(null);
            }
        } else {
            setSelectedStateFrameUrl(null);
        }
    }, [selectedState, appState.episodeIDsChronologically, props.benchmarkId, props.checkpointStep, setSelectedStateFrameUrl]);
}