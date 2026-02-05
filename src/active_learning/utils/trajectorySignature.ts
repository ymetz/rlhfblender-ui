import { UserDemoTrajectory } from '../../ActiveLearningContext';

export const computeUserTrajectorySignature = (trajectories: UserDemoTrajectory[]): string =>
    trajectories
        .map((trajectory) => {
            const length = trajectory.projection ? trajectory.projection.length : 0;
            const color = trajectory.metadata?.color ?? '';
            return `${trajectory.id}:${length}:${color}`;
        })
        .join('|');
