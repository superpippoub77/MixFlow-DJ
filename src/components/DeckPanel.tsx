import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import type { DeckSnapshot } from '../audio/deck';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function NowPlaying({ track, color, ytContainerId }: { track: DeckSnapshot; color: string; ytContainerId: string }) {
  const progress = track.duration > 0 ? (track.currentTime / track.duration) * 100 : 0;
  return (
    <Box mb={2}>
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
        <Box flex={1}>
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
          <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
            {formatTime(track.currentTime)} / {formatTime(track.duration)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Knob({ label, value, color }: { label: string; value: number; color: string }) {
  const angle = -135 + value * 270; // -135°..+135°
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5} width={64}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2px solid #2b2f37',
          position: 'relative',
          background: '#181b20',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 3,
            left: '50%',
            width: 2,
            height: 15,
            background: color,
            transformOrigin: '1px 17px',
            transform: `rotate(${angle}deg)`,
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
        {label}
      </Typography>
    </Box>
  );
}

function Fader({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5} width={72}>
      <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
        {label} {(value * 100).toFixed(0)}%
      </Typography>
      <LinearProgress
        variant="determinate"
        value={value * 100}
        sx={{
          width: '100%',
          height: 8,
          borderRadius: 4,
          background: '#181b20',
          '& .MuiLinearProgress-bar': { background: color },
        }}
      />
    </Box>
  );
}

function PadGrid({
  active,
  color,
}: {
  active: Record<number, boolean>;
  color: string;
}) {
  return (
    <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={0.75} width={160}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((pad) => (
        <Box
          key={pad}
          sx={{
            height: 28,
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
}) {
  const { deck, color, values, hotcueActive, jogAngle, jogTouched, track, ytContainerId } = props;
  const v = (name: string) => values[`${deck}.${name}`] ?? 0;
  const pressed = (name: string) => (values[`${deck}.${name}`] ?? 0) > 0;

  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 260 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Typography variant="h6" sx={{ color }}>
          Deck {deck}
        </Typography>
        <Box display="flex" gap={0.75}>
          {['play', 'cue', 'sync', 'headphone_cue', 'shift'].map((btn) => (
            <Box
              key={btn}
              sx={{
                px: 1,
                py: 0.4,
                borderRadius: 1,
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                border: `1px solid ${pressed(btn) ? color : '#2b2f37'}`,
                background: pressed(btn) ? color : 'transparent',
                color: pressed(btn) ? '#111' : '#8b909c',
              }}
            >
              {btn === 'headphone_cue' ? 'pfl' : btn}
            </Box>
          ))}
        </Box>
      </Box>

      <NowPlaying track={track} color={color} ytContainerId={ytContainerId} />
      <Box display="flex" gap={2} alignItems="center" mb={2}>
        {/* Jog wheel */}
        <Box
          sx={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: `2px solid ${jogTouched ? color : '#2b2f37'}`,
            position: 'relative',
            flexShrink: 0,
            background: '#181b20',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 3,
              height: 30,
              background: color,
              transformOrigin: '1.5px 0px',
              transform: `translate(-1.5px, -30px) rotate(${jogAngle}deg)`,
            }}
          />
        </Box>

        <Box display="flex" gap={1.5}>
          <Knob label="LOW" value={v('eq_low')} color={color} />
          <Knob label="MID" value={v('eq_mid')} color={color} />
          <Knob label="HIGH" value={v('eq_high')} color={color} />
        </Box>
      </Box>

      <Box display="flex" gap={2} mb={2}>
        <Fader label="VOLUME" value={v('volume')} color={color} />
        <Fader label="TEMPO" value={v('tempo')} color={color} />
      </Box>

      <PadGrid active={hotcueActive} color={color} />
    </Paper>
  );
}
