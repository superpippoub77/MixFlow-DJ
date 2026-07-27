import { useEffect, useRef } from 'react';
import type { AudioEngine } from './audioEngine';

export interface KeyboardMixerHandlers {
  onTabSwitch: () => void;
  getFocusedDeck: () => 1 | 2;
  onPlay: (deck: 1 | 2) => void;
  onCue: (deck: 1 | 2, pressed: boolean) => void;
  onGoToStart: (deck: 1 | 2) => void;
  onHotCue: (deck: 1 | 2, pad: number) => void;
  onClearHotCue: (deck: 1 | 2, pad: number) => void;
  onSync: (deck: 1 | 2) => void;
  onCycleTempoRange: (deck: 1 | 2) => void;
  onToggleHeadphone: (deck: 1 | 2) => void;
  onCrossfaderNudge: (delta: number) => void;
  onVolumeNudge: (deck: 1 | 2, delta: number) => void;
  onTempoNudge: (deck: 1 | 2, delta: number) => void;
  onEQNudge: (deck: 1 | 2, band: 'low' | 'mid' | 'high', delta: number) => void;
  onFilterNudge: (deck: 1 | 2, delta: number) => void;
}

const SCRATCH_TICK_MS = 30;

/**
 * Tastiera come mixer: collega i tasti alle stesse funzioni già usate da
 * mouse/MIDI. Gli handler sono letti da un ref aggiornato ad ogni render, in
 * modo che i listener globali (window) vengano montati una sola volta e non
 * si perda lo stato di "tasto tenuto premuto" (fondamentale per lo scratch)
 * ad ogni ri-render dell'app.
 *
 * CTRL sinistro/destro e SHIFT sinistro/destro sono riconosciuti in modo
 * distinto (tramite `event.code`, che il browser riporta come "ControlLeft"
 * / "ControlRight" ecc.), per poter agire direttamente su un deck specifico
 * senza dover prima passare da TAB.
 */
