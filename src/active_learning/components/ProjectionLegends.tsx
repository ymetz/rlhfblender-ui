import React, { useEffect, useRef, useState } from 'react';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import * as d3 from 'd3';
import * as vsup from 'vsup';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { interpolateBrightCividis } from '../utils/vsupColors';

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
        const scale = vsup.scale().quantize(quantization).range(interpolateBrightCividis);

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

export const Legend: React.FC = () => {
    const legendRef = useRef<HTMLDivElement | null>(null);
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        if (!legendRef.current || !expanded) {
            if (legendRef.current) {
                d3.select(legendRef.current).select('svg').remove();
            }
            return;
        }

        const legendItems: Array<{ label: string; type: 'start' | 'end' | 'episode' | 'cluster' | 'selected' }> = [
            { label: 'Start states', type: 'start' },
            { label: 'End states', type: 'end' },
            { label: 'Episode', type: 'episode' },
            { label: 'Cluster', type: 'cluster' },
            { label: 'Selected Episode', type: 'selected' },
        ];

        const itemSpacing = 28;
        const verticalOffset = 16;
        const svgWidth = 200;
        const svgHeight = verticalOffset + legendItems.length * itemSpacing;

        const svg = d3.select(legendRef.current)
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .append('g');

        legendItems.forEach((item, index) => {
            const group = svg.append('g')
                .attr('transform', `translate(15, ${verticalOffset + index * itemSpacing})`);

            switch (item.type) {
                case 'start':
                    group.append('polygon')
                        .attr('points', '-7,-7 7,0 -7,7')
                        .attr('fill', '#4CAF50')
                        .attr('stroke', '#2E7D32')
                        .attr('stroke-width', 2);
                    break;
                case 'end':
                    group.append('rect')
                        .attr('x', -6)
                        .attr('y', -6)
                        .attr('width', 12)
                        .attr('height', 12)
                        .attr('fill', '#F44336')
                        .attr('stroke', '#C62828')
                        .attr('stroke-width', 2);
                    break;
                case 'episode':
                    group.append('line')
                        .attr('x1', -12)
                        .attr('y1', 0)
                        .attr('x2', 12)
                        .attr('y2', 0)
                        .attr('stroke', '#4C78A8')
                        .attr('stroke-width', 3)
                        .attr('stroke-linecap', 'round');
                    break;
                case 'cluster':
                    group.append('polygon')
                        .attr('points', '-12,-8 2,-12 14,-4 8,10 -10,6')
                        .attr('fill', 'rgba(51, 51, 51, 0.12)')
                        .attr('stroke', '#333333')
                        .attr('stroke-width', 2)
                        .attr('stroke-dasharray', '6,4');
                    break;
                case 'selected':
                    group.append('line')
                        .attr('x1', -12)
                        .attr('y1', 0)
                        .attr('x2', 12)
                        .attr('y2', 0)
                        .attr('stroke', '#FF7043')
                        .attr('stroke-width', 3)
                        .attr('stroke-linecap', 'round');

                    [-12, -6, 0, 6, 12].forEach((x) => {
                        group.append('circle')
                            .attr('cx', x)
                            .attr('cy', 0)
                            .attr('r', 3)
                            .attr('fill', '#FF7043')
                            .attr('stroke', '#ffffff')
                            .attr('stroke-width', 1);
                    });
                    break;
                default:
                    break;
            }

            group.append('text')
                .attr('x', 32)
                .attr('y', 3)
                .attr('font-size', '12px')
                .attr('fill', '#333333')
                .text(item.label);
        });
    }, [expanded]);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight="bold">Legend</Typography>
                <IconButton
                    size="small"
                    onClick={() => setExpanded(prev => !prev)}
                    sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                    aria-label={expanded ? 'Collapse legend' : 'Expand legend'}
                >
                    <ExpandMoreIcon fontSize="small" />
                </IconButton>
            </Box>
            <Collapse in={expanded} collapsedSize={0}>
                <Box sx={{ pt: 0.5 }}>
                    <div ref={legendRef} />
                </Box>
            </Collapse>
        </Box>
    );
};
