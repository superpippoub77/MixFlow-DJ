import { Box, Paper, Typography } from '@mui/material';
import type { DDJ200Event } from '../midi/decodeDDJ200';
import { describeEvent } from '../midi/decodeDDJ200';
import { palette } from '../theme';

const KIND_COLOR: Record<DDJ200Event['kind'], string> = {
  button: palette.deck1,
  hotcue: palette.deck2,
  knob: palette.master,
  fader: palette.master,
  jog: '#7aa2ff',
  unknown: palette.danger,
};

export function EventLog({ log }: { log: DDJ200Event[] }) {
  return (
    <Paper sx={{ p: 2, height: 320, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" mb={1}>
        Log messaggi in arrivo
      </Typography>
      <Box
        sx={{
          overflowY: 'auto',
          flex: 1,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column-reverse',
        }}
      >
        {log.length === 0 && (
          <Typography variant="body2" sx={{ opacity: 0.5 }}>
            In attesa di comandi dal controller… muovi un fader o premi un pad.
          </Typography>
        )}
        <Box display="flex" flexDirection="column" gap={0.4}>
          {log.map((e, i) => (
            <Box key={i} display="flex" gap={1}>
              <Box component="span" sx={{ color: KIND_COLOR[e.kind], minWidth: 62 }}>
                [{e.kind}]
              </Box>
              <Box component="span" sx={{ opacity: 0.9 }}>
                {describeEvent(e)}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}
