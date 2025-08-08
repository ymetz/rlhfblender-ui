import React, { useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';

export const GlyphLegendComponent: React.FC = () => {
    const legendRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (legendRef.current) {
            d3.select(legendRef.current).select('svg').remove();

            const svg = d3.select(legendRef.current)
                .append('svg')
                .attr('width', 160)
                .attr('height', 80)
                .append('g')
                .attr('transform', 'translate(10, 10)');

            // Start glyph example
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

            // End glyph example
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
        }
    }, []);

    return (
        <Box>
            <Typography variant="caption" fontWeight="bold">Marker Legend</Typography>
            <div ref={legendRef} />
        </Box>
    );
};