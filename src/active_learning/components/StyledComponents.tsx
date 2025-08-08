import { styled, Box, Card } from '@mui/material';

export const EmbeddingWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    position: 'relative',
}));

export const EmbeddingContainer = styled(Box)(({ theme }) => ({
    flexGrow: 1,
    position: 'relative',
}));

export const ThumbnailOverlay = styled(Card)(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
    width: '200px',
    height: '200px',
    zIndex: 30,
    border: '3px solid',
    transition: 'opacity 0.3s',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    '&:hover': {
        opacity: 1,
    },
}));

export const LegendContainer = styled(Box)(({ theme }) => ({
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