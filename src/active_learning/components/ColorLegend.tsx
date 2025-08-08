import React, { useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';
import * as vsup from 'vsup';

interface ColorLegendProps {
    minMax: [number, number] | null;
    width: number;
    title: string;
}

export const ColorLegend: React.FC<ColorLegendProps> = ({ minMax, width, title }) => {
    const legendRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (legendRef.current && minMax) {
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
            const scale = vsup.scale().quantize(quantization).range(d3.interpolateBrBG);

            const arc_legend = vsup.legend.arcmapLegend()
                .size(160)
                .scale(scale)
                .x(10)
                .y(25)
                .format(".2f");

            svg.call(arc_legend);

            svg.selectAll('.arc-label text')
                .style('font-size', '9px');

            // Keep only a subset of the labels (approximately 4)
            const arcLabels = svg.selectAll('.arc-label');
            const totalLabels = arcLabels.size();

            if (totalLabels > 4) {
                const keepEveryNth = Math.ceil(totalLabels / 4);

                arcLabels.each(function (d, i) {
                    if (i % keepEveryNth !== 1 && i !== totalLabels - 2) {
                        d3.select(this).select('text').style('display', 'none');
                        d3.select(this).select('line').style('display', 'none');
                    }
                });
            }
        }
    }, [minMax, width, title]);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">{title}</Typography>
            <div ref={legendRef} />
        </Box>
    );
};