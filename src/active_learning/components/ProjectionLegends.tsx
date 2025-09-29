import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import * as d3 from 'd3';
import * as vsup from 'vsup';

interface ColorLegendProps {
    minMax: [number, number] | null;
    width: number;
    title: string;
}

const LegendContainer = styled(Box)(({ theme }) => ({
    position: 'absolute',
    bottom: theme.spacing(2),
    width: '200px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
}));

export const ObjectLegend = styled(LegendContainer)(({ theme }) => ({
    right: theme.spacing(1),
    zIndex: 15,
}));

export const GlyphLegend = styled(LegendContainer)(({ theme }) => ({
    left: theme.spacing(1),
    zIndex: 15,
    width: '180px',
}));

export const ColorLegend: React.FC<ColorLegendProps> = ({ minMax, width, title }) => {
    const legendRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!legendRef.current || !minMax) return;

        d3.select(legendRef.current).select('*').remove();

        const margin = { top: 0, right: 0, bottom: 0, left: 0 };
        const height = 190 - margin.top - margin.bottom;

        const svg = d3.select(legendRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const quantization = vsup.quantization().branching(2).layers(4).valueDomain([minMax[0], minMax[1]]).uncertaintyDomain([1.0, 0.01]);
        const scale = vsup.scale().quantize(quantization).range(d3.interpolateCividis);

        const arcLegend = vsup.legend.arcmapLegend()
            .size(160)
            .scale(scale)
            .x(10)
            .y(25)
            .format('.2f');

        svg.call(arcLegend as any);

        svg.selectAll('.arc-label text')
            .style('font-size', '9px');

        const arcLabels = svg.selectAll<SVGGElement, unknown>('.arc-label');
        const totalLabels = arcLabels.size();

        if (totalLabels > 4) {
            const keepEveryNth = Math.ceil(totalLabels / 4);

            arcLabels.each(function (_d, i) {
                if (i % keepEveryNth !== 1 && i !== totalLabels - 2) {
                    d3.select(this).select('text').style('display', 'none');
                    d3.select(this).select('line').style('display', 'none');
                }
            });
        }
    }, [minMax, width, title]);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">{title}</Typography>
            <div ref={legendRef} />
        </Box>
    );
};

export const GlyphLegendComponent: React.FC = () => {
    const legendRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!legendRef.current) return;

        d3.select(legendRef.current).select('svg').remove();

        const svg = d3.select(legendRef.current)
            .append('svg')
            .attr('width', 160)
            .attr('height', 80)
            .append('g')
            .attr('transform', 'translate(10, 10)');

        const startGroup = svg.append('g')
            .attr('transform', 'translate(15, 20)');

        startGroup.append('polygon')
            .attr('points', '-7,-7 7,0 -7,7')
            .attr('fill', '#4CAF50')
            .attr('stroke', '#2E7D32')
            .attr('stroke-width', 2);

        startGroup.append('text')
            .attr('x', 20)
            .attr('y', 4)
            .attr('font-size', '12px')
            .attr('fill', '#333333')
            .text('Start states');

        const endGroup = svg.append('g')
            .attr('transform', 'translate(15, 45)');

        endGroup.append('rect')
            .attr('x', -6)
            .attr('y', -6)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', '#F44336')
            .attr('stroke', '#C62828')
            .attr('stroke-width', 2);

        endGroup.append('text')
            .attr('x', 20)
            .attr('y', 4)
            .attr('font-size', '12px')
            .attr('fill', '#333333')
            .text('End states');
    }, []);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">Marker Legend</Typography>
            <div ref={legendRef} />
        </Box>
    );
};
