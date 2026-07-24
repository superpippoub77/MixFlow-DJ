import { Box, Paper, Typography, Slider } from '@mui/material';
import { palette } from '../theme';
import { DotDisplay } from './DotDisplay';
import type { AutoMixStatus } from '../audio/useAutoMix';

const CROSSFADER_MARKS = Array.from({ length: 11 }, (_, i) => ({ value: i * 10 }));

export function MasterPanel({
  values,
  onCrossfaderChange,
  automixEnabled,
  onToggleAutomix,
  automixStatus,
}: {
  values: Record<string, number>;
  onCrossfaderChange: (value: number) => void;
  automixEnabled: boolean;
  onToggleAutomix: () => void;
  automixStatus: AutoMixStatus;
}) {
  const crossfader = values['master.crossfader'] ?? 0.5;
  const autodj = (values['master.autodj_enable'] ?? 0) > 0;

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6" sx={{ color: palette.master }}>
          Master
        </Typography>

        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          {/* MASTER CUE: monitoraggio in cuffia del segnale master. Solo visuale: il
              browser non permette di instradare l'audio su un'uscita cuffie separata
              senza hardware/API dedicate, quindi qui è un semplice indicatore. */}
          <Box
            sx={{
              px: 1.2,
              py: 0.5,
              borderRadius: 1,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid #2b2f37',
              color: '#8b909c',
            }}
          >
            MASTER CUE
          </Box>

          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              border: `1px solid ${autodj ? palette.master : '#2b2f37'}`,
              background: autodj ? palette.master : 'transparent',
              color: autodj ? '#111' : '#8b909c',
            }}
          >
            AUTO DJ {autodj ? 'ON' : 'OFF'}
          </Box>

          {/* TRANSITION FX: sul controller reale applica un effetto automatico
              durante il passaggio tra i deck. Qui riusiamo la stessa idea per
              attivare/disattivare l'Automix (crossfade + beatmatching automatico). */}
          <Box display="flex" flexDirection="column" alignItems="center" gap={0.3}>
            <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.08em' }}>
              TRANSITION FX
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                onClick={onToggleAutomix}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                  userSelect: 'none',
                  border: `1px solid ${automixEnabled ? palette.master : '#2b2f37'}`,
                  background: automixEnabled ? palette.master : 'transparent',
                  color: automixEnabled ? '#111' : '#8b909c',
                }}
              >
                AUTOMIX {automixEnabled ? 'ON' : 'OFF'}
              </Box>
              {automixStatus === 'mixing' && (
                <Typography variant="caption" sx={{ color: palette.master, fontFamily: 'JetBrains Mono, monospace' }}>
                  mix in corso…
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box display="flex" alignItems="center" gap={1.5} maxWidth={420} mx="auto">
        <Typography variant="caption" sx={{ opacity: 0.6, color: palette.deck1, fontFamily: 'JetBrains Mono, monospace' }}>
          D1
        </Typography>
        <Box flex={1}>
          <Slider
            value={crossfader * 100}
            onChange={(_, val) => onCrossfaderChange((val as number) / 100)}
            marks={CROSSFADER_MARKS}
            size="small"
            sx={{ color: palette.master }}
          />
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.6, color: palette.deck2, fontFamily: 'JetBrains Mono, monospace' }}>
          D2
        </Typography>
        <DotDisplay color={palette.master}>{(crossfader * 100).toFixed(0)}%</DotDisplay>
      </Box>
    </Paper>
  );
}
