// Canvas drawing utilities for StateSequenceProjection

export const canvasImageCache = new Map();

// Enhanced trajectory visualization functions to reduce overplotting
export function drawTrajectory(context: CanvasRenderingContext2D, points: number[][], color: string, lineWidth: number = 2) {
    if (points.length < 2) return;
    
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        context.lineTo(points[i][0], points[i][1]);
    }
    context.stroke();
}

// Helper function to calculate image bounds matching the projection space
export function calculateImageBounds(xScale: any, yScale: any, bounds: any) {
    // If we have grid data with bounds, use them
    if (bounds) {
        // Add some padding to the bounds to show surrounding area
        const xPadding = (bounds.x_max - bounds.x_min) * 0.1; // 10% padding
        const yPadding = (bounds.y_max - bounds.y_min) * 0.1; // 10% padding

        return {
            x: xScale(bounds.x_min - xPadding),
            y: yScale(bounds.y_max + yPadding), // Note: y axis is flipped
            width: xScale(bounds.x_max + xPadding) - xScale(bounds.x_min - xPadding),
            height: yScale(bounds.y_min - yPadding) - yScale(bounds.y_max + yPadding)
        };
    }

    // Fallback to using the chart dimensions
    return {
        x: 0,
        y: 0,
        width: 800, // fallback width
        height: 600 // fallback height
    };
}

// Helper function to draw image to canvas with transform
export function drawImageToCanvas(ctx: any, imageKey: any, transform: any, width: any, height: any, xScale?: any, yScale?: any) {
    if (!ctx) return;

    const imgData = canvasImageCache.get(imageKey);
    if (!imgData || !imgData.image) return;

    ctx.save();

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply transformation
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Calculate image bounds in projection space
    let imageBounds;
    if (xScale && yScale) {
        imageBounds = calculateImageBounds(xScale, yScale, imgData.bounds);
    } else {
        imageBounds = { x: 0, y: 0, width: width, height: height };
    }

    // Draw the image with proper scaling
    ctx.globalAlpha = 0.5; // Slightly transparent so we can see points on top
    ctx.drawImage(
        imgData.image,
        0, 0, imgData.image.width, imgData.image.height,
        imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height
    );

    ctx.restore();
}

// Function to create start glyph (play triangle)
export function createStartGlyph(container: any, size: number = 12, isHighlighted: boolean = false) {
    const triangle = container.append('polygon')
        .attr('class', 'start-glyph')
        .attr('points', `${-size/2},${-size/2} ${size/2},0 ${-size/2},${size/2}`)
        .attr('fill', '#4CAF50')
        .attr('stroke', isHighlighted ? '#FFD700' : '#2E7D32')
        .attr('stroke-width', isHighlighted ? 4 : 2);
    
    // Add highlight glow effect for selected episodes
    if (isHighlighted) {
        triangle.attr('filter', 'drop-shadow(0 0 6px #FFD700)');
    }
    
    return triangle;
}

// Function to create end glyph (square stop)
export function createEndGlyph(container: any, size: number = 10, isHighlighted: boolean = false) {
    const square = container.append('rect')
        .attr('class', 'end-glyph')
        .attr('x', -size/2)
        .attr('y', -size/2)
        .attr('width', size)
        .attr('height', size)
        .attr('fill', '#F44336')
        .attr('stroke', isHighlighted ? '#FFD700' : '#C62828')
        .attr('stroke-width', isHighlighted ? 4 : 2);
    
    // Add highlight glow effect for selected episodes
    if (isHighlighted) {
        square.attr('filter', 'drop-shadow(0 0 6px #FFD700)');
    }
    
    return square;
}