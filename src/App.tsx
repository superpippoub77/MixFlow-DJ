import { useEffect, useRef, useState } from 'react';
import { Box, Container, Paper, Typography, Alert } from '@mui/material';
import { StatusBar } from './components/StatusBar';
import { DeckPanel } from './components/DeckPanel';
import { MasterPanel } from './components/MasterPanel';
import { EventLog } from './components/EventLog';
import { LibraryPanel } from './components/LibraryPanel';
import { Footer } from './components/Footer';
import { useDDJ200 } from './midi/useDDJ200';
import { useAudioEngine } from './audio/useAudioEngine';
import { useAutoMix } from './audio/useAutoMix';
import { detectBpm } from './audio/bpmDetect';
import { palette } from './theme';

type QueueItem = { source: 'local'; file: File; title: string } | { source: 'youtube'; videoId: string; title: string };

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

function extractHotcues(values: Record<string, number>, deck: 1 | 2) {
  const result: Record<number, boolean> = {};
  for (let pad = 1; pad <= 8; pad++) {
    result[pad] = (values[`${deck}.hotcue_${pad}`] ?? 0) > 0;
  }
  return result;
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
  const { engine, snapshots } = useAudioEngine(ddj.onEvent);
  const { values, setManual } = useManualOverrides(ddj.onEvent, ddj.values);
  const [bpms, setBpms] = useState<Record<1 | 2, number | null>>({ 1: null, 2: null });
  const [queues, setQueues] = useState<Record<1 | 2, QueueItem[]>>({ 1: [], 2: [] });

  function handleCrossfaderChange(value: number) {
    engine.setCrossfader(value);
    setManual('master.crossfader', value);
  }

  const automix = useAutoMix(engine, snapshots, bpms, handleCrossfaderChange);

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
  function handleToggleMasterCue() {
    engine.resume();
    engine.setMasterCue(!engine.isMasterCueActive());
  }
  function handleSelectCueDevice(deviceId: string) {
    engine.cueMonitor.setOutputDevice(deviceId);
  }

  // --- caricamento diretto (sostituisce subito quello che sta suonando sul deck) ---
  function loadItem(deck: 1 | 2, item: QueueItem) {
    engine.resume();
    if (item.source === 'local') {
      engine.decks[deck].loadLocalFile(item.file);
      setBpms((prev) => ({ ...prev, [deck]: null }));
      detectBpm(item.file).then((bpm) => setBpms((prev) => ({ ...prev, [deck]: bpm })));
    } else {
      engine.decks[deck].loadYoutube(item.videoId, item.title);
      setBpms((prev) => ({ ...prev, [deck]: null }));
    }
  }

  // --- dalla Libreria: se il deck è libero carica subito, altrimenti accoda ---
  function enqueue(deck: 1 | 2, item: QueueItem) {
    if (!snapshots[deck].title) {
      loadItem(deck, item);
    } else {
      setQueues((prev) => ({ ...prev, [deck]: [...prev[deck], item] }));
    }
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
              hotcueActive={extractHotcues(values, 1)}
              jogAngle={jogAngles[1]}
              jogTouched={(values['1.jog_touch'] ?? 0) > 0}
              track={snapshots[1]}
              ytContainerId={engine.decks[1].getYtContainerId()}
              bpm={bpms[1]}
              queueCount={queues[1].length}
              onPlay={() => handlePlay(1)}
              onCue={() => handleCue(1)}
              onSeek={(fraction) => handleSeek(1, fraction)}
              onEQChange={(band, val) => handleEQChange(1, band, val)}
              onFilterChange={(val) => handleFilterChange(1, val)}
              onVolumeChange={(val) => handleVolumeChange(1, val)}
              onTempoChange={(val) => handleTempoChange(1, val)}
              onToggleCue={() => handleToggleCue(1)}
              onSkipNext={() => advanceQueue(1)}
            />
          </Box>

          <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
            <MasterPanel
              values={values}
              onCrossfaderChange={handleCrossfaderChange}
              automixEnabled={automix.enabled}
              onToggleAutomix={() => automix.setEnabled((v) => !v)}
              automixStatus={automix.status}
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
              hotcueActive={extractHotcues(values, 2)}
              jogAngle={jogAngles[2]}
              jogTouched={(values['2.jog_touch'] ?? 0) > 0}
              track={snapshots[2]}
              ytContainerId={engine.decks[2].getYtContainerId()}
              bpm={bpms[2]}
              queueCount={queues[2].length}
              onPlay={() => handlePlay(2)}
              onCue={() => handleCue(2)}
              onSeek={(fraction) => handleSeek(2, fraction)}
              onEQChange={(band, val) => handleEQChange(2, band, val)}
              onFilterChange={(val) => handleFilterChange(2, val)}
              onVolumeChange={(val) => handleVolumeChange(2, val)}
              onTempoChange={(val) => handleTempoChange(2, val)}
              onToggleCue={() => handleToggleCue(2)}
              onSkipNext={() => advanceQueue(2)}
            />
          </Box>
        </Box>

        <Box mb={2}>
          <LibraryPanel onLoadLocal={handleLoadLocal} onLoadYoutube={handleLoadYoutube} />
        </Box>

        <EventLog log={ddj.log} />

        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mt: 2 }}>
          Integrazione: usa <code>ddj.onEvent(callback)</code> nel tuo codice per ricevere ogni comando gia decodificato
          (pulsante, hotcue, knob, fader, jog) e applicarlo alla tua applicazione. Tutti i controlli funzionano anche via
          mouse/touch senza controller collegato; se il DDJ-200 è collegato, i suoi comandi hanno sempre la precedenza.
          L'Automix (pulsante TRANSITION FX) mixa in automatico verso il deck successivo quando il brano attivo sta per
          finire, sincronizzando il pitch se il BPM di entrambe le tracce è noto (solo file locali). Dalla Libreria, "→
          D1/D2" carica subito se il deck è libero, altrimenti accoda il brano: parte da solo quando finisce quello
          attuale (o subito con SKIP).
        </Typography>
      </Container>
      <Footer />
    </Box>
  );
}
