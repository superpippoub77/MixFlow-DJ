import { createTheme } from '@mui/material/styles';

// Palette ispirata al pannello di un mixer DJ: grafite scuro, LED ambra per il
// master, ciano per il deck 1, corallo per il deck 2.
export const palette = {
  bg: '#111317',
  panel: '#1a1d22',
  panelAlt: '#20242b',
  border: '#2b2f37',
  textPrimary: '#e8e9ec',
  textSecondary: '#8b909c',
  deck1: '#2fd0c0',
  deck2: '#ff6f61',
  master: '#f5b942',
  danger: '#ff5470',
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: palette.bg, paper: palette.panel },
    primary: { main: palette.master },
    text: { primary: palette.textPrimary, secondary: palette.textSecondary },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontFamily: '"JetBrains Mono", monospace' },
    h6: { fontFamily: '"Inter", system-ui, sans-serif', fontWeight: 700, letterSpacing: 0.2 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${palette.border}`,
        },
      },
    },
  },
});
