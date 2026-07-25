import { loadYouTubeIframeApi } from '../youtube/loadYouTubeApi';

export type SourceType = 'local' | 'youtube';
export type EqBand = 'low' | 'mid' | 'high';

export interface TrimSettings {
  start: number | null; // secondi: null = dall'inizio del file
  end: number | null; // secondi: null = fino alla fine del file
  fadeIn: boolean;
  fadeOut: boolean;
  fadeDuration: number; // durata delle dissolvenze, in secondi
}

export const DEFAULT_TRIM: TrimSettings = { start: null, end: null, fadeIn: false, fadeOut: false, fadeDuration: 3 };

export interface DeckSnapshot {
  sourceType: SourceType | null;
  title: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  cueActive: boolean;
  cuePointSet: boolean;
  syncActive: boolean;
  tempoRange: number;
  hotCues: Record<number, boolean>;
  playbackRate: number;
}

// Range del pitch selezionabili con SHIFT + BEAT SYNC (come sull'hardware reale: ±6/±10/±16%/Wide)
export const TEMPO_RANGES = [0.06, 0.1, 0.16, 1] as const;
export const TEMPO_RANGE_LABELS: Record<number, string> = {
  [0.06]: '±6%',
  [0.1]: '±10%',
  [0.16]: '±16%',
  [1]: 'WIDE',
};

// Range EQ in stile "DJ kill": knob al centro (0.5) = 0 dB, agli estremi ±12 dB.
const EQ_RANGE_DB = 12;

export class Deck {
  readonly id: 1 | 2;
  private ctx: AudioContext;

  // --- catena locale (Web Audio) ---
  private audioEl: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private lowFilter: BiquadFilterNode;
  private midFilter: BiquadFilterNode;
  private highFilter: BiquadFilterNode;
  private cfxFilter: BiquadFilterNode;
  private trimFadeGain: GainNode;
  private volumeGain: GainNode;
  private cueTap: GainNode;

  // --- YouTube ---
  private ytPlayer: any = null;
  private ytReady = false;
  private readonly ytContainerId: string;

