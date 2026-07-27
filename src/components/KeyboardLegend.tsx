import { Box, Paper, Typography } from '@mui/material';
import { palette } from '../theme';

const CATEGORY_COLORS = {
  deck: '#c9cdd6',
  transport: '#7dd8ff',
  hotcue: '#ff8fd1',
  sync: palette.master,
  headphone: '#7dffb0',
  mixer: palette.master,
  scratch: '#ff5470',
  eq: '#a78bfa',
};

function Key({ label, color }: { label: string; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 26,
        height: 22,
        px: 0.6,
        borderRadius: 0.75,
        border: `1px solid ${color}`,
        color,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </Box>
  );
}

function Row({ keys, color, text }: { keys: string[]; color: string; text: string }) {
  return (
    <Box display="flex" alignItems="center" gap={1} mb={0.6}>
      <Box display="flex" gap={0.4} flexShrink={0} minWidth={92}>
        {keys.map((k) => (
          <Key key={k} label={k} color={color} />
        ))}
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.8 }}>
        {text}
      </Typography>
    </Box>
  );
}

export function KeyboardLegend({ focusedDeck, deckColor }: { focusedDeck: 1 | 2; deckColor: string }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Typography variant="h6" sx={{ color: palette.master }}>
          Tastiera come mixer
        </Typography>
        <Box display="flex" alignItems="center" gap={0.75}>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            Deck attivo:
          </Typography>
          <Box
            sx={{
              px: 1,
              py: 0.2,
              borderRadius: 1,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              border: `1px solid ${deckColor}`,
              background: deckColor,
              color: '#111',
            }}
          >
            DECK {focusedDeck}
          </Box>
        </Box>
      </Box>

      <Box display="flex" gap={4} flexWrap="wrap">
        <Box>
          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.deck, fontWeight: 700, display: 'block', mb: 0.5 }}>
            CAMBIO DECK
          </Typography>
          <Row keys={['TAB']} color={CATEGORY_COLORS.deck} text="Alterna il deck attivo (1 ↔ 2)" />

          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.transport, fontWeight: 700, display: 'block', mb: 0.5, mt: 1.5 }}>
            TRASPORTO
          </Typography>
          <Row keys={['SPAZIO']} color={CATEGORY_COLORS.transport} text="Play / Pausa (deck attivo)" />
          <Row keys={['CTRL sx']} color={CATEGORY_COLORS.transport} text="Cue Deck 1 (diretto, non serve TAB)" />
          <Row keys={['CTRL dx']} color={CATEGORY_COLORS.transport} text="Cue Deck 2 (diretto, non serve TAB)" />
          <Row keys={['⌫/⏎']} color={CATEGORY_COLORS.transport} text="Cue sul deck attivo" />
          <Row keys={['SHIFT sx', '⌫/⏎']} color={CATEGORY_COLORS.transport} text="Deck 1: torna all'inizio traccia" />
          <Row keys={['SHIFT dx', '⌫/⏎']} color={CATEGORY_COLORS.transport} text="Deck 2: torna all'inizio traccia" />

          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.scratch, fontWeight: 700, display: 'block', mb: 0.5, mt: 1.5 }}>
            SCRATCH (deck attivo)
          </Typography>
          <Row keys={['HOME']} color={CATEGORY_COLORS.scratch} text="Tieni premuto: scratch all'indietro" />
          <Row keys={['END']} color={CATEGORY_COLORS.scratch} text="Tieni premuto: scratch in avanti" />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.hotcue, fontWeight: 700, display: 'block', mb: 0.5 }}>
            HOT CUE (deck attivo)
          </Typography>
          <Row keys={['1', '…', '8']} color={CATEGORY_COLORS.hotcue} text="Imposta/salta all'hot cue" />
          <Row keys={['SHIFT sx', '1-8']} color={CATEGORY_COLORS.hotcue} text="Cancella hot cue su Deck 1" />
          <Row keys={['SHIFT dx', '1-8']} color={CATEGORY_COLORS.hotcue} text="Cancella hot cue su Deck 2" />

          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.sync, fontWeight: 700, display: 'block', mb: 0.5, mt: 1.5 }}>
            SYNC
          </Typography>
          <Row keys={['S']} color={CATEGORY_COLORS.sync} text="Beat Sync on/off (deck attivo)" />
          <Row keys={['ALT sx', 'S']} color={CATEGORY_COLORS.sync} text="Cambia range pitch Deck 1" />
          <Row keys={['ALT dx', 'S']} color={CATEGORY_COLORS.sync} text="Cambia range pitch Deck 2" />

          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.headphone, fontWeight: 700, display: 'block', mb: 0.5, mt: 1.5 }}>
            CUFFIA (deck attivo)
          </Typography>
          <Row keys={['H']} color={CATEGORY_COLORS.headphone} text="Preascolto in cuffia on/off" />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.mixer, fontWeight: 700, display: 'block', mb: 0.5 }}>
            MIXER (sempre attivo)
          </Typography>
          <Row keys={['←', '→']} color={CATEGORY_COLORS.mixer} text="Crossfader verso D1 / D2" />
          <Row keys={['↑', '↓']} color={CATEGORY_COLORS.mixer} text="Volume del deck attivo" />
          <Row keys={['CTRL', '↑/↓']} color={CATEGORY_COLORS.mixer} text="Tempo del deck attivo" />
          <Row keys={['ALT', '↑/↓']} color={CATEGORY_COLORS.mixer} text="Filtro/CFX del deck attivo" />

          <Typography variant="caption" sx={{ color: CATEGORY_COLORS.eq, fontWeight: 700, display: 'block', mb: 0.5, mt: 1.5 }}>
            EQ (deck attivo)
          </Typography>
          <Row keys={['Q', '/', 'A']} color={CATEGORY_COLORS.eq} text="Alti su / giù" />
          <Row keys={['E', '/', 'D']} color={CATEGORY_COLORS.eq} text="Medi su / giù" />
          <Row keys={['R', '/', 'F']} color={CATEGORY_COLORS.eq} text="Bassi su / giù" />
        </Box>
      </Box>

      <Typography variant="caption" sx={{ opacity: 0.45, display: 'block', mt: 1.5 }}>
        Shift/Ctrl/Alt funzionano allo stesso modo sia da tastierino sinistro
        che destro. I comandi da tastiera si disattivano automaticamente
        mentre scrivi in un campo di testo (es. ricerca YouTube).
      </Typography>
    </Paper>
  );
}
