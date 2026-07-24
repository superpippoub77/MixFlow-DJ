import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audioEngine';
import type { DeckSnapshot } from './deck';
import type { DDJ200Event } from '../midi/decodeDDJ200';

export function useAudioEngine(onEvent: (cb: (e: DDJ200Event) => void) => () => void) {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const [snapshots, setSnapshots] = useState<Record<1 | 2, DeckSnapshot>>({
    1: engine.decks[1].getSnapshot(),
    2: engine.decks[2].getSnapshot(),
  });

  // Aggiorna la UI sia sugli eventi dei deck (play/pause/loadedmetadata/...)
  // sia con un piccolo polling, perché il player YouTube non emette eventi
  // continui per l'avanzamento del tempo.
  useEffect(() => {
    const refresh = () => setSnapshots({ 1: engine.decks[1].getSnapshot(), 2: engine.decks[2].getSnapshot() });
    const unsub1 = engine.decks[1].subscribe(refresh);
    const unsub2 = engine.decks[2].subscribe(refresh);
    const interval = setInterval(refresh, 250);
    return () => {
      unsub1();
      unsub2();
      clearInterval(interval);
    };
  }, [engine]);

  useEffect(() => {
    return onEvent((event) => {
      if (event.kind === 'unknown') return;

      if (event.kind === 'fader' && event.deck === 'master' && event.control === 'crossfader') {
        engine.setCrossfader(event.value);
        return;
      }
      if (event.kind === 'knob' && event.deck === 'master' && event.control === 'filter_deck1') {
        engine.decks[1].setFilter(event.value);
        return;
      }
      if (event.kind === 'knob' && event.deck === 'master' && event.control === 'filter_deck2') {
        engine.decks[2].setFilter(event.value);
        return;
      }
      if (event.deck === 'master') return;

      const deck = event.deck as 1 | 2;

      if (event.kind === 'button' && event.control === 'play' && event.pressed) {
        engine.decks[deck].togglePlay();
      }
      if (event.kind === 'button' && event.control === 'cue' && event.pressed) {
        engine.decks[deck].cue();
      }
      if (event.kind === 'knob' && event.control.startsWith('eq_')) {
        const band = event.control.slice(3) as 'low' | 'mid' | 'high';
        engine.decks[deck].setEQ(band, event.value);
      }
      if (event.kind === 'fader' && event.control === 'volume') {
        engine.setVolumeFader(deck, event.value);
      }
      if (event.kind === 'fader' && event.control === 'tempo') {
        engine.decks[deck].setTempo(event.value);
      }
      if (event.kind === 'jog') {
        if (event.control === 'seek') {
          engine.decks[deck].seekBy(event.delta * 0.3); // SHIFT + jog: spostamento veloce
        } else {
          engine.decks[deck].seekBy(event.delta * 0.02); // rotazione/scratch: nudge fine
        }
      }
    });
  }, [engine, onEvent]);

  return { engine, snapshots };
}
