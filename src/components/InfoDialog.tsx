import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { palette } from '../theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb={2.5}>
      <Typography variant="subtitle2" sx={{ color: palette.master, fontWeight: 700, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography variant="body2" component="div" sx={{ opacity: 0.85, lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  );
}

export function InfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Come funziona mixflowdj
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Section title="1. Caricare e mixare i brani">
          Dal pannello "Libreria" scegli file dal tuo computer o cerca/carica una playlist YouTube, poi manda un brano su
          Deck 1 o Deck 2 ("→ D1" / "→ D2"). Se il deck è libero parte subito; se sta già suonando qualcosa, il brano si
          accoda (vedi punto 6).
          <br />
          <br />
          Per mixare: <b>Play/Cue</b> avviano/mettono in pausa (Cue torna anche all'inizio); i knob <b>LOW/MID/HIGH</b>{' '}
          regolano i bassi/medi/alti; <b>FILTER</b> applica uno sweep low-pass (verso sinistra) o high-pass (verso
          destra); <b>VOLUME</b> e <b>TEMPO</b> sono i due fader del deck; il <b>CROSSFADER</b> in Master dosa il
          passaggio tra Deck 1 e Deck 2. Il numero BPM sopra ogni deck è il tempo <i>effettivo</i> (BPM del brano ×
          velocità attuale): è il "tempo generale" impostato in quel momento.
          <br />
          <br />
          Per saltare a un punto preciso senza ascoltare tutto il brano: clicca/trascina direttamente sulla barra di
          avanzamento, oppure usa il campo "VAI A mm:ss" sotto il titolo per un salto esatto.
        </Section>

        <Section title="2. Beat Sync">
          Il pulsante rotondo "BEAT SYNC" sotto il jog regola automaticamente la velocità di quel deck per farla
          combaciare con il BPM effettivo dell'altro deck (funziona solo quando il BPM di entrambe le tracce è stato
          rilevato, cioè per file locali — vedi punto 7). È utile per allineare rapidamente due brani prima di
          mixarli, invece di regolare il fader tempo a orecchio.
        </Section>

        <Section title="3. Performance Pad (hot cue)">
          Gli 8 pad di ogni deck sono hot cue vere: il primo click su un pad spento salva il punto esatto in cui sei
          arrivato nel brano (il pad si accende). Un altro click sullo stesso pad <b>salta subito lì</b> e fa partire la
          riproduzione — utile per rientri rapidi, remix al volo o saltare un'intro. Caricare un nuovo brano sul deck
          cancella tutti i pad di quel deck. Da controller fisico, SHIFT + pad cancella un singolo hot cue senza
          sostituire il brano.
        </Section>

        <Section title="4. Automix (TRANSITION FX)">
          Il pulsante "TRANSITION FX" in Master attiva un mix automatico: quando il brano che sta suonando è vicino alla
          fine (ultimi ~16 secondi), se l'altro deck ha un brano pronto, parte da solo e il crossfader scivola verso di
          lui in ~12 secondi. Se il BPM di entrambe le tracce è noto, il brano in entrata viene anche sincronizzato di
          velocità (beatmatching automatico) prima del passaggio — stessa logica del Beat Sync manuale, ma automatica.
        </Section>

        <Section title="5. Preview in cuffia (PFL)">
          In Master, sezione "🎧 Preview in cuffia", scegli un dispositivo di uscita audio (es. delle cuffie USB) con
          "Trova dispositivi". Poi il pulsante 🎧 su ogni deck manda quel brano in ascolto separato lì, mentre il
          pubblico continua a sentire il mix sull'uscita principale; MASTER CUE fa lo stesso col mix finale. Funziona
          solo sui file locali e richiede Chrome/Edge/Opera (vedi punto 7).
        </Section>

        <Section title="6. Registrazione">
          Il pulsante "Registra il mix" cattura tutto ciò che esce dal Master (il mix finale, crossfader incluso) e alla
          fine ti dà un file scaricabile. Puoi registrare più take nella stessa sessione: restano elencati con la loro
          durata finché non ricarichi la pagina.
        </Section>

        <Section title="7. Coda per deck">
          Ogni deck può avere più brani in fila: se mandi un brano su un deck già occupato, si mette in coda invece di
          interrompere quello in corso. La coda è visibile sotto il titolo di ogni deck: puoi <b>riordinarla</b> con le
          frecce ▲▼ o <b>rimuovere</b> un brano con ×. Quando il brano attuale finisce da solo, parte automaticamente
          il prossimo in coda; "SKIP ▶" salta subito, senza aspettare la fine.
        </Section>

        <Section title="8. Ordinare la libreria per BPM">
          Nella Libreria, tab "File locali", ogni brano caricato viene analizzato in background per stimarne il BPM
          (etichetta sotto il nome file). Con almeno due brani caricati compare "Ordina per BPM": un click alterna tra
          nessun ordine, crescente e decrescente — utile per costruire una scaletta che sale/scende di energia.
        </Section>

        <Section title="9. Limiti da conoscere (YouTube)">
          Le tracce YouTube passano dal player ufficiale incorporato, che il browser isola per motivi di
          sicurezza/copyright: niente accesso ai dati audio grezzi. Per questo su YouTube <b>EQ e filtro non hanno
          effetto</b>, il <b>preview in cuffia non è disponibile</b>, il <b>BPM non viene rilevato</b> (niente ordinamento
          né Beat Sync) e il <b>tempo/pitch</b> di fatto non cambia (YouTube supporta solo poche velocità fisse — 0.75x,
          1x, 1.25x... — e il range del fader tempo, ±8%, è troppo piccolo per raggiungerle). Su questi aspetti i file
          locali restano l'esperienza completa.
        </Section>

        <Section title="10. Controller vs mouse/touch">
          Tutta l'interfaccia funziona anche senza il DDJ-200 collegato: ogni controllo risponde al mouse/touch. Se poi
          colleghi il controller, i suoi comandi hanno sempre l'ultima parola su quel controllo.
        </Section>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  );
}
