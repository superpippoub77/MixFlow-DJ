/**
 * Registra il mix finale (master, post-crossfader) usando MediaRecorder.
 * Il file prodotto è un webm/opus (formato nativo dei browser per
 * MediaRecorder): leggero e di ottima qualità, apribile in qualunque player
 * o importabile in un editor audio per convertirlo in mp3/wav se serve.
 */
export class MixRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  private stream: MediaStream;

  onStop?: (blob: Blob, durationSeconds: number) => void;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  start() {
    if (!this.isSupported() || this.isRecording()) return;
    this.chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      const durationSeconds = (performance.now() - this.startedAt) / 1000;
      this.onStop?.(blob, durationSeconds);
    };
    this.startedAt = performance.now();
    this.recorder.start();
  }

  stop() {
    this.recorder?.stop();
  }
}
