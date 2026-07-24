/** Formatta secondi in mm:ss */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Converte "mm:ss" o un numero di secondi puro in secondi totali; null se non valido */
export function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return null;
}
