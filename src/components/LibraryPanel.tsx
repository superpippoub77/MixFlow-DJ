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
import { extractPlaylistId, fetchYoutubePlaylist } from '../youtube/youtubePlaylist';
import { detectBpm } from '../audio/bpmDetect';

interface LocalTrack {
  id: string;
  file: File;
  bpm: number | null | 'loading';
}

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

function bpmLabel(bpm: LocalTrack['bpm']): string {
  if (bpm === 'loading') return 'Analisi BPM…';
  if (bpm == null) return 'BPM sconosciuto';
  return `${bpm} BPM`;
}

export function LibraryPanel(props: {
  onLoadLocal: (deck: 1 | 2, file: File) => void;
  onLoadYoutube: (deck: 1 | 2, videoId: string, title: string) => void;
}) {
  const { onLoadLocal, onLoadYoutube } = props;

  const [tab, setTab] = useState<'local' | 'youtube'>('local');
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [bpmSort, setBpmSort] = useState<'none' | 'asc' | 'desc'>('none');

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mixflowdj_yt_api_key') ?? '');
  const [query, setQuery] = useState('');
  const [playlistInput, setPlaylistInput] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [resultsLabel, setResultsLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newTracks: LocalTrack[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      bpm: 'loading',
    }));
    setLocalTracks((prev) => [...prev, ...newTracks]);
    // Analizza il BPM di ogni file in background, senza bloccare la UI
    for (const track of newTracks) {
      detectBpm(track.file).then((bpm) => {
        setLocalTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, bpm } : t)));
      });
    }
  }

  function cycleBpmSort() {
    setBpmSort((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'));
  }

  function sortedTracks(): LocalTrack[] {
    if (bpmSort === 'none') return localTracks;
    const withBpm = localTracks.filter((t) => typeof t.bpm === 'number') as (LocalTrack & { bpm: number })[];
    const withoutBpm = localTracks.filter((t) => typeof t.bpm !== 'number');
    withBpm.sort((a, b) => (bpmSort === 'asc' ? a.bpm - b.bpm : b.bpm - a.bpm));
    return [...withBpm, ...withoutBpm];
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
      setResultsLabel(`Risultati per "${query.trim()}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylist() {
    setError(undefined);
    if (!apiKey.trim()) {
      setError('Inserisci prima la tua API key di YouTube Data API v3.');
      return;
    }
    const playlistId = extractPlaylistId(playlistInput);
    if (!playlistId) {
      setError('Incolla un link playlist valido (es. youtube.com/playlist?list=...) o un ID playlist.');
      return;
    }
    setLoading(true);
    try {
      const items = await fetchYoutubePlaylist(apiKey.trim(), playlistId);
      setResults(items);
      setResultsLabel(`Playlist: ${items.length} brani`);
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
          <Box display="flex" gap={1} mb={1.5} flexWrap="wrap">
            <Button component="label" variant="outlined" size="small">
              Scegli file audio
              <input hidden type="file" accept="audio/*" multiple onChange={(e) => handleFiles(e.target.files)} />
            </Button>
            <Button component="label" variant="outlined" size="small">
              Carica cartella (playlist)
              <input
                hidden
                type="file"
                accept="audio/*"
                multiple
                // @ts-expect-error attributo non tipizzato in TS ma supportato dai browser
                webkitdirectory=""
                onChange={(e) => handleFiles(e.target.files)}
              />
            </Button>
            {localTracks.length > 1 && (
              <Button size="small" variant="text" onClick={cycleBpmSort}>
                Ordina per BPM: {bpmSort === 'none' ? 'off' : bpmSort === 'asc' ? '↑ crescente' : '↓ decrescente'}
              </Button>
            )}
          </Box>
          <List dense disablePadding>
            {sortedTracks().map((track) => (
              <TrackRow
                key={track.id}
                title={track.file.name}
                subtitle={bpmLabel(track.bpm)}
                onDeck1={() => onLoadLocal(1, track.file)}
                onDeck2={() => onLoadLocal(2, track.file)}
              />
            ))}
          </List>
          {localTracks.length === 0 && (
            <Typography variant="body2" sx={{ opacity: 0.5 }}>
              Nessun file caricato. Scegli uno o più brani, oppure un'intera cartella da usare come playlist.
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

          <Box display="flex" gap={1} mb={1}>
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

          <Box display="flex" gap={1} mb={1.5}>
            <TextField
              size="small"
              fullWidth
              placeholder="Oppure incolla un link/ID di una playlist YouTube…"
              value={playlistInput}
              onChange={(e) => setPlaylistInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPlaylist()}
            />
            <Button variant="outlined" onClick={loadPlaylist} disabled={loading} sx={{ minWidth: 88 }}>
              {loading ? <CircularProgress size={18} /> : 'Playlist'}
            </Button>
          </Box>

          {error && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {error}
            </Typography>
          )}

          {resultsLabel && !error && (
            <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 0.5 }}>
              {resultsLabel}
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
              I risultati della ricerca o della playlist appariranno qui.
            </Typography>
          )}

          <Typography variant="caption" sx={{ opacity: 0.45, display: 'block', mt: 1 }}>
            Il BPM automatico non è disponibile per YouTube (nessun accesso all'audio grezzo), quindi l'ordinamento per
            BPM riguarda solo i file locali.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