export function useKeyboardMixer(engine: AudioEngine, handlers: KeyboardMixerHandlers, enabled: boolean) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const heldCodes = new Set<string>();
    const scratchIntervals: Partial<Record<1 | 2, ReturnType<typeof setInterval>>> = {};

    function isTypingTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    function startScratch(deck: 1 | 2, direction: 1 | -1) {
      if (scratchIntervals[deck]) return; // già in corso
      engine.decks[deck].startScratch();
      scratchIntervals[deck] = setInterval(() => {
        engine.decks[deck].scratchBy(direction * 0.045, direction * 1.6);
      }, SCRATCH_TICK_MS);
    }

    function stopScratch(deck: 1 | 2) {
      const interval = scratchIntervals[deck];
      if (interval) {
        clearInterval(interval);
        delete scratchIntervals[deck];
        engine.decks[deck].endScratch();
      }
    }

    /** Il deck "puntato" da uno Shift o Alt tenuto premuto in questo momento, se c'è; altrimenti null */
    function sideDeck(leftCode: string, rightCode: string): 1 | 2 | null {
      if (heldCodes.has(leftCode)) return 1;
      if (heldCodes.has(rightCode)) return 2;
      return null;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const h = handlersRef.current;

      if (e.code === 'Tab') {
        e.preventDefault();
        h.onTabSwitch();
        return;
      }

      // Ignora l'auto-repeat del sistema operativo: gestiamo noi la ripetizione (scratch a intervalli fissi)
      const isRepeat = heldCodes.has(e.code);
      heldCodes.add(e.code);

      const deck = h.getFocusedDeck();

      // CTRL sinistro = CUE Deck 1, CTRL destro = CUE Deck 2: diretto, non serve TAB
      if (e.code === 'ControlLeft') {
        e.preventDefault();
        if (!isRepeat) h.onCue(1, true);
        return;
      }
      if (e.code === 'ControlRight') {
        e.preventDefault();
        if (!isRepeat) h.onCue(2, true);
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        h.onCrossfaderNudge(-0.05);
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        h.onCrossfaderNudge(0.05);
        return;
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (e.altKey) h.onFilterNudge(deck, 0.05);
        else if (e.ctrlKey) h.onTempoNudge(deck, 0.02);
        else h.onVolumeNudge(deck, 0.05);
        return;
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (e.altKey) h.onFilterNudge(deck, -0.05);
        else if (e.ctrlKey) h.onTempoNudge(deck, -0.02);
        else h.onVolumeNudge(deck, -0.05);
        return;
      }
      // EQ del deck attivo: Q/A = alti, E/D = medi, R/F = bassi (su/giù)
      if (e.code === 'KeyQ') {
        e.preventDefault();
        h.onEQNudge(deck, 'high', 0.05);
        return;
      }
      if (e.code === 'KeyA') {
        e.preventDefault();
        h.onEQNudge(deck, 'high', -0.05);
        return;
      }
      if (e.code === 'KeyE') {
        e.preventDefault();
        h.onEQNudge(deck, 'mid', 0.05);
        return;
      }
      if (e.code === 'KeyD') {
        e.preventDefault();
        h.onEQNudge(deck, 'mid', -0.05);
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        h.onEQNudge(deck, 'low', 0.05);
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        h.onEQNudge(deck, 'low', -0.05);
        return;
      }
      if (e.code === 'Home') {
        e.preventDefault();
        if (!isRepeat) startScratch(deck, -1);
        return;
      }
      if (e.code === 'End') {
        e.preventDefault();
        if (!isRepeat) startScratch(deck, 1);
        return;
      }
      if (isRepeat) return; // il resto dei comandi non deve ripetersi tenendo premuto

      if (e.code === 'Space') {
        e.preventDefault();
        h.onPlay(deck);
      }
      if (e.code === 'Backspace' || e.code === 'Enter') {
        e.preventDefault();
        const shiftDeck = sideDeck('ShiftLeft', 'ShiftRight');
        if (shiftDeck) h.onGoToStart(shiftDeck);
        else h.onCue(deck, true); // versione "sul deck attivo" (in aggiunta a CTRL sx/dx)
      }
      const padMatch = e.code.match(/^Digit([1-8])$/);
      if (padMatch) {
        const pad = Number(padMatch[1]);
        // SHIFT sinistro/destro cancella l'hot cue sul deck corrispondente, a prescindere dal deck attivo
        const shiftDeck = sideDeck('ShiftLeft', 'ShiftRight');
        if (shiftDeck) h.onClearHotCue(shiftDeck, pad);
        else h.onHotCue(deck, pad);
      }
      if (e.code === 'KeyS') {
        // ALT sinistro/destro cambia il range del pitch sul deck corrispondente, a prescindere dal deck attivo
        const altDeck = sideDeck('AltLeft', 'AltRight');
        if (altDeck) h.onCycleTempoRange(altDeck);
        else h.onSync(deck);
      }
      if (e.code === 'KeyH') {
        h.onToggleHeadphone(deck);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      heldCodes.delete(e.code);
      const h = handlersRef.current;
      const deck = h.getFocusedDeck();

      if (e.code === 'ControlLeft') {
        h.onCue(1, false);
        return;
      }
      if (e.code === 'ControlRight') {
        h.onCue(2, false);
        return;
      }

      if (e.code === 'Backspace' || e.code === 'Enter') h.onCue(deck, false);
      if (e.code === 'Home') stopScratch(deck);
      if (e.code === 'End') stopScratch(deck);
    }

    function handleBlur() {
      // se la finestra perde il focus mentre stai scratchando, ferma tutto (evita loop bloccati)
      (Object.keys(scratchIntervals) as unknown as (1 | 2)[]).forEach((deck) => stopScratch(Number(deck) as 1 | 2));
      heldCodes.clear();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      (Object.keys(scratchIntervals) as unknown as (1 | 2)[]).forEach((deck) => stopScratch(Number(deck) as 1 | 2));
    };
  }, [engine, enabled]);
}
