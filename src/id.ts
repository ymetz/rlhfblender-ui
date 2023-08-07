import {Episode} from './types';

function IDfromEpisode(episode: Episode): string {
  if (episode === undefined) {
    throw new Error('Episode is undefined');
  }
  const id = `${episode.env_name}_${episode.benchmark_type}_${episode.benchmark_id}_${episode.checkpoint_step}_${episode.episode_num}`;
  return id;
}

function EpisodeFromID(ID: string): Episode {
  if (ID === undefined) {
    throw new Error('ID is undefined');
  }
  const split = ID.split('_');
  return {
    env_name: split[0],
    benchmark_type: split[1],
    benchmark_id: parseInt(split[2]),
    checkpoint_step: parseInt(split[3]),
    episode_num: parseInt(split[4]),
  };
}

export {IDfromEpisode, EpisodeFromID};
