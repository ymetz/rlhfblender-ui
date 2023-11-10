import * as React from 'react';
import {Bar} from '@visx/shape';
import {Group} from '@visx/group';
import {scaleBand, scaleLinear} from '@visx/scale';
import {AxisBottom, AxisLeft} from '@visx/axis';

export type BarsProps = {
  width: number;
  height: number;
  events?: boolean;
  action?: number;
  distribution?: number[];
  actionSpace: object;
};

const verticalMargin = 50;

export default function Categorical({
  width,
  height,
  events = false,
  action,
  distribution,
  actionSpace,
}: BarsProps) {
  // bounds
  const xMax = width;
  const yMax = height - verticalMargin;

  // scales, memoize for performance
  const xScale = React.useMemo(
    () =>
      scaleBand<number>({
        range: [0, xMax],
        round: true,
        domain: distribution?.map((d, i) => i) ?? [],
        padding: 0.4,
      }),
    [xMax, distribution]
  );
  const yScale = React.useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        round: true,
        domain: [0, 1.0],
      }),
    [yMax]
  );

  return width < 10 ? null : (
    <svg width={width} height={height}>
      <rect width={width} height={height} fill="url(#teal)" rx={14} />
      <Group top={verticalMargin / 2}>
        <AxisBottom top={yMax + 5} scale={xScale} />
        <AxisLeft scale={yScale} />
        {distribution?.map((d, i) => {
          const barHeight = yMax - (yScale(d) ?? 0);
          return (
            <Bar
              key={
                Object.hasOwnProperty.call(actionSpace, 'tag_' + i)
                  ? actionSpace[('tag_' + i) as keyof typeof actionSpace]
                  : i
              }
              x={xScale(i)}
              y={yMax - barHeight}
              width={xScale.bandwidth()}
              height={barHeight}
              fill={
                i === action
                  ? 'rgba(245, 24, 16, 0.8)'
                  : 'rgba(50, 150, 217, .8)'
              }
              onClick={() => {
                if (events)
                  alert(`clicked: ${JSON.stringify(Object.values(d))}`);
              }}
            />
          );
        })}
      </Group>
    </svg>
  );
}
