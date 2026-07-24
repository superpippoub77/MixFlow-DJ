import { useRef } from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import type { DeckSnapshot } from '../audio/deck';
import { DotDisplay } from './DotDisplay';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function NowPlaying({
  track,
  color,
  ytContainerId,
  onSeek,
  bpm,
}: {
  track: DeckSnapshot;
  color: string;
  ytContainerId: string;
  onSeek: (fraction: number) => void;
  bpm: number | null;
}) {
  const progress = track.duration > 0 ? (track.currentTime / track.duration) * 100 : 0;

  function handleSeekClick(e: React.MouseEvent<HTMLDivElement>) {
    if (track.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(Math.min(1, Math.max(0, fraction)));
  }

  return (
    <Box mb={1.5}>
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        {track.sourceType && (
          <Box
            sx={{
              fontSize: 9,
              fontFamily: 'JetBrains Mono, monospace',
              px: 0.6,
              py: 0.2,
              borderRadius: 0.5,
              border: `1px solid ${color}`,
              color,
              flexShrink: 0,
            }}
          >
            {track.sourceType === 'local' ? 'FILE' : 'YOUTUBE'}
          </Box>
        )}
        <Typography variant="body2" noWrap sx={{ opacity: track.title ? 0.9 : 0.4, flex: 1 }}>
          {track.title ?? 'Nessuna traccia caricata'}
        </Typography>
        <DotDisplay color={color}>{bpm ? `${bpm} BPM` : '-- BPM'}</DotDisplay>
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        {/* Contenitore persistente per il player YouTube: si popola solo se la sorgente è YouTube */}
        <Box
          id={ytContainerId}
          sx={{
            width: track.sourceType === 'youtube' ? 160 : 0,
            height: track.sourceType === 'youtube' ? 90 : 0,
            overflow: 'hidden',
            borderRadius: 1,
            flexShrink: 0,
            transition: 'width 120ms, height 120ms',
          }}
        />
        <Box flex={1} onClick={handleSeekClick} sx={{ cursor: track.duration > 0 ? 'pointer' : 'default', py: 0.5 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              background: '#181b20',
              '& .MuiLinearProgress-bar': { background: color },
            }}
          />
          <DotDisplay color={color}>
            {formatTime(track.currentTime)} / {formatTime(track.duration)}
          </DotDisplay>
        </Box>
      </Box>
    </Box>
  );
}

function Knob({ label, value, color, onChange }: { label: string; value: number; color: string; onChange: (v: number) => void }) {
  const angle = -135 + value * 270; // -135°..+135°
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { startY: e.clientY, startValue: value };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const delta = (dragRef.current.startY - e.clientY) / 120; // trascina in alto = aumenta
    onChange(Math.min(1, Math.max(0, dragRef.current.startValue + delta)));
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.4} width={52}>
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '2px solid #2b2f37',
          position: 'relative',
          background: '#181b20',
          cursor: 'ns-resize',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 3,
            left: '50%',
            width: 2,
            height: 13,
            background: color,
            transformOrigin: '1px 15px',
            transform: `rotate(${angle}deg)`,
            pointerEvents: 'none',
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        {label}
      </Typography>
    </Box>
  );
}

/** Fader verticale (tempo), come sull'hardware reale: 0 al centro, tacche +/- ai lati */
function VerticalTempoFader({ value, color, onChange }: { value: number; color: string; onChange: (v: number) => void }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5} height="100%">
      <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        +
      </Typography>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          minHeight: 120,
        }}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: 120,
            accentColor: color,
            cursor: 'pointer',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        -
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em' }}>
        TEMPO
      </Typography>
      <DotDisplay color={color}>{((value - 0.5) * 16).toFixed(1)}%</DotDisplay>
    </Box>
  );
}

function Fader({ label, value, color, onChange }: { label: string; value: number; color: string; onChange: (v: number) => void }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5} width={72}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
          {label}
        </Typography>
        <DotDisplay color={color}>{(value * 100).toFixed(0)}%</DotDisplay>
      </Box>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
      />
    </Box>
  );
}

