import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import type { DeckSnapshot } from '../audio/deck';
import { TEMPO_RANGE_LABELS } from '../audio/deck';
import { DotDisplay } from './DotDisplay';
import { SpectrumDisplay } from './SpectrumDisplay';
import { formatTime, parseTimeInput } from '../utils/time';

export interface QueueEntry {
  id: string;
  title: string;
  source: 'local' | 'youtube';
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
  const effectiveBpm = bpm ? Math.round(bpm * track.playbackRate) : null;

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
        <DotDisplay color={color}>{effectiveBpm ? `${effectiveBpm} BPM` : '-- BPM'}</DotDisplay>
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

/** Campo "vai a" per saltare a un punto preciso senza dover ascoltare tutto il brano */
function JumpToTime({ color, onJump }: { color: string; onJump: (seconds: number) => void }) {
  const [value, setValue] = useState('');

  function parseAndJump() {
    const seconds = parseTimeInput(value);
    if (seconds != null) onJump(seconds);
  }

  return (
    <Box display="flex" alignItems="center" gap={0.6} mb={1}>
      <Typography variant="caption" sx={{ opacity: 0.55, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        VAI A
      </Typography>
      <input
        type="text"
        placeholder="mm:ss"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && parseAndJump()}
        style={{
          width: 54,
          background: '#181b20',
          border: '1px solid #2b2f37',
          borderRadius: 4,
          color: '#e8e9ec',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          padding: '2px 5px',
        }}
      />
      <Box
        onClick={parseAndJump}
        sx={{
          px: 1,
          py: 0.3,
          borderRadius: 1,
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          border: `1px solid ${color}`,
          color,
          cursor: 'pointer',
        }}
      >
        SALTA
      </Box>
    </Box>
  );
}

/** Coda del deck: elenco visibile, con skip / rimozione / riordino (frecce o drag&drop col mouse) */
function QueueList({
  queue,
  color,
  onSkipNext,
  onRemove,
  onMove,
  onReorderDrop,
}: {
  queue: QueueEntry[];
  color: string;
  onSkipNext: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onReorderDrop: (draggedId: string, targetId: string) => void;
}) {
  if (queue.length === 0) return null;
  return (
    <Box mb={1.5} sx={{ mt: -0.5 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
          In coda: {queue.length} {queue.length === 1 ? 'brano' : 'brani'}
        </Typography>
        <Box
          onClick={onSkipNext}
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: 1,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            border: `1px solid ${color}`,
            color,
            cursor: 'pointer',
          }}
        >
          SKIP ▶
        </Box>
      </Box>
      <Box display="flex" flexDirection="column" gap={0.4}>
        {queue.map((item, i) => (
          <Box
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', item.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData('text/plain');
              if (draggedId && draggedId !== item.id) onReorderDrop(draggedId, item.id);
            }}
            display="flex"
            alignItems="center"
            gap={0.5}
            sx={{ cursor: 'grab', borderRadius: 0.5, '&:hover': { background: '#1c1f25' } }}
          >
            <Typography variant="caption" sx={{ opacity: 0.35, fontSize: 11, px: 0.25 }}>
              ⠿
            </Typography>
            <Typography variant="caption" noWrap sx={{ flex: 1, opacity: 0.8, fontSize: 11 }}>
              {i + 1}. {item.title}
            </Typography>
            <Box
              onClick={() => i > 0 && onMove(item.id, 'up')}
              sx={{ cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.25 : 0.7, px: 0.5, fontSize: 11 }}
            >
              ▲
            </Box>
            <Box
              onClick={() => i < queue.length - 1 && onMove(item.id, 'down')}
              sx={{ cursor: i === queue.length - 1 ? 'default' : 'pointer', opacity: i === queue.length - 1 ? 0.25 : 0.7, px: 0.5, fontSize: 11 }}
            >
              ▼
            </Box>
            <Box onClick={() => onRemove(item.id)} sx={{ cursor: 'pointer', opacity: 0.7, color: '#ff5470', px: 0.5, fontSize: 13 }}>
              ×
            </Box>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.35, fontSize: 9, display: 'block', mt: 0.5 }}>
        Trascina ⠿ per riordinare (mouse) o usa ▲▼ (anche da touch/mobile).
      </Typography>
    </Box>
  );
}

const KNOB_TICK_VALUES = [0, 0.25, 0.5, 0.75, 1];

function Knob({
  label,
  value,
  color,
  onChange,
  id,
  tickLabels,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
  id?: string;
  tickLabels?: string[];
}) {
  const angle = -135 + value * 270; // -135°..+135°
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const size = 40;
  const center = size / 2;

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
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.4} width={60}>
      <Box sx={{ position: 'relative', width: size + 26, height: size + 26 }}>
        {/* Tacche + numeri intorno al knob */}
        {KNOB_TICK_VALUES.map((tickValue, i) => {
          const tickAngleDeg = -135 + tickValue * 270;
          const rad = (tickAngleDeg * Math.PI) / 180;
          const tickR = center + 7;
          const labelR = center + 15;
          const tx = center + 13 + tickR * Math.sin(rad);
          const ty = center + 13 - tickR * Math.cos(rad);
          const lx = center + 13 + labelR * Math.sin(rad);
          const ly = center + 13 - labelR * Math.cos(rad);
          return (
            <Box key={tickValue}>
              <Box
                sx={{
                  position: 'absolute',
                  left: tx,
                  top: ty,
                  width: 2,
                  height: 4,
                  background: '#3a3f48',
                  transform: `translate(-1px, -2px) rotate(${tickAngleDeg}deg)`,
                }}
              />
              {tickLabels && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    left: lx,
                    top: ly,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 7,
                    fontFamily: 'JetBrains Mono, monospace',
                    opacity: 0.45,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tickLabels[i]}
                </Typography>
              )}
            </Box>
          );
        })}
        <Box
          id={id}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          sx={{
            position: 'absolute',
            left: 13,
            top: 13,
            width: size,
            height: size,
            borderRadius: '50%',
            border: '2px solid #2b2f37',
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
              height: 14,
              background: color,
              transformOrigin: '1px 17px',
              transform: `rotate(${angle}deg)`,
              pointerEvents: 'none',
            }}
          />
        </Box>
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        {label}
      </Typography>
    </Box>
  );
}

