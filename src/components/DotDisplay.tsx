import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/**
 * Piccolo "display" in stile LED/dot-matrix (come i contatori dei vecchi
 * mixer/lettori CD): sfondo puntinato scuro, testo monospace con un lieve
 * bagliore colorato.
 */
export function DotDisplay({ children, color = '#7dffb0' }: { children: ReactNode; color?: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 0.85,
        py: 0.25,
        borderRadius: 0.5,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
        letterSpacing: '0.14em',
        lineHeight: 1.6,
        color,
        textShadow: `0 0 4px ${color}80, 0 0 1px ${color}`,
        backgroundColor: '#0b0c0f',
        border: '1px solid #24272e',
        backgroundImage:
          'repeating-radial-gradient(circle at 3px 3px, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1.3px, transparent 5px)',
      }}
    >
      {children}
    </Box>
  );
}