function PadGrid({ active, color }: { active: Record<number, boolean>; color: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em', mb: 0.5, display: 'block' }}>
        PERFORMANCE PADS
      </Typography>
      <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={0.75}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((pad) => (
          <Box
            key={pad}
            sx={{
              height: 32,
              borderRadius: 1,
              border: `1px solid ${active[pad] ? color : '#2b2f37'}`,
              background: active[pad] ? color : '#181b20',
              transition: 'background 60ms, border-color 60ms',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 10, opacity: active[pad] ? 1 : 0.4, color: active[pad] ? '#111' : undefined }}>
              {pad}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Piccolo pulsante rotondo (Beat Sync, Tempo Range...): solo visuale se onClick non è passato */
function RoundButton({
  label,
  active,
  color,
  onClick,
  size = 40,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick?: () => void;
  size?: number;
}) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.4}>
      <Box
        onClick={onClick}
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1.5px solid ${active ? color : '#2b2f37'}`,
          background: active ? color : '#181b20',
          cursor: onClick ? 'pointer' : 'default',
        }}
      />
      <Typography variant="caption" sx={{ opacity: 0.55, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.06em' }}>
        {label}
      </Typography>
    </Box>
  );
}

export function DeckPanel(props: {
  deck: 1 | 2;
  color: string;
  values: Record<string, number>;
  hotcueActive: Record<number, boolean>;
  jogAngle: number;
  jogTouched: boolean;
  track: DeckSnapshot;
  ytContainerId: string;
  bpm: number | null;
  onPlay: () => void;
  onCue: () => void;
  onSeek: (fraction: number) => void;
  onEQChange: (band: 'low' | 'mid' | 'high', value: number) => void;
  onFilterChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onTempoChange: (value: number) => void;
}) {
  const {
    deck,
    color,
    values,
    hotcueActive,
    jogAngle,
    jogTouched,
    track,
    ytContainerId,
    bpm,
    onPlay,
    onCue,
    onSeek,
    onEQChange,
    onFilterChange,
    onVolumeChange,
    onTempoChange,
  } = props;
  const v = (name: string) => values[`${deck}.${name}`] ?? 0;
  const pressed = (name: string) => (values[`${deck}.${name}`] ?? 0) > 0;
  const filterValue = values[`master.filter_deck${deck}`] ?? 0.5;

  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h6" sx={{ color }}>
          Deck {deck}
        </Typography>
        <Box
          onClick={undefined}
          sx={{
            px: 1,
            py: 0.4,
            borderRadius: 1,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            border: `1px solid ${pressed('shift') ? color : '#2b2f37'}`,
            background: pressed('shift') ? color : 'transparent',
            color: pressed('shift') ? '#111' : '#8b909c',
          }}
        >
          shift
        </Box>
      </Box>

      <NowPlaying track={track} color={color} ytContainerId={ytContainerId} onSeek={onSeek} bpm={bpm} />

      <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap" flex={1}>
        {/* Colonna jog + trasporto, come sull'hardware */}
        <Box display="flex" flexDirection="column" alignItems="center" gap={1} flexShrink={0}>
          <Box
            sx={{
              width: 108,
              height: 108,
              borderRadius: '50%',
              border: `2px solid ${jogTouched ? color : '#2b2f37'}`,
              position: 'relative',
              background: '#181b20',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 3,
                height: 42,
                background: color,
                transformOrigin: '1.5px 0px',
                transform: `translate(-1.5px, -42px) rotate(${jogAngle}deg)`,
              }}
            />
          </Box>

          <Box display="flex" gap={1.5}>
            <RoundButton label="BEAT SYNC" active={pressed('sync')} color={color} size={30} />
            <RoundButton label="TEMPO RANGE" active={false} color={color} size={30} />
          </Box>

          <Box display="flex" gap={1}>
            <Box
              onClick={onCue}
              sx={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: `2px solid ${pressed('cue') ? color : '#2b2f37'}`,
                background: pressed('cue') ? color : '#181b20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                color: pressed('cue') ? '#111' : '#8b909c',
              }}
            >
              CUE
            </Box>
            <Box
              onClick={onPlay}
              sx={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: `2px solid ${track.playing ? color : '#2b2f37'}`,
                background: track.playing ? color : '#181b20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: track.playing ? '#111' : color,
              }}
            >
              {track.playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </Box>
          </Box>

          <Box
            onClick={undefined}
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: `1.5px solid ${pressed('headphone_cue') ? color : '#2b2f37'}`,
              background: pressed('headphone_cue') ? color : '#181b20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pressed('headphone_cue') ? '#111' : '#8b909c',
            }}
          >
            <HeadphonesIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>

        {/* Colonna filtro + EQ, come sul mixer reale */}
        <Box display="flex" flexDirection="column" alignItems="center" gap={1.5} flexShrink={0}>
          <Knob label="FILTER" value={filterValue} color={color} onChange={onFilterChange} />
          <Knob label="HIGH" value={v('eq_high')} color={color} onChange={(val) => onEQChange('high', val)} />
          <Knob label="MID" value={v('eq_mid')} color={color} onChange={(val) => onEQChange('mid', val)} />
          <Knob label="LOW" value={v('eq_low')} color={color} onChange={(val) => onEQChange('low', val)} />
        </Box>

        {/* Tempo verticale */}
        <Box flexShrink={0} sx={{ minHeight: 200 }}>
          <VerticalTempoFader value={v('tempo')} color={color} onChange={onTempoChange} />
        </Box>

        {/* Volume + pad, occupano lo spazio restante */}
        <Box flex={1} minWidth={180} display="flex" flexDirection="column" gap={1.5}>
          <Fader label="VOLUME" value={v('volume')} color={color} onChange={onVolumeChange} />
          <PadGrid active={hotcueActive} color={color} />
        </Box>
      </Box>
    </Paper>
  );
}
