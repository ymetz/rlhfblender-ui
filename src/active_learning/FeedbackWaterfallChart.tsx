import React, { useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';
import { FeedbackHistoryEntry } from '../ActiveLearningContext';

const UNCERTAINTY_DECREASE_COLOR = 'rgba(46, 83, 125, 0.72)';
const UNCERTAINTY_DECREASE_COLOR_SELECTED = 'rgba(46, 83, 125, 1)';
const UNCERTAINTY_INCREASE_COLOR = 'rgba(198, 40, 40, 0.72)';
const UNCERTAINTY_INCREASE_COLOR_SELECTED = 'rgba(198, 40, 40, 1)';

interface FeedbackWaterfallChartProps {
  feedbackHistory: FeedbackHistoryEntry[];
  title?: string;
  baselineUncertainty?: number;
  selectedId?: string | null;
  onSelectFeedback?: (id: string | null) => void;
}

const FeedbackWaterfallChart: React.FC<FeedbackWaterfallChartProps> = ({
  feedbackHistory,
  title = "Feedback Impact on Uncertainty",
  baselineUncertainty = 0,
  selectedId = null,
  onSelectFeedback,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !feedbackHistory.length) return;

    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const containerWidth = chartRef.current.clientWidth || 500;
    const containerHeight = chartRef.current.clientHeight || 250;
    const width = Math.max(200, containerWidth - margin.left - margin.right);
    const height = Math.max(100, containerHeight - margin.top - margin.bottom);

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Build waterfall data — carry entry id through for linking
    let cumulativeUncertainty = baselineUncertainty;
    const waterfallData: Array<{
      type: 'baseline' | 'feedback' | 'total';
      label: string;
      value: number;
      cumulative: number;
      feedbackType?: string;
      entryId?: string;
    }> = [
      { type: 'baseline', label: 'Baseline', value: baselineUncertainty, cumulative: baselineUncertainty },
    ];

    feedbackHistory.forEach((entry, index) => {
      cumulativeUncertainty += entry.uncertaintyEffect;
      waterfallData.push({
        type: 'feedback',
        label: `${entry.type.slice(0, 4)}${index + 1}`,
        value: entry.uncertaintyEffect,
        cumulative: cumulativeUncertainty,
        feedbackType: entry.type,
        entryId: entry.id || `feedback_${index}`,
      });
    });

    waterfallData.push({
      type: 'total',
      label: 'Current',
      value: cumulativeUncertainty - baselineUncertainty,
      cumulative: cumulativeUncertainty,
    });

    const xScale = d3.scaleBand()
      .domain(waterfallData.map((d) => d.label))
      .range([0, width])
      .padding(0.2);

    const yExtent = d3.extent([...waterfallData.map((d) => d.cumulative), 0]) as [number, number];
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .nice()
      .range([height, 0]);

    const colorScale = d3.scaleOrdinal<string>()
      .domain(['Rating', 'Comparison', 'Correction', 'Demo', 'Cluster'])
      .range(['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336']);

    waterfallData.forEach((d, i) => {
      const prevCumulative = i > 0 ? waterfallData[i - 1].cumulative : baselineUncertainty;
      const isSelected = d.type === 'feedback' && d.entryId === selectedId;

      let barHeight = 0;
      let barY = yScale(d.cumulative);
      let barColor = '#666';
      let barStroke = isSelected ? '#1976d2' : '#fff';
      let barStrokeWidth = isSelected ? 2.5 : 1;
      let isDecrease = false;
      let isIncrease = false;

      if (d.type === 'baseline') {
        barY = yScale(d.cumulative);
      } else if (d.type === 'feedback') {
        barHeight = Math.abs(yScale(prevCumulative) - yScale(d.cumulative));
        if (d.value > 0) {
          barY = yScale(d.cumulative);
          barColor = isSelected
            ? UNCERTAINTY_INCREASE_COLOR_SELECTED
            : UNCERTAINTY_INCREASE_COLOR;
          isIncrease = true;
        } else {
          barY = yScale(prevCumulative);
          barColor = isSelected
            ? UNCERTAINTY_DECREASE_COLOR_SELECTED
            : UNCERTAINTY_DECREASE_COLOR;
          isDecrease = true;
        }
      }

      const barGroup = svg.append('g')
        .style('cursor', d.type === 'feedback' ? 'pointer' : 'default');

      if (d.type === 'feedback') {
        barGroup.on('click', () => {
          onSelectFeedback?.(d.entryId === selectedId ? null : (d.entryId ?? null));
        });
      }

      if (d.type === 'total' || d.type === 'baseline') {
        const xBand = xScale(d.label)!;
        const lineXStart = xBand + xScale.bandwidth() * 0.15;
        const lineXEnd = xBand + xScale.bandwidth() * 0.85;
        const lineY = yScale(d.cumulative);

        barGroup.append('line')
          .attr('x1', lineXStart).attr('x2', lineXEnd)
          .attr('y1', lineY).attr('y2', lineY)
          .attr('stroke', d.type === 'baseline' ? 'rgba(120, 120, 120, 0.95)' : 'rgba(120, 120, 120, 0.9)')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', d.type === 'total' ? '4,2' : null);

        if (d.type === 'total') {
          barGroup.append('circle')
            .attr('cx', (lineXStart + lineXEnd) / 2).attr('cy', lineY)
            .attr('r', 3).attr('fill', '#fff')
            .attr('stroke', 'rgba(120,120,120,0.9)').attr('stroke-width', 1);
        }
      } else {
        barGroup.append('rect')
          .attr('x', xScale(d.label)!)
          .attr('y', barY)
          .attr('width', xScale.bandwidth())
          .attr('height', barHeight)
          .attr('fill', barColor)
          .attr('stroke', barStroke)
          .attr('stroke-width', barStrokeWidth);
      }

      if (d.type === 'feedback' && d.feedbackType) {
        const circleY = isDecrease ? barY - 3 : barY + barHeight + 3;
        barGroup.append('circle')
          .attr('cx', xScale(d.label)! + xScale.bandwidth() / 2)
          .attr('cy', circleY)
          .attr('r', isSelected ? 5 : 4)
          .attr('fill', colorScale(d.feedbackType))
          .attr('stroke', isSelected ? '#1976d2' : '#fff')
          .attr('stroke-width', isSelected ? 2 : 1);
      }

      const labelValue = d.type === 'total' ? d.cumulative : d.value;
      let labelY = d.type === 'feedback'
        ? (isIncrease ? barY - 8 : barY + barHeight + 12)
        : barY - 8;

      svg.append('text')
        .attr('x', xScale(d.label)! + xScale.bandwidth() / 2)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', isSelected ? 'bold' : 'normal')
        .attr('fill', isSelected ? '#1976d2' : '#333')
        .text(labelValue.toFixed(2));
    });

    // Connecting lines between feedback bars
    for (let i = 1; i < waterfallData.length - 1; i++) {
      const current = waterfallData[i];
      const next = waterfallData[i + 1];
      svg.append('line')
        .attr('x1', xScale(current.label)! + xScale.bandwidth())
        .attr('x2', xScale(next.label)!)
        .attr('y1', yScale(current.cumulative))
        .attr('y2', yScale(current.cumulative))
        .attr('stroke', '#ddd')
        .attr('stroke-dasharray', '2,2')
        .attr('stroke-width', 1);
    }

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('font-size', '8px');

    svg.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => (d as number).toFixed(2)))
      .selectAll('text')
      .attr('font-size', '8px');

  }, [feedbackHistory, baselineUncertainty, selectedId, onSelectFeedback]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, flexShrink: 0 }}>
        {title}
      </Typography>
      <Box ref={chartRef} sx={{ flex: 1, minHeight: 0 }} />
      {feedbackHistory.length === 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
          <Typography variant="body2">No feedback history available</Typography>
        </Box>
      )}
    </Box>
  );
};

export default FeedbackWaterfallChart;
