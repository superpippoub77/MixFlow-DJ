import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
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
import { DEFAULT_TRIM, type TrimSettings } from '../audio/deck';
import { localTrackKey, youtubeTrackKey } from '../utils/trackKey';
import { formatTime, parseTimeInput } from '../utils/time';
import { loadAllLocalTracks, removeLocalTrack, saveLocalTrack } from '../utils/localLibraryDB';

interface LocalTrack {
  id: string;
  file: File;
  bpm: number | null | 'loading';
}

/** Editor inline: inizio/fine personalizzati + fade in/out, per un singolo brano */
function TrimEditor({ settings, onChange }: { settings: TrimSettings; onChange: (s: TrimSettings) => void }) {
  const [startText, setStartText] = useState(settings.start != null ? formatTime(settings.start) : '');
  const [endText, setEndText] = useState(settings.end != null ? formatTime(settings.end) : '');

  function commitStart() {
    onChange({ ...settings, start: parseTimeInput(startText) });
  }
  function commitEnd() {
    onChange({ ...settings, end: parseTimeInput(endText) });
  }

  return (
    <Box sx={{ pl: 2, pr: 1, py: 1, background: '#181b20', borderRadius: 1, mb: 0.5 }}>
      <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" mb={0.5}>
        <TextField
          label="Inizio (mm:ss)"
          size="small"
          value={startText}
          onChange={(e) => setStartText(e.target.value)}
          onBlur={commitStart}
          onKeyDown={(e) => e.key === 'Enter' && commitStart()}
          sx={{ width: 130 }}
          placeholder="0:00"
        />
        <TextField
          label="Fine (mm:ss)"
          size="small"
          value={endText}
          onChange={(e) => setEndText(e.target.value)}
          onBlur={commitEnd}
          onKeyDown={(e) => e.key === 'Enter' && commitEnd()}
          sx={{ width: 130 }}
          placeholder="fine file"
        />
        <TextField
          label="Fade (sec)"
          size="small"
          type="number"
          value={settings.fadeDuration}
          onChange={(e) => onChange({ ...settings, fadeDuration: Math.max(0.5, parseFloat(e.target.value) || 3) })}
          sx={{ width: 100 }}
          inputProps={{ min: 0.5, step: 0.5 }}
        />
      </Box>
      <Box display="flex" gap={1} flexWrap="wrap">
        <FormControlLabel
          control={<Checkbox size="small" checked={settings.fadeIn} onChange={(e) => onChange({ ...settings, fadeIn: e.target.checked })} />}
          label={<Typography variant="caption">Fade in</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={settings.fadeOut} onChange={(e) => onChange({ ...settings, fadeOut: e.target.checked })} />}
          label={<Typography variant="caption">Fade out</Typography>}
        />
      </Box>
    </Box>
  );
}

function trimSummary(settings: TrimSettings): string | null {
  if (settings.start == null && settings.end == null && !settings.fadeIn && !settings.fadeOut) return null;
  const parts: string[] = [];
  if (settings.start != null || settings.end != null) {
    parts.push(`${settings.start != null ? formatTime(settings.start) : '0:00'} → ${settings.end != null ? formatTime(settings.end) : 'fine'}`);
  }
  if (settings.fadeIn) parts.push('fade in');
  if (settings.fadeOut) parts.push('fade out');
  return parts.join(' · ');
}

