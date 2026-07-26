import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audioEngine';
import { TEMPO_RANGES } from './deck';
import type { DeckSnapshot } from './deck';
import type { DDJ200Event } from '../midi/decodeDDJ200';

export function useAudioEngine(onEvent: (cb: (e: DDJ200Event) => void) => () => void, bpms: Record<1 | 2, number | null>) {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const bpmsRef = useRef(bpms);
  bpmsRef.current = bpms;

  // Stato "grezzo" di alcuni pulsanti fisici, tenuto qui (non in React state)
  // per rilevare correttamente il "fronte di salita" (appena premuto) e
  // ignorare eventuali messaggi ripetuti mentre il tasto resta fisicamente
  // giù: altrimenti un controller che manda più note-on ravvicinate farebbe
  // alternare un interruttore più volte in un solo tocco, sembrando "incastrato".
  const rawStateRef = useRef<{ headphoneCue: Record<1 | 2, boolean>; shift: Record<1 | 2, boolean> }>({
    headphoneCue: { 1: false, 2: false },
    shift: { 1: false, 2: false },
  });

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

      // Teniamo traccia dello stato "grezzo" di SHIFT per poter riconoscere la combinazione SHIFT + BEAT SYNC
      if (event.kind === 'button' && event.control === 'shift') {
        rawStateRef.current.shift[deck] = event.pressed;
      }

      if (event.kind === 'button' && event.control === 'play' && event.pressed) {
        engine.decks[deck].togglePlay();
      }
      if (event.kind === 'button' && event.control === 'cue') {
        engine.decks[deck].cue(event.pressed);
      }
      if (event.kind === 'button' && event.control === 'cue_goto_and_stop' && event.pressed) {
        // SHIFT + CUE: torna sempre all'inizio della traccia (non al cue point salvato)
        engine.decks[deck].goToStart();
      }
      if (event.kind === 'button' && event.control === 'headphone_cue') {
        const wasPressed = rawStateRef.current.headphoneCue[deck];
        rawStateRef.current.headphoneCue[deck] = event.pressed;
        // Alterna solo sul fronte di salita (appena premuto), ignorando il rilascio
        // e qualunque messaggio ripetuto mentre resta fisicamente giù.
        if (event.pressed && !wasPressed) {
          engine.decks[deck].toggleCue();
        }
      }
      if (event.kind === 'button' && event.control === 'sync' && event.pressed) {
        if (rawStateRef.current.shift[deck]) {
          // SHIFT + BEAT SYNC: cambia il range del pitch (±6/±10/±16%/Wide)
          const current = engine.decks[deck].getTempoRange();
          const idx = TEMPO_RANGES.indexOf(current as (typeof TEMPO_RANGES)[number]);
          const next = TEMPO_RANGES[(idx + 1) % TEMPO_RANGES.length];
          engine.decks[deck].setTempoRange(next);
        } else {
          engine.toggleSync(deck, bpmsRef.current);
        }
      }
      if (event.kind === 'hotcue' && event.pressed) {
        if (event.action === 'activate') engine.decks[deck].setHotCueOrJump(event.pad);
        else engine.decks[deck].clearHotCue(event.pad);
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
