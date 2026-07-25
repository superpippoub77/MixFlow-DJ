import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from './audioEngine';
import type { DeckSnapshot } from './deck';

// Quanti secondi prima della fine del brano attivo parte il mix automatico
const TRIGGER_SECONDS_BEFORE_END = 16;
// Durata del crossfade automatico (lo stile "cut" usa un valore più breve, vedi sotto)
const TRANSITION_SECONDS = 12;
const CUT_TRANSITION_SECONDS = 2;

export type AutoMixStatus = 'idle' | 'mixing';
export type TransitionStyle = 'crossfade' | 'filter_sweep' | 'echo_out' | 'cut';

export const TRANSITION_STYLE_LABELS: Record<TransitionStyle, string> = {
  crossfade: 'Crossfade classico',
  filter_sweep: 'Filter sweep',
  echo_out: 'Echo out',
  cut: 'Cut secco',
};

export function useAutoMix(
  engine: AudioEngine,
  snapshots: Record<1 | 2, DeckSnapshot>,
  bpms: Record<1 | 2, number | null>,
  onCrossfaderChange: (value: number) => void,
  style: TransitionStyle,
) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<AutoMixStatus>('idle');
  const mixingRef = useRef(false);
  // Le snapshot/bpm/stile più recenti, lette dentro l'interval senza doverlo ricreare ad ogni render
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;
  const bpmsRef = useRef(bpms);
  bpmsRef.current = bpms;
  const styleRef = useRef(style);
  styleRef.current = style;

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (mixingRef.current) return;
      const s = snapshotsRef.current;
      const d1 = s[1];
      const d2 = s[2];

      const d1Ending = d1.playing && d1.duration > 0 && d1.duration - d1.currentTime <= TRIGGER_SECONDS_BEFORE_END;
      const d2Ending = d2.playing && d2.duration > 0 && d2.duration - d2.currentTime <= TRIGGER_SECONDS_BEFORE_END;

      if (d1Ending && d2.title && !d2.playing) {
        startTransition(1, 2);
      } else if (d2Ending && d1.title && !d1.playing) {
        startTransition(2, 1);
      }
    }, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function startTransition(from: 1 | 2, to: 1 | 2) {
    mixingRef.current = true;
    setStatus('mixing');
    const currentStyle = styleRef.current;

    // Se conosciamo il BPM di entrambe le tracce, sincronizza il pitch di
    // quella in entrata su quella in uscita per un mix beatmatched.
    const bpmFrom = bpmsRef.current[from];
    const bpmTo = bpmsRef.current[to];
    if (bpmFrom && bpmTo) {
      engine.decks[to].setPlaybackRateAbsolute(bpmFrom / bpmTo);
    }

    engine.decks[to].seekTo(0);
    engine.decks[to].play();

    if (currentStyle === 'echo_out' && !engine.fx.isEchoActive()) {
      engine.fx.toggleEcho();
    }

    const startValue = from === 1 ? 0 : 1; // il crossfader parte tutto sul deck "from"
    const endValue = from === 1 ? 1 : 0;
    const duration = currentStyle === 'cut' ? CUT_TRANSITION_SECONDS : TRANSITION_SECONDS;
    const startTime = performance.now();

    function tick() {
      const elapsed = (performance.now() - startTime) / 1000;
      const t = Math.min(1, elapsed / duration);
      const eased = t * t * (3 - 2 * t); // smoothstep, per una transizione morbida
      onCrossfaderChange(startValue + (endValue - startValue) * eased);

      if (currentStyle === 'filter_sweep') {
        // Il deck in uscita viene "filtrato via" (low-pass crescente) mentre sfuma
        engine.decks[from].setFilter(0.5 - eased * 0.5);
      }

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        engine.decks[from].pause();
        if (currentStyle === 'filter_sweep') engine.decks[from].setFilter(0.5); // ripristina neutro
        if (currentStyle === 'echo_out' && engine.fx.isEchoActive()) engine.fx.toggleEcho();
        mixingRef.current = false;
        setStatus('idle');
      }
    }
    requestAnimationFrame(tick);
  }

  return { enabled, setEnabled, status };
}
