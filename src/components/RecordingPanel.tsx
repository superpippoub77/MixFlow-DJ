import { useState } from 'react';
import { Box, Paper, Typography, List, ListItem, ListItemText, Button } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { DotDisplay } from './DotDisplay';
import { palette } from '../theme';

export interface Recording {
  url: string;
  name: string;
  durationSeconds: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingPanel({
  supported,
  recording,
  elapsedSeconds,
  recordings,
  onToggleRecord,
}: {
  supported: boolean;
  recording: boolean;
  elapsedSeconds: number;
  recordings: Recording[];
  onToggleRecord: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={recordings.length > 0 && expanded ? 1.5 : 0}>
        <Typography variant="h6" sx={{ color: palette.master }}>
          Registrazione
        </Typography>
        <Box display="flex" alignItems="center" gap={1.5}>
          {recording && <DotDisplay color="#ff5470">REC {formatDuration(elapsedSeconds)}</DotDisplay>}
          <Button
            id="tid-recording"
            size="small"
            variant={recording ? 'contained' : 'outlined'}
            color={recording ? 'error' : 'inherit'}
            startIcon={<FiberManualRecordIcon sx={{ color: recording ? '#fff' : '#ff5470' }} />}
            onClick={onToggleRecord}
            disabled={!supported}
          >
            {recording ? 'Ferma' : 'Registra il mix'}
          </Button>
          {recordings.length > 0 && (
            <Button size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Nascondi' : `Registrazioni (${recordings.length})`}
            </Button>
          )}
        </Box>
      </Box>

      {!supported && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          Questo browser non supporta MediaRecorder: la registrazione non è disponibile.
        </Typography>
      )}

      {expanded && recordings.length > 0 && (
        <List dense disablePadding>
          {recordings.map((r, i) => (
            <ListItem
              key={r.url}
              disablePadding
              sx={{ py: 0.5 }}
              secondaryAction={
                <Button size="small" component="a" href={r.url} download={r.name}>
                  Scarica
                </Button>
              }
            >
              <ListItemText
                primary={`Registrazione ${i + 1}`}
                secondary={formatDuration(r.durationSeconds)}
                primaryTypographyProps={{ fontSize: 13 }}
                secondaryTypographyProps={{ fontSize: 11, sx: { opacity: 0.6 } }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