  private sourceType: SourceType | null = null;
  private title: string | null = null;
  private volumeFader = 1; // posizione 0..1 del fader volume del mixer
  private crossfaderGain = 1; // 0..1, calcolato dal crossfader master
  private cueActive = false;
  private cuePoint: number | null = null;
  private syncActive = false;
  private tempoRange: number = TEMPO_RANGES[0];
  private lastTempoFaderValue = 0.5;
  private hotCues: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null };
  private trimStart: number | null = null;
  private trimEnd: number | null = null;
  private fadeInEnabled = false;
  private fadeOutEnabled = false;
  private fadeDuration = 3;
  private trimTimer: ReturnType<typeof setInterval> | null = null;

  private listeners = new Set<() => void>();
  private endedListeners = new Set<() => void>();

  constructor(id: 1 | 2, ctx: AudioContext, destination: AudioNode, cueBus: AudioNode) {
    this.id = id;
    this.ctx = ctx;
    this.ytContainerId = `yt-deck-${id}`;

    this.lowFilter = ctx.createBiquadFilter();
    this.lowFilter.type = 'lowshelf';
    this.lowFilter.frequency.value = 200;

    this.midFilter = ctx.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 0.9;

    this.highFilter = ctx.createBiquadFilter();
    this.highFilter.type = 'highshelf';
    this.highFilter.frequency.value = 5000;

    this.cfxFilter = ctx.createBiquadFilter();
    this.cfxFilter.type = 'allpass'; // stato neutro/bypass, sovrascritto da setFilter()

    this.volumeGain = ctx.createGain();
    this.trimFadeGain = ctx.createGain();
    this.cueTap = ctx.createGain();
    this.cueTap.gain.value = 0; // 0 = non in cuffia, 1 = in ascolto (PFL)

    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);
    this.highFilter.connect(this.cfxFilter);
    this.cfxFilter.connect(this.trimFadeGain);
    this.trimFadeGain.connect(this.volumeGain);
    this.volumeGain.connect(destination);

    // Tap "pre-fader" per il preview in cuffia: prende il segnale dopo EQ/filtro
    // ma prima del volume/crossfader, come il PFL di un mixer vero.
    this.cfxFilter.connect(this.cueTap);
    this.cueTap.connect(cueBus);
  }

  getYtContainerId() {
    return this.ytContainerId;
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Notificato quando il brano finisce da solo (non su pausa/cue manuale): usato per avanzare la coda */
  onEnded(cb: () => void) {
    this.endedListeners.add(cb);
    return () => {
      this.endedListeners.delete(cb);
    };
  }

  private emitEnded() {
    for (const l of this.endedListeners) l();
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  // --- caricamento sorgenti ---

  loadLocalFile(file: File, trim: TrimSettings = DEFAULT_TRIM) {
    if (this.ytReady) this.ytPlayer.pauseVideo();

    if (this.audioEl) {
      this.audioEl.pause();
    }

    const url = URL.createObjectURL(file);
    const el = this.audioEl ?? new Audio();
    el.crossOrigin = 'anonymous';
    el.src = url;

    if (!this.sourceNode) {
      // Un MediaElementAudioSourceNode può essere creato una sola volta per
      // <audio>: riusiamo sempre lo stesso elemento e cambiamo solo `src`.
      const node = this.ctx.createMediaElementSource(el);
      node.connect(this.lowFilter);
      this.sourceNode = node;
      el.addEventListener('timeupdate', () => this.notify());
      el.addEventListener('loadedmetadata', () => {
        this.notify();
        if (this.trimStart != null) this.seekTo(this.trimStart);
      });
      el.addEventListener('play', () => this.notify());
      el.addEventListener('pause', () => this.notify());
      el.addEventListener('ended', () => {
        this.notify();
        this.emitEnded();
      });
    }

    this.audioEl = el;
    this.sourceType = 'local';
    this.title = file.name;
    this.resetHotCues();
    this.applyTrim(trim);
    this.notify();
  }

  async loadYoutube(videoId: string, title: string, trim: TrimSettings = DEFAULT_TRIM) {
    this.audioEl?.pause();
    this.sourceType = 'youtube';
    this.title = title;
    this.resetHotCues();
    this.applyTrim(trim);
    this.notify();

    const YT = await loadYouTubeIframeApi();

    if (!this.ytPlayer) {
      await new Promise<void>((resolve) => {
        this.ytPlayer = new YT.Player(this.ytContainerId, {
          width: 160,
          height: 90,
          videoId,
          playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0 },
          events: {
            onReady: () => {
              this.ytReady = true;
              this.ytPlayer.setVolume(this.volumeFader * this.crossfaderGain * 100);
              if (this.trimStart != null) this.seekTo(this.trimStart);
              resolve();
            },
            onStateChange: (e: any) => {
              this.notify();
              if (e?.data === 0) this.emitEnded(); // YT.PlayerState.ENDED
              if (e?.data === 5 && this.trimStart != null) this.seekTo(this.trimStart); // CUED: nuovo video pronto
            },
          },
        });
      });
    } else {
      this.ytPlayer.cueVideoById(videoId);
    }
  }

  // --- trasporto ---

  play() {
    if (this.trimStart != null && this.getCurrentTime() < this.trimStart - 0.05) {
      this.seekTo(this.trimStart);
    }
    if (this.sourceType === 'local') this.audioEl?.play();
    else if (this.sourceType === 'youtube' && this.ytReady) this.ytPlayer.playVideo();
  }

  pause() {
    if (this.sourceType === 'local') this.audioEl?.pause();
    else if (this.sourceType === 'youtube' && this.ytReady) this.ytPlayer.pauseVideo();
  }

  togglePlay() {
    if (this.isPlaying()) this.pause();
    else this.play();
  }

  isPlaying(): boolean {
    if (this.sourceType === 'local') return !!this.audioEl && !this.audioEl.paused;
    if (this.sourceType === 'youtube' && this.ytReady) return this.ytPlayer.getPlayerState() === 1;
    return false;
  }

  /**
   * CUE: se il deck sta suonando, torna al cue point salvato e mette in
   * pausa. Se è fermo e non c'è ancora un cue point, lo imposta qui; se
   * c'è già, ci salta. Il LED (vedi getSnapshot -> cuePointSet) resta
   * acceso finché un cue point è memorizzato, non solo mentre premi.
   */
  cue() {
    if (this.isPlaying()) {
      this.seekTo(this.cuePoint ?? this.trimStart ?? 0);
      this.pause();
    } else if (this.cuePoint == null) {
      this.cuePoint = this.getCurrentTime();
    } else {
      this.seekTo(this.cuePoint);
    }
    this.notify();
  }

  /** SHIFT + CUE: torna sempre all'inizio della traccia (non al cue point) */
  goToStart() {
    this.seekTo(0);
    this.pause();
    this.notify();
  }

  seekBy(deltaSeconds: number) {
    this.seekTo(this.getCurrentTime() + deltaSeconds);
  }

  seekTo(t: number) {
    const time = Math.max(0, t);
    if (this.sourceType === 'local' && this.audioEl) this.audioEl.currentTime = time;
    else if (this.sourceType === 'youtube' && this.ytReady) this.ytPlayer.seekTo(time, true);
  }

  getCurrentTime(): number {
    if (this.sourceType === 'local') return this.audioEl?.currentTime ?? 0;
    if (this.sourceType === 'youtube' && this.ytReady) return this.ytPlayer.getCurrentTime() ?? 0;
    return 0;
  }

  getDuration(): number {
    if (this.sourceType === 'local') return this.audioEl?.duration || 0;
    if (this.sourceType === 'youtube' && this.ytReady) return this.ytPlayer.getDuration() || 0;
    return 0;
  }

  /** Velocità di riproduzione attuale (1 = normale): usata per calcolare il BPM effettivo e per il Beat Sync */
  getPlaybackRate(): number {
    if (this.sourceType === 'local' && this.audioEl) return this.audioEl.playbackRate;
    if (this.sourceType === 'youtube' && this.ytReady) return this.ytPlayer.getPlaybackRate?.() ?? 1;
    return 1;
  }

  /**
   * Applica inizio/fine personalizzati e fade in/out per il brano appena
   * caricato. Avvia un piccolo timer che controlla ogni 100ms se siamo
   * arrivati al punto di fine (per fermarsi/avanzare la coda, come una fine
   * naturale) o se siamo in una delle due finestre di dissolvenza.
   */
  private applyTrim(trim: TrimSettings) {
    this.trimStart = trim.start;
    this.trimEnd = trim.end;
    this.fadeInEnabled = trim.fadeIn;
    this.fadeOutEnabled = trim.fadeOut;
    this.fadeDuration = Math.max(0.5, trim.fadeDuration);
    this.trimFadeGain.gain.value = this.fadeInEnabled ? 0 : 1;
    this.cuePoint = trim.start; // il punto di inizio personalizzato è anche il cue point iniziale
    this.syncActive = false;

    if (this.trimTimer != null) clearInterval(this.trimTimer);
    this.trimTimer = setInterval(() => this.tickTrim(), 100);
  }

  private tickTrim() {
    if (this.sourceType == null) return;
    const t = this.getCurrentTime();
    const now = this.ctx.currentTime;

    // Fine personalizzata raggiunta: si comporta come una fine naturale (avanza la coda)
    if (this.trimEnd != null && this.isPlaying() && t >= this.trimEnd) {
      this.pause();
      this.emitEnded();
      return;
    }

    if (!this.fadeInEnabled && !this.fadeOutEnabled) return; // niente dissolvenze da calcolare

    let gain = 1;
    const start = this.trimStart ?? 0;
    if (this.fadeInEnabled) {
      const elapsed = t - start;
      if (elapsed < this.fadeDuration) gain = Math.min(gain, Math.max(0, elapsed / this.fadeDuration));
    }
    if (this.fadeOutEnabled && this.trimEnd != null) {
      const remaining = this.trimEnd - t;
      if (remaining < this.fadeDuration) gain = Math.min(gain, Math.max(0, remaining / this.fadeDuration));
    }
    this.trimFadeGain.gain.setTargetAtTime(gain, now, 0.05);
  }

  // --- controlli dal mixer ---

  /** EQ reale via BiquadFilter: disponibile solo per i brani locali (YouTube non espone l'audio grezzo) */
  setEQ(band: EqBand, value: number) {
    if (this.sourceType !== 'local') return;
    const db = (value - 0.5) * 2 * EQ_RANGE_DB;
    const node = band === 'low' ? this.lowFilter : band === 'mid' ? this.midFilter : this.highFilter;
    node.gain.setTargetAtTime(db, this.ctx.currentTime, 0.01);
  }

  /**
   * Knob CFX/filtro: al centro (0.5) è trasparente, verso sinistra applica un
   * low-pass con frequenza di taglio decrescente, verso destra un high-pass
   * con frequenza di taglio crescente — come il knob "Filter" reale del DDJ-200.
   */
  setFilter(value: number) {
    const centered = value - 0.5; // -0.5..0.5
    const now = this.ctx.currentTime;
    if (Math.abs(centered) < 0.02) {
      this.cfxFilter.type = 'allpass';
      return;
    }
    if (centered < 0) {
      const t = -centered * 2; // 0..1
      const freq = 18000 * Math.pow(300 / 18000, t);
      this.cfxFilter.type = 'lowpass';
      this.cfxFilter.Q.setTargetAtTime(1, now, 0.01);
      this.cfxFilter.frequency.setTargetAtTime(freq, now, 0.01);
    } else {
      const t = centered * 2; // 0..1
      const freq = 60 * Math.pow(4000 / 60, t);
      this.cfxFilter.type = 'highpass';
      this.cfxFilter.Q.setTargetAtTime(1, now, 0.01);
      this.cfxFilter.frequency.setTargetAtTime(freq, now, 0.01);
    }
  }

  setTempo(value: number) {
    this.lastTempoFaderValue = value;
    const rate = 1 + (value - 0.5) * 2 * this.tempoRange;
    this.setPlaybackRateAbsolute(rate);
  }

  /** SHIFT + BEAT SYNC: cambia il range del pitch (±6/±10/±16%/Wide) e lo riapplica subito alla posizione attuale del fader */
  setTempoRange(range: number) {
    this.tempoRange = range;
    this.setTempo(this.lastTempoFaderValue);
  }

  getTempoRange(): number {
    return this.tempoRange;
  }

  /** Stato del LED Beat Sync: acceso quando il sync è attivo (interruttore persistente, non "mentre premi") */
  isSyncActive(): boolean {
    return this.syncActive;
  }

  setSyncActive(active: boolean) {
    this.syncActive = active;
    this.notify();
  }

  /** Imposta direttamente il rapporto di velocità (usato dall'automix per il beatmatching), bypassando il range ±8% del fader tempo */
  setPlaybackRateAbsolute(rate: number) {
    if (this.sourceType === 'local' && this.audioEl) {
      this.audioEl.playbackRate = rate;
    } else if (this.sourceType === 'youtube' && this.ytReady) {
      // YouTube supporta solo un set discreto di velocità: scegliamo la più vicina.
      const rates: number[] = this.ytPlayer.getAvailablePlaybackRates?.() ?? [1];
      const nearest = rates.reduce((a, b) => (Math.abs(b - rate) < Math.abs(a - rate) ? b : a), 1);
      this.ytPlayer.setPlaybackRate(nearest);
    }
  }

  /**
   * PFL/preview in cuffia: manda il segnale di questo deck (post EQ/filtro,
   * pre volume/crossfader) al bus cuffie invece che al master. Funziona solo
   * per i file locali: l'audio di YouTube non passa dal grafico Web Audio,
   * quindi non può essere "spillato" verso un'altra uscita.
   */
  setCue(active: boolean) {
    this.cueActive = active;
    this.cueTap.gain.setTargetAtTime(active ? 1 : 0, this.ctx.currentTime, 0.01);
  }

  toggleCue() {
    this.setCue(!this.cueActive);
  }

  isCueActive() {
    return this.cueActive;
  }

  /**
   * Hot cue: il primo tocco su un pad libero salva la posizione attuale;
   * toccare un pad già impostato salta subito lì (e avvia la riproduzione),
   * come le hot cue di un lettore/mixer vero.
   */
  setHotCueOrJump(pad: number) {
    if (this.sourceType === null) return;
    const existing = this.hotCues[pad];
    if (existing == null) {
      this.hotCues[pad] = this.getCurrentTime();
    } else {
      this.seekTo(existing);
      this.play();
    }
    this.notify();
  }

  clearHotCue(pad: number) {
    this.hotCues[pad] = null;
    this.notify();
  }

  private resetHotCues() {
    for (const pad of Object.keys(this.hotCues)) this.hotCues[Number(pad)] = null;
  }

  /** Chiamato dall'AudioEngine ogni volta che cambia il fader volume o il crossfader */
  setMix(volumeFader: number, crossfaderGain: number) {
    this.volumeFader = volumeFader;
    this.crossfaderGain = crossfaderGain;
    const gain = volumeFader * crossfaderGain;
    this.volumeGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
    if (this.sourceType === 'youtube' && this.ytReady) this.ytPlayer.setVolume(gain * 100);
  }

  getSnapshot(): DeckSnapshot {
    const hotCues: Record<number, boolean> = {};
    for (const pad of Object.keys(this.hotCues)) hotCues[Number(pad)] = this.hotCues[Number(pad)] != null;
    return {
      sourceType: this.sourceType,
      title: this.title,
      playing: this.isPlaying(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      cueActive: this.cueActive,
      cuePointSet: this.cuePoint != null,
      syncActive: this.syncActive,
      tempoRange: this.tempoRange,
      hotCues,
      playbackRate: this.getPlaybackRate(),
    };
  }
}
