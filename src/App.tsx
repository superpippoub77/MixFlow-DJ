import { useEffect, useRef, useState } from 'react';
import { Box, Container, Paper, Typography, Alert } from '@mui/material';
import { StatusBar } from './components/StatusBar';
import { DeckPanel, type QueueEntry } from './components/DeckPanel';
import { MasterPanel } from './components/MasterPanel';
import { EventLog } from './components/EventLog';
import { LibraryPanel } from './components/LibraryPanel';
import { RecordingPanel, type Recording } from './components/RecordingPanel';
import { FxPadPanel } from './components/FxPadPanel';
import { InfoDialog } from './components/InfoDialog';
import { Footer } from './components/Footer';
import { useDDJ200 } from './midi/useDDJ200';
import { useAudioEngine } from './audio/useAudioEngine';
import { useAutoMix, type TransitionStyle } from './audio/useAutoMix';
import { TutorialOverlay } from './components/TutorialOverlay';
import { detectBpm } from './audio/bpmDetect';
import { MixRecorder } from './audio/recorder';
import { DEFAULT_TRIM, TEMPO_RANGES, type TrimSettings } from './audio/deck';
import { palette } from './theme';

type QueueItem =
  | { id: string; source: 'local'; file: File; title: string }
  | { id: string; source: 'youtube'; videoId: string; title: string };

type QueueItemInput =
  | { source: 'local'; file: File; title: string }
  | { source: 'youtube'; videoId: string; title: string };

import { localTrackKey, youtubeTrackKey } from './utils/trackKey';

/** Chiave stabile per associare inizio/fine/fade a un brano, indipendentemente da quante volte viene ricaricato */
function trackKey(item: QueueItem): string {
  return item.source === 'local' ? localTrackKey(item.file) : youtubeTrackKey(item.videoId);
}

function useJogAngles(onEvent: ReturnType<typeof useDDJ200>['onEvent']) {
  const [angles, setAngles] = useState<Record<1 | 2, number>>({ 1: 0, 2: 0 });
  const anglesRef = useRef(angles);
  anglesRef.current = angles;

  useEffect(() => {
    return onEvent((e) => {
      if (e.kind === 'jog' && (e.control === 'jog_rotation' || e.control === 'scratch') && e.deck !== 'master') {
        const deck = e.deck as 1 | 2;
        setAngles((prev) => ({ ...prev, [deck]: prev[deck] + e.delta * 6 }));
      }
    });
  }, [onEvent]);

  return angles;
}

/**
 * Tiene i valori impostati manualmente dal mouse (quando il controller non è
 * collegato, o semplicemente perché si preferisce usare la UI). Se poi arriva
 * un comando MIDI reale per la stessa chiave, l'override viene rimosso e
 * torna a comandare l'hardware: il controller ha sempre l'ultima parola.
 */
function useManualOverrides(onEvent: ReturnType<typeof useDDJ200>['onEvent'], baseValues: Record<string, number>) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    return onEvent((e) => {
      const key = e.kind === 'unknown' ? undefined : e.key;
      if (!key) return;
      setOverrides((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  }, [onEvent]);

  function setManual(key: string, value: number) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }

  const values = { ...baseValues, ...overrides };
  return { values, setManual };
}

