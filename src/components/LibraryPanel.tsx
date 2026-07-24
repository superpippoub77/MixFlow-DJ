import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { searchYouTube, type YouTubeSearchResult } from '../youtube/youtubeSearch';

function TrackRow(props: {
  title: string;
  subtitle?: string;
  avatar?: string;
  onDeck1: () => void;
  onDeck2: () => void;
}) {
  const { title, subtitle, avatar, onDeck1, onDeck2 } = props;
  return (
    <ListItemButton disableRipple sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 1 }}>
      {avatar && <Avatar variant="rounded" src={avatar} sx={{ width: 40, height: 40, flexShrink: 0 }} />}
      <ListItemText
        primary={title}
        secondary={subtitle}
        sx={{ flex: 1, minWidth: 0 }}
        primaryTypographyProps={{ noWrap: true, fontSize: 13 }}
        secondaryTypographyProps={{ noWrap: true, fontSize: 11, sx: { opacity: 0.6 } }}
      />
      <Button size="small" onClick={onDeck1} sx={{ minWidth: 40 }}>
        → D1
      </Button>
      <Button size="small" onClick={onDeck2} sx={{ minWidth: 40 }}>
        → D2
      </Button>
    </ListItemButton>
  );
}

export function LibraryPanel(props: {
  onLoadLocal: (deck: 1 | 2, file: File) => void;
  onLoadYoutube: (deck: 1 | 2, videoId: string, title: string) => void;
}) {
  const { onLoadLocal, onLoadYoutube } = props;

  const [tab, setTab] = useState<'local' | 'youtube'>('local');
  const [localFiles, setLocalFiles] = useState<File[]>([]);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mixflowdj_yt_api_key') ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    setLocalFiles((prev) => [...prev, ...Array.from(fileList)]);
  }

  function saveApiKey(value: string) {
    setApiKey(value);
    localStorage.setItem('mixflowdj_yt_api_key', value);
  }

  async function runSearch() {
    setError(undefined);
    if (!apiKey.trim()) {
      setError('Inserisci prima la tua API key di YouTube Data API v3.');
      return;
    }
    if (!query.trim()) return;
    setLoading(true);
    try {
      const items = await searchYouTube(apiKey.trim(), query.trim());
      setResults(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 36 }}>
        <Tab value="local" label="File locali" sx={{ minHeight: 36 }} />
        <Tab value="youtube" label="YouTube" sx={{ minHeight: 36 }} />
      </Tabs>

      {tab === 'local' && (
        <Box>
          <Button component="label" variant="outlined" size="small" sx={{ mb: 1.5 }}>
            Scegli file audio
            <input hidden type="file" accept="audio/*" multiple onChange={(e) => handleFiles(e.target.files)} />
          </Button>
          <List dense disablePadding>
            {localFiles.map((file, i) => (
              <TrackRow key={`${file.name}-${i}`} title={file.name} onDeck1={() => onLoadLocal(1, file)} onDeck2={() => onLoadLocal(2, file)} />
            ))}
          </List>
          {localFiles.length === 0 && (
            <Typography variant="body2" sx={{ opacity: 0.5 }}>
              Nessun file caricato. Scegli uno o più brani dal tuo computer.
            </Typography>
          )}
        </Box>
      )}

      {tab === 'youtube' && (
        <Box>
          <TextField
            label="YouTube Data API v3 key"
            size="small"
            fullWidth
            type="password"
            value={apiKey}
            onChange={(e) => saveApiKey(e.target.value)}
            helperText="Salvata solo nel tuo browser. Serve una tua chiave da Google Cloud Console (API 'YouTube Data API v3')."
            sx={{ mb: 1.5 }}
          />
          <Box display="flex" gap={1} mb={1.5}>
            <TextField
              size="small"
              fullWidth
              placeholder="Cerca un brano su YouTube…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <Button variant="contained" onClick={runSearch} disabled={loading} sx={{ minWidth: 88 }}>
              {loading ? <CircularProgress size={18} color="inherit" /> : 'Cerca'}
            </Button>
          </Box>

          {error && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {error}
            </Typography>
          )}

          <List dense disablePadding>
            {results.map((r) => (
              <TrackRow
                key={r.videoId}
                title={r.title}
                subtitle={r.channelTitle}
                avatar={r.thumbnailUrl}
                onDeck1={() => onLoadYoutube(1, r.videoId, r.title)}
                onDeck2={() => onLoadYoutube(2, r.videoId, r.title)}
              />
            ))}
          </List>

          {results.length === 0 && !loading && !error && (
            <Typography variant="body2" sx={{ opacity: 0.5 }}>
              I risultati della ricerca appariranno qui.
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}
