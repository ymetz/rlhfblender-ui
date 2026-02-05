import React, { useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';
import { FeedbackHistoryEntry } from '../ActiveLearningContext';

interface FeedbackWaterfallChartProps {
  feedbackHistory: FeedbackHistoryEntry[];
  title?: string;
  baselineUncertainty?: number;
}

const FeedbackWaterfallChart: React.FC<FeedbackWaterfallChartProps> = ({
  feedbackHistory,
  title = "Feedback Impact on Uncertainty",
  baselineUncertainty = 0
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !feedbackHistory.length) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const width = 500 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate cumulative uncertainty changes
    let cumulativeUncertainty = baselineUncertainty;
    const waterfallData: Array<{
      type: string;
      label: string;
      value: number;
      cumulative: number;
      feedbackType?: string;
    }> = [
      { type: 'baseline', label: 'Baseline', value: baselineUncertainty, cumulative: baselineUncertainty }
    ];

    feedbackHistory.forEach((entry, index) => {
      cumulativeUncertainty += entry.uncertaintyEffect;
      waterfallData.push({
        type: 'feedback',
        label: `${entry.type.slice(0, 4)}${index + 1}`,
        value: entry.uncertaintyEffect,
        cumulative: cumulativeUncertainty,
        feedbackType: entry.type
      });
    });

    // Add final total
    waterfallData.push({
      type: 'total',
      label: 'Current',
      value: cumulativeUncertainty - baselineUncertainty,
      cumulative: cumulativeUncertainty
    });

    // Set up scales
    const xScale = d3.scaleBand()
      .domain(waterfallData.map(d => d.label))
      .range([0, width])
      .padding(0.2);

    const yExtent = d3.extent([...waterfallData.map(d => d.cumulative), 0]) as [number, number];
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .nice()
      .range([height, 0]);

    // Color scale for feedback types
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['Rating', 'Comparison', 'Correction', 'Demo', 'Cluster'])
      .range(['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336']);

    // Draw bars and markers
    waterfallData.forEach((d, i) => {
      const prevCumulative = i > 0 ? waterfallData[i - 1].cumulative : baselineUncertainty;

      let barHeight = 0;
      let barY = yScale(d.cumulative);
      let barColor = '#666';
      let barStroke = '#fff';
      let barStrokeWidth = 1;
      let barDasharray: string | null = null;
      let isDecrease = false;
      let isIncrease = false;

      if (d.type === 'baseline') {
        barHeight = Math.abs(yScale(0) - yScale(d.cumulative));
        barY = yScale(d.cumulative);
        barColor = '#999';
      } else if (d.type === 'feedback') {
        barHeight = Math.abs(yScale(prevCumulative) - yScale(d.cumulative));
        if (d.value > 0) {
          barY = yScale(d.cumulative);
          barColor = 'rgba(244, 67, 54, 0.7)';
          isIncrease = true;
        } else {
          barY = yScale(prevCumulative);
          barColor = 'rgba(76, 175, 80, 0.7)';
          isDecrease = true;
        }
      } else if (d.type === 'total') {
        barStroke = 'rgba(120, 120, 120, 0.9)';
        barStrokeWidth = 1.5;
        barDasharray = '4,2';
      }

      const barGroup = svg.append('g');

      if (d.type === 'total') {
        const xBand = xScale(d.label)!;
        const lineXStart = xBand + xScale.bandwidth() * 0.15;
        const lineXEnd = xBand + xScale.bandwidth() * 0.85;
        const lineY = yScale(d.cumulative);

        barGroup.append('line')
          .attr('x1', lineXStart)
          .attr('x2', lineXEnd)
          .attr('y1', lineY)
          .attr('y2', lineY)
          .attr('stroke', barStroke)
          .attr('stroke-width', barStrokeWidth)
          .attr('stroke-dasharray', barDasharray ?? null);

        barGroup.append('circle')
          .attr('cx', (lineXStart + lineXEnd) / 2)
          .attr('cy', lineY)
          .attr('r', 3)
          .attr('fill', '#fff')
          .attr('stroke', barStroke)
          .attr('stroke-width', 1);
      } else {
        const rect = barGroup.append('rect')
          .attr('x', xScale(d.label)!)
          .attr('y', barY)
          .attr('width', xScale.bandwidth())
          .attr('height', barHeight)
          .attr('fill', barColor)
          .attr('stroke', barStroke)
          .attr('stroke-width', barStrokeWidth);

        if (barDasharray) {
          rect.attr('stroke-dasharray', barDasharray);
        }
      }

      if (d.type === 'feedback' && d.feedbackType) {
        const circleY = isDecrease
          ? barY - 3
          : barY + barHeight + 3;
        const circleColor = colorScale(d.feedbackType);

        barGroup.append('circle')
          .attr('cx', xScale(d.label)! + xScale.bandwidth() / 2)
          .attr('cy', circleY)
          .attr('r', 4)
          .attr('fill', circleColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
      }

      let labelY;
      if (d.type === 'feedback') {
        labelY = isIncrease ? barY - 8 : barY + barHeight + 12;
      } else {
        labelY = barY - 8;
      }

      const labelValue = d.type === 'total' ? d.cumulative : d.value;

      svg.append('text')
        .attr('x', xScale(d.label)! + xScale.bandwidth() / 2)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(labelValue.toFixed(2));
    });

    // Draw connecting lines between bars
    for (let i = 1; i < waterfallData.length - 1; i++) {
      const currentBar = waterfallData[i];
      const nextBar = waterfallData[i + 1];
      
      const x1 = xScale(currentBar.label)! + xScale.bandwidth();
      const x2 = xScale(nextBar.label)!;
      const y = yScale(currentBar.cumulative);

      svg.append('line')
        .attr('x1', x1)
        .attr('x2', x2)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', '#ddd')
        .attr('stroke-dasharray', '2,2')
        .attr('stroke-width', 1);
    }

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('font-size', '8px');

    svg.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => (d as number).toFixed(2)))
      .selectAll('text')
      .attr('font-size', '8px');

  }, [feedbackHistory, baselineUncertainty]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        {title}
      </Typography>
      <Box ref={chartRef} sx={{ flex: 1, minHeight: 0 }} />
      {feedbackHistory.length === 0 && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: 'text.secondary'
        }}>
          <Typography variant="body2">
            No feedback history available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FeedbackWaterfallChart;