export default function App() {
  const ddj = useDDJ200();
  const jogAngles = useJogAngles(ddj.onEvent);
  const [bpms, setBpms] = useState<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const { engine, snapshots } = useAudioEngine(ddj.onEvent, bpms);
  const { values, setManual } = useManualOverrides(ddj.onEvent, ddj.values);
  const [queues, setQueues] = useState<Record<1 | 2, QueueItem[]>>({ 1: [], 2: [] });
  const [trackSettings, setTrackSettings] = useState<Record<string, TrimSettings>>(() => {
    try {
      const saved = localStorage.getItem('mixflowdj_track_settings');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('mixflowdj_track_settings', JSON.stringify(trackSettings));
  }, [trackSettings]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>('crossfade');

  // --- registrazione del mix ---
  const recorderRef = useRef<MixRecorder | null>(null);
  if (!recorderRef.current) recorderRef.current = new MixRecorder(engine.getRecordingStream());
  const [recording, setRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const recordStartRef = useRef(0);

  useEffect(() => {
    recorderRef.current!.onStop = (blob, durationSeconds) => {
      const url = URL.createObjectURL(blob);
      setRecordings((prev) => [...prev, { url, name: `mixflowdj-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, durationSeconds }]);
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setRecordElapsed((performance.now() - recordStartRef.current) / 1000), 500);
    return () => clearInterval(interval);
  }, [recording]);

  function handleToggleRecord() {
    engine.resume();
    if (recording) {
      recorderRef.current!.stop();
      setRecording(false);
    } else {
      recordStartRef.current = performance.now();
      setRecordElapsed(0);
      recorderRef.current!.start();
      setRecording(true);
    }
  }

  function handleCrossfaderChange(value: number) {
    engine.setCrossfader(value);
    setManual('master.crossfader', value);
  }

  const automix = useAutoMix(engine, snapshots, bpms, handleCrossfaderChange, transitionStyle);

  function handleConnect() {
    engine.resume(); // sblocca l'AudioContext (e il preview cuffie) dentro un gesto utente reale (click)
    ddj.connect();
  }

  // I controlli della UI (mouse/touch) funzionano indipendentemente dal
  // controller: agiscono subito sull'AudioEngine e aggiornano la UI con un
  // override locale, così tutto resta utilizzabile anche senza il DDJ-200.
  function handlePlay(deck: 1 | 2) {
    engine.resume();
    engine.decks[deck].togglePlay();
  }
  function handleCue(deck: 1 | 2) {
    engine.resume();
    engine.decks[deck].cue();
  }
  function handleSeek(deck: 1 | 2, fraction: number) {
    const duration = engine.decks[deck].getDuration();
    if (duration > 0) engine.decks[deck].seekTo(fraction * duration);
  }
  function handleJumpToTime(deck: 1 | 2, seconds: number) {
    engine.decks[deck].seekTo(seconds);
  }
  function handleSync(deck: 1 | 2) {
    engine.toggleSync(deck, bpms);
  }
  function handleCycleTempoRange(deck: 1 | 2) {
    const current = engine.decks[deck].getTempoRange();
    const idx = TEMPO_RANGES.indexOf(current as (typeof TEMPO_RANGES)[number]);
    const next = TEMPO_RANGES[(idx + 1) % TEMPO_RANGES.length];
    engine.decks[deck].setTempoRange(next);
  }
  function handleEQChange(deck: 1 | 2, band: 'low' | 'mid' | 'high', value: number) {
    engine.decks[deck].setEQ(band, value);
    setManual(`${deck}.eq_${band}`, value);
  }
  function handleFilterChange(deck: 1 | 2, value: number) {
    engine.decks[deck].setFilter(value);
    setManual(`master.filter_deck${deck}`, value);
  }
  function handleVolumeChange(deck: 1 | 2, value: number) {
    engine.setVolumeFader(deck, value);
    setManual(`${deck}.volume`, value);
  }
  function handleTempoChange(deck: 1 | 2, value: number) {
    engine.decks[deck].setTempo(value);
    setManual(`${deck}.tempo`, value);
  }
  function handleToggleCue(deck: 1 | 2) {
    engine.resume();
    engine.decks[deck].toggleCue();
  }
  function handleToggleShift(deck: 1 | 2) {
    setManual(`${deck}.shift`, (values[`${deck}.shift`] ?? 0) > 0 ? 0 : 1);
  }
  function handleToggleMasterCue() {
    engine.resume();
    engine.setMasterCue(!engine.isMasterCueActive());
  }
  function handleSelectCueDevice(deviceId: string) {
    engine.cueMonitor.setOutputDevice(deviceId);
  }
  function handleHotCue(deck: 1 | 2, pad: number) {
    engine.resume();
    engine.decks[deck].setHotCueOrJump(pad);
  }

  // --- caricamento diretto (sostituisce subito quello che sta suonando sul deck) ---
  function loadItem(deck: 1 | 2, item: QueueItem) {
    engine.resume();
    const trim = trackSettings[trackKey(item)] ?? DEFAULT_TRIM;
    if (item.source === 'local') {
      engine.decks[deck].loadLocalFile(item.file, trim);
      setBpms((prev) => ({ ...prev, [deck]: null }));
      detectBpm(item.file).then((bpm) => setBpms((prev) => ({ ...prev, [deck]: bpm })));
    } else {
      engine.decks[deck].loadYoutube(item.videoId, item.title, trim);
      setBpms((prev) => ({ ...prev, [deck]: null }));
    }
  }

  // --- dalla Libreria: se il deck è libero carica subito, altrimenti accoda ---
  function enqueue(deck: 1 | 2, item: QueueItemInput) {
    if (!snapshots[deck].title) {
      loadItem(deck, { ...item, id: crypto.randomUUID() } as QueueItem);
    } else {
      setQueues((prev) => ({ ...prev, [deck]: [...prev[deck], { ...item, id: crypto.randomUUID() } as QueueItem] }));
    }
  }

  function handleUpdateTrackSettings(key: string, settings: TrimSettings) {
    setTrackSettings((prev) => ({ ...prev, [key]: settings }));
  }

  function handleLoadLocal(deck: 1 | 2, file: File) {
    enqueue(deck, { source: 'local', file, title: file.name });
  }
  function handleLoadYoutube(deck: 1 | 2, videoId: string, title: string) {
    enqueue(deck, { source: 'youtube', videoId, title });
  }

  function advanceQueue(deck: 1 | 2) {
    setQueues((prev) => {
      const [next, ...rest] = prev[deck];
      if (next) loadItem(deck, next);
      return { ...prev, [deck]: rest };
    });
  }

  function handleRemoveFromQueue(deck: 1 | 2, id: string) {
    setQueues((prev) => ({ ...prev, [deck]: prev[deck].filter((item) => item.id !== id) }));
  }

  function handleMoveQueueItem(deck: 1 | 2, id: string, direction: 'up' | 'down') {
    setQueues((prev) => {
      const list = [...prev[deck]];
      const idx = list.findIndex((item) => item.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return prev;
      [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
      return { ...prev, [deck]: list };
    });
  }

  function handleReorderQueueDrop(deck: 1 | 2, draggedId: string, targetId: string) {
    setQueues((prev) => {
      const list = [...prev[deck]];
      const fromIdx = list.findIndex((item) => item.id === draggedId);
      const toIdx = list.findIndex((item) => item.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { ...prev, [deck]: list };
    });
  }

  // Avanza automaticamente alla prossima traccia in coda quando quella attuale finisce da sola
  useEffect(() => {
    const unsub1 = engine.decks[1].onEnded(() => advanceQueue(1));
    const unsub2 = engine.decks[2].onEnded(() => advanceQueue(2));
    return () => {
      unsub1();
      unsub2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: palette.bg }}>
      <Container maxWidth={false} sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 }, flex: 1, width: '100%' }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <StatusBar
            status={ddj.status}
            error={ddj.error}
            inputs={ddj.inputs}
            selectedInputId={ddj.selectedInputId}
            onConnect={handleConnect}
            onSelectInput={ddj.selectInput}
            onInfoClick={() => setInfoOpen(true)}
            onTutorialClick={() => setTutorialOpen(true)}
          />
        </Paper>

        {ddj.status === 'unsupported' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Questo browser non implementa la Web MIDI API. Usa Chrome, Edge o Opera su desktop (Safari e Firefox non la
            supportano ancora pienamente). L'interfaccia resta comunque utilizzabile via mouse/touch.
          </Alert>
        )}

        {ddj.status === 'no-input' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Nessun controller rilevato: puoi comunque usare tutti i controlli con mouse o touch. Collega il DDJ-200 via
            USB e ricarica la pagina quando vuoi passare all'hardware.
          </Alert>
        )}

        <Box display="flex" flexDirection={{ xs: 'column', lg: 'row' }} gap={1.5} alignItems="stretch" mb={2}>
          <Box flex={1} minWidth={0}>
            <DeckPanel
              deck={1}
              color={palette.deck1}
              values={values}
              jogAngle={jogAngles[1]}
              jogTouched={(values['1.jog_touch'] ?? 0) > 0}
              track={snapshots[1]}
              ytContainerId={engine.decks[1].getYtContainerId()}
              bpm={bpms[1]}
              queue={queues[1].map(({ id, title, source }): QueueEntry => ({ id, title, source }))}
              syncAvailable={!!bpms[1] && !!bpms[2]}
              onPlay={() => handlePlay(1)}
              onCue={() => handleCue(1)}
              onSeek={(fraction) => handleSeek(1, fraction)}
              onJumpToTime={(seconds) => handleJumpToTime(1, seconds)}
              onEQChange={(band, val) => handleEQChange(1, band, val)}
              onFilterChange={(val) => handleFilterChange(1, val)}
              onVolumeChange={(val) => handleVolumeChange(1, val)}
              onTempoChange={(val) => handleTempoChange(1, val)}
              onToggleCue={() => handleToggleCue(1)}
              onToggleShift={() => handleToggleShift(1)}
              onSync={() => handleSync(1)}
              onCycleTempoRange={() => handleCycleTempoRange(1)}
              onSkipNext={() => advanceQueue(1)}
              onRemoveQueueItem={(id) => handleRemoveFromQueue(1, id)}
              onMoveQueueItem={(id, dir) => handleMoveQueueItem(1, id, dir)}
              onReorderQueueDrop={(draggedId, targetId) => handleReorderQueueDrop(1, draggedId, targetId)}
              onHotCue={(pad) => handleHotCue(1, pad)}
            />
          </Box>

          <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
            <MasterPanel
              values={values}
              onCrossfaderChange={handleCrossfaderChange}
              automixEnabled={automix.enabled}
              onToggleAutomix={() => automix.setEnabled((v) => !v)}
              automixStatus={automix.status}
              transitionStyle={transitionStyle}
              onChangeTransitionStyle={setTransitionStyle}
              masterCueActive={engine.isMasterCueActive()}
              onToggleMasterCue={handleToggleMasterCue}
              cueDeviceSupported={engine.cueMonitor.supportsDeviceSelection()}
              onSelectCueDevice={handleSelectCueDevice}
            />
          </Box>

          <Box flex={1} minWidth={0}>
            <DeckPanel
              deck={2}
              color={palette.deck2}
              values={values}
              jogAngle={jogAngles[2]}
              jogTouched={(values['2.jog_touch'] ?? 0) > 0}
              track={snapshots[2]}
              ytContainerId={engine.decks[2].getYtContainerId()}
              bpm={bpms[2]}
              queue={queues[2].map(({ id, title, source }): QueueEntry => ({ id, title, source }))}
              syncAvailable={!!bpms[1] && !!bpms[2]}
              onPlay={() => handlePlay(2)}
              onCue={() => handleCue(2)}
              onSeek={(fraction) => handleSeek(2, fraction)}
              onJumpToTime={(seconds) => handleJumpToTime(2, seconds)}
              onEQChange={(band, val) => handleEQChange(2, band, val)}
              onFilterChange={(val) => handleFilterChange(2, val)}
              onVolumeChange={(val) => handleVolumeChange(2, val)}
              onTempoChange={(val) => handleTempoChange(2, val)}
              onToggleCue={() => handleToggleCue(2)}
              onToggleShift={() => handleToggleShift(2)}
              onSync={() => handleSync(2)}
              onCycleTempoRange={() => handleCycleTempoRange(2)}
              onSkipNext={() => advanceQueue(2)}
              onRemoveQueueItem={(id) => handleRemoveFromQueue(2, id)}
              onMoveQueueItem={(id, dir) => handleMoveQueueItem(2, id, dir)}
              onReorderQueueDrop={(draggedId, targetId) => handleReorderQueueDrop(2, draggedId, targetId)}
              onHotCue={(pad) => handleHotCue(2, pad)}
            />
          </Box>
        </Box>

        <Box mb={2}>
          <FxPadPanel
            onSiren={() => {
              engine.resume();
              engine.fx.triggerSiren();
            }}
            onRiser={() => {
              engine.resume();
              engine.fx.triggerRiser();
            }}
            onAirhorn={() => {
              engine.resume();
              engine.fx.triggerAirhorn();
            }}
            onNoiseSweep={() => {
              engine.resume();
              engine.fx.triggerNoiseSweep();
            }}
            onToggleEcho={() => {
              engine.resume();
              engine.fx.toggleEcho();
            }}
            echoActive={engine.fx.isEchoActive()}
          />
        </Box>

        <Box mb={2}>
          <RecordingPanel
            supported={typeof MediaRecorder !== 'undefined'}
            recording={recording}
            elapsedSeconds={recordElapsed}
            recordings={recordings}
            onToggleRecord={handleToggleRecord}
          />
        </Box>

        <Box mb={2}>
          <LibraryPanel
            onLoadLocal={handleLoadLocal}
            onLoadYoutube={handleLoadYoutube}
            trackSettings={trackSettings}
            onUpdateTrackSettings={handleUpdateTrackSettings}
          />
        </Box>

        <EventLog log={ddj.log} />

        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mt: 2 }}>
          Integrazione: usa <code>ddj.onEvent(callback)</code> nel tuo codice per ricevere ogni comando gia decodificato
          (pulsante, hotcue, knob, fader, jog) e applicarlo alla tua applicazione. Premi l'icona ⓘ in alto per la guida
          completa a tutte le funzioni.
        </Typography>
      </Container>
      <Footer />
      <InfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} />
      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </Box>
  );
}
