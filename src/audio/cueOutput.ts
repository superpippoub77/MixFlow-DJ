/**
 * Riproduce il "bus cuffie" (PFL) su un dispositivo di uscita audio a scelta,
 * separato da quello del master (es. le tue cuffie collegate via USB/jack,
 * mentre il master continua sugli altoparlanti).
 *
 * Usa HTMLMediaElement.setSinkId(), supportata da Chrome/Edge/Opera; su
 * Safari e Firefox (al momento) non è disponibile: in quel caso il preview
 * suona comunque, ma sullo stesso dispositivo di uscita di sistema, non è
 * possibile scegliere un'uscita diversa da browser.
 */
export class CueMonitor {
  readonly audioEl: HTMLAudioElement;

  constructor(stream: MediaStream) {
    this.audioEl = new Audio();
    // srcObject accetta un MediaStream anche se il tipo DOM lib a volte non lo riflette perfettamente
    (this.audioEl as HTMLAudioElement & { srcObject: MediaStream | null }).srcObject = stream;
    this.audioEl.autoplay = true;
    this.audioEl.play().catch(() => {
      // Verrà sbloccato al primo gesto utente reale (es. click su "Connetti controller")
    });
  }

  supportsDeviceSelection(): boolean {
    return typeof (this.audioEl as unknown as { setSinkId?: unknown }).setSinkId === 'function';
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const el = this.audioEl as unknown as { setSinkId?: (id: string) => Promise<void> };
    if (typeof el.setSinkId === 'function') {
      await el.setSinkId(deviceId);
    }
  }

  resume() {
    this.audioEl.play().catch(() => {});
  }
}