/** Fader verticale (tempo), come sull'hardware reale: 0 al centro, tacche +/- ai lati */
function VerticalTempoFader({
  value,
  color,
  onChange,
  tempoRangePercent,
}: {
  value: number;
  color: string;
  onChange: (v: number) => void;
  tempoRangePercent: number;
}) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5} height="100%">
      <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        -
      </Typography>
      <Box display="flex" alignItems="center" gap={0.5} sx={{ flex: 1, minHeight: 120 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '100%',
            py: 0.5,
          }}
        >
          {[tempoRangePercent, tempoRangePercent / 2, 0, -tempoRangePercent / 2, -tempoRangePercent].map((v, i) => (
            <Typography key={i} variant="caption" sx={{ fontSize: 7, opacity: 0.4, fontFamily: 'JetBrains Mono, monospace' }}>
              {v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0)}
            </Typography>
          ))}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: '100%',
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
              transform: 'rotate(90deg)',
              transformOrigin: 'center',
            }}
          />
        </Box>
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
        +
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em' }}>
        TEMPO
      </Typography>
      <DotDisplay color={color}>{((value - 0.5) * 2 * tempoRangePercent).toFixed(1)}%</DotDisplay>
    </Box>
  );
}

function Fader({ label, value, color, onChange, id }: { label: string; value: number; color: string; onChange: (v: number) => void; id?: string }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5} width={72}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
          {label}
        </Typography>
        <DotDisplay color={color}>{(value * 100).toFixed(0)}%</DotDisplay>
      </Box>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
      />
      <Box display="flex" justifyContent="space-between" width="100%" sx={{ px: 0.2 }}>
        {['0', '25', '50', '75', '100'].map((tick) => (
          <Typography key={tick} variant="caption" sx={{ fontSize: 7, opacity: 0.4, fontFamily: 'JetBrains Mono, monospace' }}>
            {tick}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

const BEAT_LOOP_LABELS = ['1/16', '1/8', '1/4', '1/2', '1', '2', '4', '8'];

function PadGrid({
  active,
  color,
  onPad,
  padOneId,
  padMode,
  onTogglePadMode,
  loopActive,
  bpmKnown,
  deck,
  testActive,
}: {
  active: Record<number, boolean>;
  color: string;
  onPad: (pad: number) => void;
  padOneId?: string;
  padMode: 'hotcue' | 'beatloop';
  onTogglePadMode: () => void;
  loopActive: boolean;
  bpmKnown: boolean;
  deck: 1 | 2;
  testActive: string | null;
}) {
  const [flashingPad, setFlashingPad] = useState<number | null>(null);

  function handlePadClick(pad: number) {
    onPad(pad);
    setFlashingPad(pad);
    window.setTimeout(() => setFlashingPad((current) => (current === pad ? null : current)), 150);
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography variant="caption" sx={{ opacity: 0.5, fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em' }}>
          PERFORMANCE PADS
        </Typography>
        <Box
          onClick={onTogglePadMode}
          sx={{
            px: 0.8,
            py: 0.15,
            borderRadius: 0.5,
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            border: `1px solid ${color}`,
            color,
            cursor: 'pointer',
          }}
        >
          {padMode === 'hotcue' ? 'HOT CUE' : 'BEAT LOOP'}
        </Box>
      </Box>
      {padMode === 'beatloop' && !bpmKnown && (
        <Typography variant="caption" sx={{ opacity: 0.5, fontSize: 9, display: 'block', mb: 0.5 }}>
          Serve il BPM (solo file locali) per calcolare la durata del loop.
        </Typography>
      )}
      <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={0.75}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((pad) => {
          const isSet = padMode === 'hotcue' ? active[pad] || testActive === `${deck}-pad-${pad}` : loopActive || testActive === `${deck}-pad-${pad}`;
          const isFlashing = flashingPad === pad;
          const label = padMode === 'hotcue' ? pad : BEAT_LOOP_LABELS[pad - 1];
          return (
            <Box
              key={pad}
              id={pad === 1 ? padOneId : undefined}
              onClick={() => handlePadClick(pad)}
              sx={{
                height: 32,
                borderRadius: 1,
                border: `1px solid ${isSet ? color : '#2b2f37'}`,
                background: isFlashing ? '#ffffff' : isSet ? color : '#181b20',
                transition: 'background 60ms, border-color 60ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: padMode === 'beatloop' && !bpmKnown ? 0.4 : 1,
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, opacity: isSet || isFlashing ? 1 : 0.4, color: isSet || isFlashing ? '#111' : undefined }}>
                {label}
              </Typography>
            </Box>
          );
        })}
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
  id,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick?: () => void;
  size?: number;
  id?: string;
}) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={0.4}>
      <Box
        id={id}
        onClick={onClick}
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1.5px solid ${active ? color : '#2b2f37'}`,
          background: active ? color : '#181b20',
          cursor: onClick ? 'pointer' : 'default',
          opacity: onClick ? 1 : 0.5,
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
  jogAngle: number;
  jogTouched: boolean;
  track: DeckSnapshot;
  ytContainerId: string;
  bpm: number | null;
  beatPhase: number | null;
  analyser: AnalyserNode | null;
  queue: QueueEntry[];
  syncAvailable: boolean;
  onPlay: () => void;
  onCue: (pressed: boolean) => void;
  onSeek: (fraction: number) => void;
  onJumpToTime: (seconds: number) => void;
  onEQChange: (band: 'low' | 'mid' | 'high', value: number) => void;
  onFilterChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onTempoChange: (value: number) => void;
  onToggleCue: () => void;
  onToggleShift: () => void;
  onSync: () => void;
  onCycleTempoRange: () => void;
  testActive: string | null;
  onSkipNext: () => void;
  onRemoveQueueItem: (id: string) => void;
  onMoveQueueItem: (id: string, direction: 'up' | 'down') => void;
  onReorderQueueDrop: (draggedId: string, targetId: string) => void;
  onHotCue: (pad: number) => void;
  padMode: 'hotcue' | 'beatloop';
  onTogglePadMode: () => void;
  onBeatLoop: (pad: number) => void;
  focused: boolean;
}) {
  const {
    deck,
    color,
    values,
    jogAngle,
    jogTouched,
    track,
    ytContainerId,
    bpm,
    beatPhase,
    analyser,
    queue,
    syncAvailable,
    onPlay,
    onCue,
    onSeek,
    onJumpToTime,
    onEQChange,
    onFilterChange,
    onVolumeChange,
    onTempoChange,
    onToggleCue,
    onToggleShift,
    onSync,
    onCycleTempoRange,
    testActive,
    onSkipNext,
    onRemoveQueueItem,
    onMoveQueueItem,
    onReorderQueueDrop,
    onHotCue,
    padMode,
    onTogglePadMode,
    onBeatLoop,
    focused,
  } = props;
  const v = (name: string) => {
    if (values[`${deck}.${name}`] != null) return values[`${deck}.${name}`];
    // Valori di default sensati finché il controllo reale non viene letto
    // (dal SysEx di stato iniziale o al primo tocco): centro per EQ/tempo,
    // pieno per il volume — mai 0, che per EQ/tempo significherebbe un
    // estremo (taglio totale / pitch al minimo), non una posizione neutra.
    if (name === 'eq_low' || name === 'eq_mid' || name === 'eq_high' || name === 'tempo') return 0.5;
    if (name === 'volume') return 1;
    return 0;
  };
  const pressed = (name: string) => (values[`${deck}.${name}`] ?? 0) > 0;
  const filterValue = values[`master.filter_deck${deck}`] ?? 0.5;
  const lit = (actual: boolean, key: string) => actual || testActive === `${deck}-${key}`;
  const [jogPressed, setJogPressed] = useState(false);
  const [playFlash, setPlayFlash] = useState(false);

  // Il controller fisico a volte manda "premuto"+"rilasciato" in pochi millisecondi
  // (troppo veloce perché l'occhio lo veda): questo effetto garantisce un lampo
  // visibile di almeno 180ms ogni volta che arriva una pressione reale da MIDI.
  const playRaw = (values[`${deck}.play`] ?? 0) > 0;
  useEffect(() => {
    if (!playRaw) return;
    setPlayFlash(true);
    const timer = window.setTimeout(() => setPlayFlash(false), 180);
    return () => window.clearTimeout(timer);
  }, [playRaw]);

  return (
    <Paper
      sx={{
        p: 2,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        border: focused ? `2px solid ${color}` : undefined,
        transition: 'border-color 120ms',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h6" sx={{ color }}>
          Deck {deck}
        </Typography>
        <Box
          onClick={onToggleShift}
          sx={{
            px: 1,
            py: 0.4,
            borderRadius: 1,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
            cursor: 'pointer',
            border: `1px solid ${pressed('shift') ? color : '#2b2f37'}`,
            background: pressed('shift') ? color : 'transparent',
            color: pressed('shift') ? '#111' : '#8b909c',
          }}
        >
          shift
        </Box>
      </Box>

      <NowPlaying track={track} color={color} ytContainerId={ytContainerId} onSeek={onSeek} bpm={bpm} />
      <SpectrumDisplay
        analyser={analyser}
        color={color}
        bpm={bpm}
        phase={beatPhase}
        currentTime={track.currentTime}
        playbackRate={track.playbackRate}
      />
      <JumpToTime color={color} onJump={onJumpToTime} />
      <QueueList
        queue={queue}
        color={color}
        onSkipNext={onSkipNext}
        onRemove={onRemoveQueueItem}
        onMove={onMoveQueueItem}
        onReorderDrop={onReorderQueueDrop}
      />

      <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap" flex={1}>
        {/* Colonna jog + trasporto, come sull'hardware */}
        <Box display="flex" flexDirection="column" alignItems="center" gap={1} flexShrink={0}>
          <Box
            onPointerDown={() => setJogPressed(true)}
            onPointerUp={() => setJogPressed(false)}
            onPointerLeave={() => setJogPressed(false)}
            sx={{
              width: 108,
              height: 108,
              borderRadius: '50%',
              border: `2px solid ${jogTouched || jogPressed ? color : '#2b2f37'}`,
              position: 'relative',
              background: '#181b20',
              cursor: 'pointer',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 3,
                height: 42,
                marginLeft: '-1.5px',
                marginTop: '-42px',
                background: color,
                transformOrigin: '1.5px 42px',
                transform: `rotate(${jogAngle}deg)`,
              }}
            />
          </Box>

          <Box display="flex" gap={1.5}>
            <RoundButton
              id={deck === 1 ? 'tid-deck1-sync' : undefined}
              label="BEAT SYNC"
              active={lit(track.syncActive, 'sync')}
              color={color}
              size={30}
              onClick={syncAvailable ? onSync : undefined}
            />
            <Box display="flex" flexDirection="column" alignItems="center" gap={0.4}>
              <RoundButton label="TEMPO RANGE" active={false} color={color} size={30} onClick={onCycleTempoRange} />
              <DotDisplay color={color}>{TEMPO_RANGE_LABELS[track.tempoRange] ?? '±8%'}</DotDisplay>
            </Box>
          </Box>

          <Box display="flex" gap={1}>
            <Box
              id={deck === 1 ? 'tid-deck1-cue' : undefined}
              onPointerDown={() => onCue(true)}
              onPointerUp={() => onCue(false)}
              onPointerLeave={() => onCue(false)}
              sx={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: `2px solid ${lit(track.cuePointSet, 'cue') ? color : '#2b2f37'}`,
                background: lit(track.cuePointSet, 'cue') ? color : '#181b20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                color: lit(track.cuePointSet, 'cue') ? '#111' : '#8b909c',
                transition: 'background 60ms, border-color 60ms',
              }}
            >
              CUE
            </Box>
            <Box
              id={deck === 1 ? 'tid-deck1-play' : undefined}
              onClick={onPlay}
              sx={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: `2px solid ${lit(track.playing || playFlash, 'play') ? color : '#2b2f37'}`,
                background: lit(track.playing || playFlash, 'play') ? color : '#181b20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: lit(track.playing || playFlash, 'play') ? '#111' : color,
              }}
            >
              {track.playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
            </Box>
          </Box>

          <Box
            onClick={onToggleCue}
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: `1.5px solid ${lit(track.cueActive, 'headphone') ? color : '#2b2f37'}`,
              background: lit(track.cueActive, 'headphone') ? color : '#181b20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: lit(track.cueActive, 'headphone') ? '#111' : '#8b909c',
            }}
          >
            <HeadphonesIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>

        {/* Colonna filtro + EQ, come sul mixer reale */}
        <Box display="flex" flexDirection="column" alignItems="center" gap={1.5} flexShrink={0}>
          <Knob
            id={deck === 1 ? 'tid-deck1-filter' : undefined}
            label="FILTER"
            value={filterValue}
            color={color}
            onChange={onFilterChange}
            tickLabels={['◄◄', '◄', '0', '►', '►►']}
          />
          <Knob label="HIGH" value={v('eq_high')} color={color} onChange={(val) => onEQChange('high', val)} tickLabels={['-12', '-6', '0', '+6', '+12']} />
          <Knob label="MID" value={v('eq_mid')} color={color} onChange={(val) => onEQChange('mid', val)} tickLabels={['-12', '-6', '0', '+6', '+12']} />
          <Knob
            id={deck === 1 ? 'tid-deck1-eq-low' : undefined}
            label="LOW"
            value={v('eq_low')}
            color={color}
            onChange={(val) => onEQChange('low', val)}
            tickLabels={['-12', '-6', '0', '+6', '+12']}
          />
        </Box>

        {/* Tempo verticale */}
        <Box flexShrink={0} sx={{ minHeight: 200 }}>
          <VerticalTempoFader value={v('tempo')} color={color} onChange={onTempoChange} tempoRangePercent={track.tempoRange * 100} />
        </Box>

        {/* Volume + pad, occupano lo spazio restante */}
        <Box flex={1} minWidth={180} display="flex" flexDirection="column" gap={1.5}>
          <Fader id={deck === 1 ? 'tid-deck1-volume' : undefined} label="VOLUME" value={v('volume')} color={color} onChange={onVolumeChange} />
          <PadGrid
            active={track.hotCues}
            color={color}
            onPad={padMode === 'hotcue' ? onHotCue : onBeatLoop}
            padOneId={deck === 1 ? 'tid-deck1-pad1' : undefined}
            padMode={padMode}
            onTogglePadMode={onTogglePadMode}
            loopActive={track.loopActive}
            bpmKnown={bpm != null}
            deck={deck}
            testActive={testActive}
          />
        </Box>
      </Box>
    </Paper>
  );
}
