import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Select, MenuItem, Button } from '@mui/material';
import { palette } from '../theme';
import { DotDisplay } from './DotDisplay';
import { TRANSITION_STYLE_LABELS, type AutoMixStatus, type TransitionStyle } from '../audio/useAutoMix';
import { listAudioOutputDevices, type AudioOutputDevice } from '../audio/audioDevices';

/**
 * Crossfader ricostruito da zero come componente a puntatore (niente
 * `<input type="range">`): il valore è calcolato direttamente dalla
 * posizione X del puntatore sulla traccia, con pointer capture per un
 * trascinamento continuo e lineare, senza dipendere da alcun re-render
 * esterno o comportamento nativo del browser.
 */
function CrossfaderTrack({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function updateFromClientX(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    onChange(Math.min(1, Math.max(0, fraction)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }
  function handlePointerUp() {
    draggingRef.current = false;
  }

  return (
    <Box
      ref={trackRef}
      id="tid-master-crossfader"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      sx={{
        position: 'relative',
        width: '100%',
        height: 28,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 6,
          borderRadius: 3,
          background: '#181b20',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: `${value * 100}%`,
          top: '50%',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}

export function MasterPanel({
  values,
  onCrossfaderChange,
  automixEnabled,
  onToggleAutomix,
  automixStatus,
  transitionStyle,
  onChangeTransitionStyle,
  transitionArmed,
  onToggleTransitionArm,
  masterCueActive,
  onToggleMasterCue,
  cueDeviceSupported,
  onSelectCueDevice,
  testActive,
}: {
  values: Record<string, number>;
  onCrossfaderChange: (value: number) => void;
  automixEnabled: boolean;
  onToggleAutomix: () => void;
  automixStatus: AutoMixStatus;
  transitionStyle: TransitionStyle;
  onChangeTransitionStyle: (style: TransitionStyle) => void;
  transitionArmed: boolean;
  onToggleTransitionArm: () => void;
  masterCueActive: boolean;
  onToggleMasterCue: () => void;
  cueDeviceSupported: boolean;
  onSelectCueDevice: (deviceId: string) => void;
  testActive: string | null;
}) {
  const crossfader = values['master.crossfader'] ?? 0.5;
  const autodj = (values['master.autodj_enable'] ?? 0) > 0;
  const lit = (actual: boolean, key: string) => actual || testActive === key;

  // Stato locale per lo slider: aggiorna la UI istantaneamente durante il
  // trascinamento invece di dipendere dal re-render dell'intero albero
  // (che coinvolge anche i due DeckPanel ogni volta che "values" cambia).
  const [localCrossfader, setLocalCrossfader] = useState(crossfader);
  useEffect(() => setLocalCrossfader(crossfader), [crossfader]);

  function handleCrossfaderInput(value: number) {
    setLocalCrossfader(value);
    onCrossfaderChange(value);
  }

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
              border: `1px solid ${lit(masterCueActive, 'master-cue') ? palette.master : '#2b2f37'}`,
              background: lit(masterCueActive, 'master-cue') ? palette.master : 'transparent',
              color: lit(masterCueActive, 'master-cue') ? '#111' : '#8b909c',
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

          <Box display="flex" flexDirection="column" alignItems="center" gap={0.3}>
            <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.08em' }}>
              STILE TRANSIZIONE
            </Typography>
            <Select
              size="small"
              value={transitionStyle}
              onChange={(e) => onChangeTransitionStyle(e.target.value as TransitionStyle)}
              sx={{ fontSize: 12, minWidth: 150 }}
            >
              {(Object.keys(TRANSITION_STYLE_LABELS) as TransitionStyle[]).map((key) => (
                <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>
                  {TRANSITION_STYLE_LABELS[key]}
                </MenuItem>
              ))}
            </Select>
          </Box>

          {/* AUTOMIX: mix automatico a timer, parte da solo quando il brano attivo sta per finire */}
          <Box display="flex" flexDirection="column" alignItems="center" gap={0.3}>
            <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.08em' }}>
              AUTOMIX
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                id="tid-master-automix"
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
                  border: `1px solid ${lit(automixEnabled, 'master-automix') ? palette.master : '#2b2f37'}`,
                  background: lit(automixEnabled, 'master-automix') ? palette.master : 'transparent',
                  color: lit(automixEnabled, 'master-automix') ? '#111' : '#8b909c',
                }}
              >
                {automixEnabled ? 'ON' : 'OFF'}
              </Box>
              {automixStatus === 'mixing' && (
                <Typography variant="caption" sx={{ color: palette.master, fontFamily: 'JetBrains Mono, monospace' }}>
                  mix in corso…
                </Typography>
              )}
            </Box>
          </Box>

          {/* TRANSITION FX: come sull'hardware reale, "arma" l'effetto scelto sopra; sei tu a
              trascinare il crossfader per applicarlo in proporzione, invece di un timer automatico. */}
          <Box display="flex" flexDirection="column" alignItems="center" gap={0.3}>
            <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.08em' }}>
              TRANSITION FX
            </Typography>
            <Box
              onClick={onToggleTransitionArm}
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
                border: `1px solid ${lit(transitionArmed, 'master-transition') ? palette.master : '#2b2f37'}`,
                background: lit(transitionArmed, 'master-transition') ? palette.master : 'transparent',
                color: lit(transitionArmed, 'master-transition') ? '#111' : '#8b909c',
              }}
            >
              {transitionArmed ? 'ARMATO' : 'ARMA'}
            </Box>
          </Box>
        </Box>
      </Box>

      <Box display="flex" alignItems="center" gap={1.5} maxWidth={420} mx="auto" mb={2}>
        <Typography variant="caption" sx={{ opacity: 0.6, color: palette.deck1, fontFamily: 'JetBrains Mono, monospace' }}>
          D1
        </Typography>
        <Box flex={1}>
          <CrossfaderTrack value={localCrossfader} onChange={handleCrossfaderInput} color={palette.master} />
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.6, color: palette.deck2, fontFamily: 'JetBrains Mono, monospace' }}>
          D2
        </Typography>
        <DotDisplay color={palette.master}>{(localCrossfader * 100).toFixed(0)}%</DotDisplay>
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
