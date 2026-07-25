import { useState } from 'react';
import { Box, Paper, Typography, Select, MenuItem, Button } from '@mui/material';
import { palette } from '../theme';
import { DotDisplay } from './DotDisplay';
import type { AutoMixStatus } from '../audio/useAutoMix';
import { listAudioOutputDevices, type AudioOutputDevice } from '../audio/audioDevices';

export function MasterPanel({
  values,
  onCrossfaderChange,
  automixEnabled,
  onToggleAutomix,
  automixStatus,
  masterCueActive,
  onToggleMasterCue,
  cueDeviceSupported,
  onSelectCueDevice,
}: {
  values: Record<string, number>;
  onCrossfaderChange: (value: number) => void;
  automixEnabled: boolean;
  onToggleAutomix: () => void;
  automixStatus: AutoMixStatus;
  masterCueActive: boolean;
  onToggleMasterCue: () => void;
  cueDeviceSupported: boolean;
  onSelectCueDevice: (deviceId: string) => void;
}) {
  const crossfader = values['master.crossfader'] ?? 0.5;
  const autodj = (values['master.autodj_enable'] ?? 0) > 0;

  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(false);

  async function refreshDevices() {
    setLoadingDevices(true);
    try {
      const list = await listAudioOutputDevices();
      setDevices(list);
    } finally {
      setLoadingDevices(false);
    }
  }

  function handleSelect(deviceId: string) {
    setSelectedDevice(deviceId);
    onSelectCueDevice(deviceId);
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6" sx={{ color: palette.master }}>
          Master
        </Typography>

        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          {/* MASTER CUE: manda anche il mix finale (post-crossfader) al bus cuffie, per confrontarlo col preview dei deck */}
          <Box
            onClick={onToggleMasterCue}
            sx={{
              px: 1.2,
              py: 0.5,
              borderRadius: 1,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              border: `1px solid ${masterCueActive ? palette.master : '#2b2f37'}`,
              background: masterCueActive ? palette.master : 'transparent',
              color: masterCueActive ? '#111' : '#8b909c',
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

      <Box display="flex" alignItems="center" gap={1.5} maxWidth={420} mx="auto" mb={2}>
        <Typography variant="caption" sx={{ opacity: 0.6, color: palette.deck1, fontFamily: 'JetBrains Mono, monospace' }}>
          D1
        </Typography>
        <Box flex={1}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={crossfader}
            onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: palette.master, cursor: 'pointer' }}
          />
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.6, color: palette.deck2, fontFamily: 'JetBrains Mono, monospace' }}>
          D2
        </Typography>
        <DotDisplay color={palette.master}>{(crossfader * 100).toFixed(0)}%</DotDisplay>
      </Box>

      <Box borderTop="1px solid #2b2f37" pt={1.5}>
        <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', display: 'block', mb: 0.75 }}>
          🎧 Preview in cuffia
        </Typography>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Select
            size="small"
            value={selectedDevice}
            displayEmpty
            onChange={(e) => handleSelect(e.target.value)}
            disabled={!cueDeviceSupported}
            sx={{ minWidth: 220, fontSize: 13 }}
          >
            <MenuItem value="">
              <em>Uscita di sistema (default)</em>
            </MenuItem>
            {devices.map((d) => (
              <MenuItem key={d.deviceId} value={d.deviceId}>
                {d.label}
              </MenuItem>
            ))}
          </Select>
          <Button size="small" variant="outlined" onClick={refreshDevices} disabled={loadingDevices || !cueDeviceSupported}>
            {loadingDevices ? '...' : 'Trova dispositivi'}
          </Button>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mt: 0.5, maxWidth: 480 }}>
          {cueDeviceSupported
            ? 'Attiva la cuffia 🎧 su un deck (o MASTER CUE) per mandare quel segnale sul dispositivo scelto qui, mentre il resto continua sull\'uscita principale.'
            : "Questo browser non permette di scegliere un'uscita audio separata per il preview (funziona su Chrome/Edge/Opera). Il preview suonerà comunque, ma sulla stessa uscita del master."}
        </Typography>
      </Box>
    </Paper>
  );
}