function TrackRow(props: {
  title: string;
  subtitle?: string;
  avatar?: string;
  settingsKey: string;
  settings: TrimSettings;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChangeSettings: (s: TrimSettings) => void;
  onDeck1: () => void;
  onDeck2: () => void;
  onRemove?: () => void;
}) {
  const { title, subtitle, avatar, settings, expanded, onToggleExpanded, onChangeSettings, onDeck1, onDeck2, onRemove } = props;
  const summary = trimSummary(settings);

  return (
    <Box>
      <ListItemButton disableRipple sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 1 }}>
        {avatar && <Avatar variant="rounded" src={avatar} sx={{ width: 40, height: 40, flexShrink: 0 }} />}
        <ListItemText
          primary={title}
          secondary={subtitle}
          sx={{ flex: 1, minWidth: 0 }}
          primaryTypographyProps={{ noWrap: true, fontSize: 13 }}
          secondaryTypographyProps={{ noWrap: true, fontSize: 11, sx: { opacity: 0.6 } }}
        />
        {summary && (
          <Typography variant="caption" sx={{ opacity: 0.55, fontSize: 10, mr: 0.5, whiteSpace: 'nowrap' }}>
            {summary}
          </Typography>
        )}
        <Button size="small" onClick={onToggleExpanded} sx={{ minWidth: 32, fontSize: 14 }}>
          ✂️
        </Button>
        <Button size="small" onClick={onDeck1} sx={{ minWidth: 40 }}>
          → D1
        </Button>
        <Button size="small" onClick={onDeck2} sx={{ minWidth: 40 }}>
          → D2
        </Button>
        {onRemove && (
          <Button size="small" onClick={onRemove} sx={{ minWidth: 28, color: '#ff5470' }}>
            ×
          </Button>
        )}
      </ListItemButton>
      {expanded && <TrimEditor settings={settings} onChange={onChangeSettings} />}
    </Box>
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
  trackSettings: Record<string, TrimSettings>;
  onUpdateTrackSettings: (key: string, settings: TrimSettings) => void;
}) {
  const { onLoadLocal, onLoadYoutube, trackSettings, onUpdateTrackSettings } = props;

  const [tab, setTab] = useState<'local' | 'youtube'>('local');
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [bpmSort, setBpmSort] = useState<'none' | 'asc' | 'desc'>('none');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mixflowdj_yt_api_key') ?? '');
  const [query, setQuery] = useState('');
  const [playlistInput, setPlaylistInput] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [resultsLabel, setResultsLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function getSettings(key: string): TrimSettings {
    return trackSettings[key] ?? DEFAULT_TRIM;
  }

  function toggleExpanded(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  // Ricarica dall'IndexedDB i file locali salvati nelle sessioni precedenti
  useEffect(() => {
    loadAllLocalTracks().then((files) => {
      if (files.length === 0) return;
      const restored: LocalTrack[] = files.map(({ id, file }) => ({ id, file, bpm: 'loading' }));
      setLocalTracks(restored);
      for (const t of restored) {
        detectBpm(t.file).then((result) => setLocalTracks((prev) => prev.map((x) => (x.id === t.id ? { ...x, bpm: result?.bpm ?? null } : x))));
      }
    });
  }, []);

  // Ricarica gli ultimi risultati/playlist YouTube (solo metadati, nessun file da salvare)
  useEffect(() => {
    const saved = localStorage.getItem('mixflowdj_yt_results');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { results: YouTubeSearchResult[]; label: string | null };
      setResults(parsed.results ?? []);
      setResultsLabel(parsed.label ?? null);
    } catch {
      // dati salvati non validi: ignora
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mixflowdj_yt_results', JSON.stringify({ results, label: resultsLabel }));
  }, [results, resultsLabel]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newTracks: LocalTrack[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      bpm: 'loading',
    }));
    setLocalTracks((prev) => [...prev, ...newTracks]);
    for (const track of newTracks) {
      saveLocalTrack(track.id, track.file).catch(() => {
        // salvataggio persistente fallito (es. quota IndexedDB piena): il brano resta comunque usabile in questa sessione
      });
      detectBpm(track.file).then((result) => {
        setLocalTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, bpm: result?.bpm ?? null } : t)));
      });
    }
  }

  function handleRemoveLocalTrack(id: string) {
    setLocalTracks((prev) => prev.filter((t) => t.id !== id));
    removeLocalTrack(id).catch(() => {});
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
            <Button id="tid-library" component="label" variant="outlined" size="small">
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
            {sortedTracks().map((track) => {
              const key = localTrackKey(track.file);
              return (
                <TrackRow
                  key={track.id}
                  title={track.file.name}
                  subtitle={bpmLabel(track.bpm)}
                  settingsKey={key}
                  settings={getSettings(key)}
                  expanded={expandedKey === key}
                  onToggleExpanded={() => toggleExpanded(key)}
                  onChangeSettings={(s) => onUpdateTrackSettings(key, s)}
                  onDeck1={() => onLoadLocal(1, track.file)}
                  onDeck2={() => onLoadLocal(2, track.file)}
                  onRemove={() => handleRemoveLocalTrack(track.id)}
                />
              );
            })}
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
            {results.map((r) => {
              const key = youtubeTrackKey(r.videoId);
              return (
                <TrackRow
                  key={r.videoId}
                  title={r.title}
                  subtitle={r.channelTitle}
                  avatar={r.thumbnailUrl}
                  settingsKey={key}
                  settings={getSettings(key)}
                  expanded={expandedKey === key}
                  onToggleExpanded={() => toggleExpanded(key)}
                  onChangeSettings={(s) => onUpdateTrackSettings(key, s)}
                  onDeck1={() => onLoadYoutube(1, r.videoId, r.title)}
                  onDeck2={() => onLoadYoutube(2, r.videoId, r.title)}
                />
              );
            })}
          </List>

          {results.length === 0 && !loading && !error && (
            <Typography variant="body2" sx={{ opacity: 0.5 }}>
              I risultati della ricerca o della playlist appariranno qui.
            </Typography>
          )}

          <Typography variant="caption" sx={{ opacity: 0.45, display: 'block', mt: 1 }}>
            Il BPM automatico non è disponibile per YouTube (nessun accesso all'audio grezzo), quindi l'ordinamento per
            BPM riguarda solo i file locali. Inizio/fine/fade (✂️) funzionano invece su entrambe le sorgenti.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
