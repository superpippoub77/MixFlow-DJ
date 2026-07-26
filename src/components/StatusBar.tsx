import { Box, Button, Chip, MenuItem, Select, Typography, IconButton, Tooltip } from '@mui/material';
import UsbIcon from '@mui/icons-material/Usb';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import type { ConnectionStatus, MidiInputInfo } from '../midi/useDDJ200';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  unsupported: 'Web MIDI non supportata da questo browser',
  idle: 'Non connesso',
  requesting: 'Richiesta permesso MIDI…',
  'no-input': 'Nessuna porta MIDI trovata',
  connected: 'Connesso',
  error: 'Errore',
};

const STATUS_COLOR: Record<ConnectionStatus, 'default' | 'success' | 'warning' | 'error'> = {
  unsupported: 'error',
  idle: 'default',
  requesting: 'warning',
  'no-input': 'warning',
  connected: 'success',
  error: 'error',
};

export function StatusBar(props: {
  status: ConnectionStatus;
  error?: string;
  inputs: MidiInputInfo[];
  selectedInputId?: string;
  onConnect: () => void;
  onSelectInput: (id: string) => void;
  onInfoClick: () => void;
  onTutorialClick: () => void;
  onTestClick: () => void;
  testRunning: boolean;
  testLabel: string;
}) {
  const { status, error, inputs, selectedInputId, onConnect, onSelectInput, onInfoClick, onTutorialClick, onTestClick, testRunning, testLabel } =
    props;

  return (
    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
      <Box display="flex" alignItems="center" gap={1}>
        <UsbIcon fontSize="small" sx={{ opacity: 0.7 }} />
        <Typography variant="h6">DDJ-200 MIDI Bridge</Typography>
        <Tooltip title="Come funziona il programma">
          <IconButton size="small" onClick={onInfoClick} sx={{ opacity: 0.7 }}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Tutorial passo-passo">
          <IconButton size="small" onClick={onTutorialClick} sx={{ opacity: 0.7 }}>
            <SchoolIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Test luci: accende ogni indicatore in sequenza per verificarlo">
          <IconButton size="small" onClick={onTestClick} disabled={testRunning} sx={{ opacity: 0.7 }}>
            <ScienceIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {testRunning && (
          <Chip size="small" label={`Test: ${testLabel}`} color="warning" variant="outlined" />
        )}
      </Box>

      <Chip size="small" label={STATUS_LABEL[status]} color={STATUS_COLOR[status]} variant="outlined" />

      {status !== 'connected' && status !== 'unsupported' && (
        <Button id="tid-connect" size="small" variant="contained" onClick={onConnect}>
          {status === 'requesting' ? 'Attendi…' : 'Connetti controller'}
        </Button>
      )}

      {inputs.length > 1 && (
        <Select size="small" value={selectedInputId ?? ''} onChange={(e) => onSelectInput(e.target.value)} sx={{ minWidth: 220 }}>
          {inputs.map((i) => (
            <MenuItem key={i.id} value={i.id}>
              {i.name}
            </MenuItem>
          ))}
        </Select>
      )}

      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </Box>
  );
}
