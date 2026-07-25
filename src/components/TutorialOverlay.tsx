import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { palette } from '../theme';

interface TutorialStep {
  title: string;
  text: string;
  targetId: string | null;
}

const STEPS: TutorialStep[] = [
  {
    title: '1. Collega il controller (o usa il mouse)',
    text: 'Premi "Connetti controller" e concedi il permesso MIDI se hai il DDJ-200 collegato via USB. Non è obbligatorio: puoi seguire tutta la lezione anche solo con mouse o touch.',
    targetId: 'tid-connect',
  },
  {
    title: '2. Carica un brano',
    text: 'Scegli un file audio dal tuo computer. Da qui potrai mandarlo su Deck 1 o Deck 2 con i pulsanti "→ D1" / "→ D2" che compaiono accanto a ogni brano.',
    targetId: 'tid-library',
  },
  {
    title: '3. Play / Pausa',
    text: 'Questo pulsante rotondo avvia o mette in pausa il Deck 1. Si illumina quando il brano sta suonando.',
    targetId: 'tid-deck1-play',
  },
  {
    title: '4. Cue',
    text: 'CUE riporta la riproduzione al punto di inizio del brano (di solito 0:00) e mette in pausa: è il punto da cui ripartirai quando farai partire il deck durante un mix.',
    targetId: 'tid-deck1-cue',
  },
  {
    title: '5. Volume',
    text: 'Il fader VOLUME regola quanto forte suona questo deck nel mix. Trascinalo su e giù: lo senti cambiare subito se il brano sta suonando.',
    targetId: 'tid-deck1-volume',
  },
  {
    title: '6. Equalizzatore (LOW)',
    text: 'I tre knob EQ (LOW/MID/HIGH) tagliano o esaltano bassi, medi e alti. Prova a trascinare il knob LOW verso il basso: sentirai sparire la cassa. È la base per far entrare/uscire un brano senza stonare col mix.',
    targetId: 'tid-deck1-eq-low',
  },
  {
    title: '7. Filtro CFX',
    text: 'Il knob FILTER crea un effetto di "apertura/chiusura" del suono: verso sinistra taglia progressivamente gli alti, verso destra taglia i bassi. Molto usato per costruire tensione prima di un mix.',
    targetId: 'tid-deck1-filter',
  },
  {
    title: '8. Crossfader',
    text: 'Questo slider orizzontale dosa il passaggio tra Deck 1 (a sinistra) e Deck 2 (a destra). Tutto a sinistra senti solo D1, tutto a destra solo D2, al centro senti entrambi.',
    targetId: 'tid-master-crossfader',
  },
  {
    title: '9. Hot cue',
    text: 'Il primo pad libero: un click salva la posizione attuale del brano. Un altro click sullo stesso pad ci salta subito, riavviando la riproduzione da lì. Utile per rientri rapidi o remix al volo.',
    targetId: 'tid-deck1-pad1',
  },
  {
    title: '10. Beat Sync',
    text: 'Se hai caricato un file locale su entrambi i deck (il BPM si rileva solo sui file locali, non su YouTube), questo pulsante allinea automaticamente la velocità di questo deck a quella dell\'altro: fondamentale per un mix "in tempo".',
    targetId: 'tid-deck1-sync',
  },
  {
    title: '11. Automix / Transition FX',
    text: 'Attiva "AUTOMIX ON" e il programma farà da solo il passaggio tra i deck quando il brano attivo sta per finire, con lo stile di transizione che hai scelto dal menu accanto (crossfade, filter sweep, echo out o cut secco).',
    targetId: 'tid-master-automix',
  },
  {
    title: '12. Registrare il mix',
    text: 'Quando sei pronto a registrare la tua sessione, premi "Registra il mix": cattura tutto quello che esce dal Master. Premi di nuovo per fermare e scaricare il file. Ora sai usare tutti i controlli principali: buon mix!',
    targetId: 'tid-recording',
  },
];

export function TutorialOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const step = STEPS[stepIndex];

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = step.targetId ? document.getElementById(step.targetId) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [open, stepIndex, step.targetId]);

  useEffect(() => {
    if (!open) return;
    let raf: number;
    function tick() {
      const el = step.targetId ? document.getElementById(step.targetId) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open, step.targetId]);

  if (!open) return null;

  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none' }}>
      {rect ? (
        <Box
          sx={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 2,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 3px ${palette.master}`,
            transition: 'top 150ms ease, left 150ms ease, width 150ms ease, height 150ms ease',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <Box sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)' }} />
      )}

      <Paper
        sx={{
          position: 'fixed',
          bottom: { xs: 12, sm: 24 },
          left: '50%',
          transform: 'translateX(-50%)',
          width: { xs: '92%', sm: 420 },
          p: 2,
          pointerEvents: 'auto',
          border: `1px solid ${palette.master}`,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" sx={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace' }}>
            Lezione {stepIndex + 1} di {STEPS.length}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="subtitle1" sx={{ color: palette.master, fontWeight: 700, mb: 0.5 }}>
          {step.title}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85, mb: 2 }}>
          {step.text}
        </Typography>
        <Box display="flex" justifyContent="space-between">
          <Button size="small" disabled={isFirst} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
            ← Indietro
          </Button>
          {isLast ? (
            <Button size="small" variant="contained" onClick={onClose}>
              Fine tutorial
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>
              Avanti →
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
