import { loadYouTubeIframeApi } from '../youtube/loadYouTubeApi';

export type SourceType = 'local' | 'youtube';
export type EqBand = 'low' | 'mid' | 'high';

export interface DeckSnapshot {
  sourceType: SourceType | null;
  title: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
}

// Il fader del tempo del DDJ-200 di default copre ±8% (selezionabile in
// hardware su ±6/±10/±16/±100%, ma software-side vediamo solo la posizione
// 0..1 del fader): assumiamo qui il default ±8%.
const TEMPO_RANGE = 0.08;
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
  private volumeGain: GainNode;

  // --- YouTube ---
  private ytPlayer: any = null;
  private ytReady = false;
  private readonly ytContainerId: string;

  private sourceType: SourceType | null = null;
  private title: string | null = null;
  private volumeFader = 1; // posizione 0..1 del fader volume del mixer
  private crossfaderGain = 1; // 0..1, calcolato dal crossfader master

  private listeners = new Set<() => void>();

  constructor(id: 1 | 2, ctx: AudioContext, destination: AudioNode) {
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

    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);
    this.highFilter.connect(this.cfxFilter);
    this.cfxFilter.connect(this.volumeGain);
    this.volumeGain.connect(destination);
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

  private notify() {
    for (const l of this.listeners) l();
  }

  // --- caricamento sorgenti ---

  loadLocalFile(file: File) {
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
      el.addEventListener('loadedmetadata', () => this.notify());
      el.addEventListener('play', () => this.notify());
      el.addEventListener('pause', () => this.notify());
      el.addEventListener('ended', () => this.notify());
    }

    this.audioEl = el;
    this.sourceType = 'local';
    this.title = file.name;
    this.notify();
  }

  async loadYoutube(videoId: string, title: string) {
    this.audioEl?.pause();
    this.sourceType = 'youtube';
    this.title = title;
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
              resolve();
            },
            onStateChange: () => this.notify(),
          },
        });
      });
    } else {
      this.ytPlayer.cueVideoById(videoId);
    }
  }

  // --- trasporto ---

  play() {
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

  /** CUE: torna semplicemente all'inizio del brano (nessun cue-point salvato, per ora) */
  cue() {
    this.seekTo(0);
    this.pause();
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
    const rate = 1 + (value - 0.5) * 2 * TEMPO_RANGE;
    this.setPlaybackRateAbsolute(rate);
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

  /** Chiamato dall'AudioEngine ogni volta che cambia il fader volume o il crossfader */
  setMix(volumeFader: number, crossfaderGain: number) {
    this.volumeFader = volumeFader;
    this.crossfaderGain = crossfaderGain;
    const gain = volumeFader * crossfaderGain;
    this.volumeGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01);
    if (this.sourceType === 'youtube' && this.ytReady) this.ytPlayer.setVolume(gain * 100);
  }

  getSnapshot(): DeckSnapshot {
    return {
      sourceType: this.sourceType,
      title: this.title,
      playing: this.isPlaying(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    };
  }
}
