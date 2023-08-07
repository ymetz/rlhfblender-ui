import {Episode} from './types';

const initialEpisodes: Episode[] = [
  {
    env_name: 'BreakoutNoFrameskip-v4',
    benchmark_type: 'trained',
    benchmark_id: 1,
    checkpoint_step: 1000000,
    episode_num: 0,
  },
  {
    env_name: 'BreakoutNoFrameskip-v4',
    benchmark_type: 'trained',
    benchmark_id: 1,
    checkpoint_step: 2000000,
    episode_num: 1,
  },
  {
    env_name: 'BreakoutNoFrameskip-v4',
    benchmark_type: 'trained',
    benchmark_id: 1,
    checkpoint_step: 3000000,
    episode_num: 2,
  },
  {
    env_name: 'BreakoutNoFrameskip-v4',
    benchmark_type: 'trained',
    benchmark_id: 1,
    checkpoint_step: 4000000,
    episode_num: 3,
  },
  {
    env_name: 'BreakoutNoFrameskip-v4',
    benchmark_type: 'trained',
    benchmark_id: 1,
    checkpoint_step: 5000000,
    episode_num: 4,
  },
];

export default initialEpisodes;
