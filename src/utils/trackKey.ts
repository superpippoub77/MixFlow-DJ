/** Chiave stabile per un file locale, usata per associargli inizio/fine/fade nella libreria */
export function localTrackKey(file: File): string {
  return `local:${file.name}:${file.size}`;
}

/** Chiave stabile per un video YouTube */
export function youtubeTrackKey(videoId: string): string {
  return `yt:${videoId}`;
}
