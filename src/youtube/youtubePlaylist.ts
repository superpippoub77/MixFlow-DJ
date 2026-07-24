import type { YouTubeSearchResult } from './youtubeSearch';

/** Estrae l'ID di una playlist da un URL YouTube o lo restituisce se è già un ID grezzo */
export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const listParam = url.searchParams.get('list');
    if (listParam) return listParam;
  } catch {
    // non è un URL valido: potrebbe già essere un ID playlist grezzo (es. "PLxxxx")
  }

  if (/^[\w-]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Recupera i video di una playlist YouTube pubblica tramite YouTube Data API v3.
 * Usa la stessa API key personale della ricerca.
 */
export async function fetchYoutubePlaylist(apiKey: string, playlistId: string): Promise<YouTubeSearchResult[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    let message = `Errore YouTube API (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // usa il messaggio generico
    }
    throw new Error(message);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((item: any) => item.snippet?.resourceId?.videoId)
    .map((item: any) => ({
      videoId: item.snippet.resourceId.videoId as string,
      title: item.snippet.title ?? '(senza titolo)',
      channelTitle: item.snippet.videoOwnerChannelTitle ?? item.snippet.channelTitle ?? '',
      thumbnailUrl: item.snippet.thumbnails?.default?.url ?? '',
    }));
}
