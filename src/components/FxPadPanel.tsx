import { Box, Paper, Typography } from '@mui/material';
import { palette } from '../theme';

function FxButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 2,
        py: 1,
        borderRadius: 1,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.04em',
        border: `1px solid ${active ? palette.master : '#2b2f37'}`,
        background: active ? palette.master : '#181b20',
        color: active ? '#111' : '#c9cdd6',
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: 'center',
        transition: 'background 80ms, border-color 80ms',
        '&:active': { background: palette.master, color: '#111' },
      }}
    >
      {label}
    </Box>
  );
}

export function FxPadPanel({
  onSiren,
  onRiser,
  onAirhorn,
  onNoiseSweep,
  onToggleEcho,
  echoActive,
}: {
  onSiren: () => void;
  onRiser: () => void;
  onAirhorn: () => void;
  onNoiseSweep: () => void;
  onToggleEcho: () => void;
  echoActive: boolean;
}) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ color: palette.master, mb: 1.5 }}>
        Pad FX
      </Typography>
      <Box display="flex" gap={1} flexWrap="wrap">
        <FxButton label="🚨 SIRENA" onClick={onSiren} />
        <FxButton label="✈️ AEREO" onClick={onRiser} />
        <FxButton label="📯 AIR HORN" onClick={onAirhorn} />
        <FxButton label="🌊 NOISE SWEEP" onClick={onNoiseSweep} />
        <FxButton label="🔁 ECHO" onClick={onToggleEcho} active={echoActive} />
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mt: 1 }}>
        Suoni generati al momento (nessun campione esterno), mandati sul mix principale — li senti anche in
        registrazione e sul Master Cue.
      </Typography>
    </Paper>
  );
}
