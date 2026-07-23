import { Box, Paper, Typography, Slider } from '@mui/material';
import { palette } from '../theme';

export function MasterPanel({ values }: { values: Record<string, number> }) {
  const crossfader = values['master.crossfader'] ?? 0.5;
  const filter1 = values['master.filter_deck1'] ?? 0;
  const filter2 = values['master.filter_deck2'] ?? 0;
  const autodj = (values['master.autodj_enable'] ?? 0) > 0;

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ color: palette.master, mb: 1.5 }}>
        Master
      </Typography>

      <Box display="flex" gap={4} alignItems="center" flexWrap="wrap">
        <Box width={220}>
          <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace' }}>
            CROSSFADER {(crossfader * 100).toFixed(0)}%
          </Typography>
          <Slider value={crossfader * 100} disabled size="small" sx={{ color: palette.master }} />
        </Box>

        <Box display="flex" gap={3}>
          <Box textAlign="center">
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
              Filtro D1
            </Typography>
            <Typography sx={{ color: palette.deck1, fontFamily: 'JetBrains Mono, monospace' }}>
              {(filter1 * 100).toFixed(0)}%
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
              Filtro D2
            </Typography>
            <Typography sx={{ color: palette.deck2, fontFamily: 'JetBrains Mono, monospace' }}>
              {(filter2 * 100).toFixed(0)}%
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            border: `1px solid ${autodj ? palette.master : '#2b2f37'}`,
            background: autodj ? palette.master : 'transparent',
            color: autodj ? '#111' : '#8b909c',
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          AUTO DJ {autodj ? 'ON' : 'OFF'}
        </Box>
      </Box>
    </Paper>
  );
}
