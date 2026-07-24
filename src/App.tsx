import { useEffect, useRef, useState } from 'react';
import { Box, Container, Paper, Typography, Alert } from '@mui/material';
import { StatusBar } from './components/StatusBar';
import { DeckPanel } from './components/DeckPanel';
import { MasterPanel } from './components/MasterPanel';
import { EventLog } from './components/EventLog';
import { LibraryPanel } from './components/LibraryPanel';
import { useDDJ200 } from './midi/useDDJ200';
import { useAudioEngine } from './audio/useAudioEngine';
import { palette } from './theme';

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

export default function App() {
  const ddj = useDDJ200();
  const jogAngles = useJogAngles(ddj.onEvent);
  const { engine, snapshots } = useAudioEngine(ddj.onEvent);

  function handleConnect() {
    engine.resume(); // sblocca l'AudioContext dentro un gesto utente reale (click)
    ddj.connect();
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: palette.bg, py: 4 }}>
      <Container maxWidth="lg">
        <Paper sx={{ p: 2, mb: 3 }}>
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
          <Alert severity="error" sx={{ mb: 3 }}>
            Questo browser non implementa la Web MIDI API. Usa Chrome, Edge o Opera su desktop (Safari e Firefox non la
            supportano ancora pienamente).
          </Alert>
        )}

        {ddj.status === 'no-input' && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Nessuna porta MIDI di input rilevata. Collega il DDJ-200 via USB e ricarica la pagina.
          </Alert>
        )}

        <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
          <DeckPanel
            deck={1}
            color={palette.deck1}
            values={ddj.values}
            hotcueActive={extractHotcues(ddj.values, 1)}
            jogAngle={jogAngles[1]}
            jogTouched={(ddj.values['1.jog_touch'] ?? 0) > 0}
            track={snapshots[1]}
            ytContainerId={engine.decks[1].getYtContainerId()}
          />
          <DeckPanel
            deck={2}
            color={palette.deck2}
            values={ddj.values}
            hotcueActive={extractHotcues(ddj.values, 2)}
            jogAngle={jogAngles[2]}
            jogTouched={(ddj.values['2.jog_touch'] ?? 0) > 0}
            track={snapshots[2]}
            ytContainerId={engine.decks[2].getYtContainerId()}
          />
        </Box>

        <Box mb={2}>
          <MasterPanel values={ddj.values} />
        </Box>

        <Box mb={2}>
          <LibraryPanel
            onLoadLocal={(deck, file) => engine.decks[deck].loadLocalFile(file)}
            onLoadYoutube={(deck, videoId, title) => engine.decks[deck].loadYoutube(videoId, title)}
          />
        </Box>

        <EventLog log={ddj.log} />

        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mt: 2 }}>
          Integrazione: usa <code>ddj.onEvent(callback)</code> nel tuo codice per ricevere ogni comando gia decodificato
          (pulsante, hotcue, knob, fader, jog) e applicarlo alla tua applicazione. La riproduzione (locale e YouTube) e
          gia collegata tramite <code>useAudioEngine</code>.
        </Typography>
      </Container>
    </Box>
  );
}
