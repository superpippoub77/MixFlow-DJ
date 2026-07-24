export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

/**
 * Cerca video su YouTube tramite YouTube Data API v3.
 * Richiede una API key personale (Google Cloud Console -> abilita "YouTube Data API v3").
 * La key viene usata solo per chiamare direttamente googleapis.com dal browser
 * dell'utente: non transita da nessun altro server.
 */
export async function searchYouTube(apiKey: string, query: string): Promise<YouTubeSearchResult[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '12');
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    let message = `Errore YouTube API (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignora, usa il messaggio generico
    }
    throw new Error(message);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      videoId: item.id.videoId as string,
      title: item.snippet?.title ?? '(senza titolo)',
      channelTitle: item.snippet?.channelTitle ?? '',
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? '',
    }));
}
