import { Deck } from './deck';
import { CueMonitor } from './cueOutput';
import { FxEngine } from './fxPads';

export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  readonly decks: Record<1 | 2, Deck>;
  readonly fx: FxEngine;

  private readonly cueBus: GainNode;
  private readonly cueDestination: MediaStreamAudioDestinationNode;
  private readonly masterCueTap: GainNode;
  readonly cueMonitor: CueMonitor;
  private masterCueActive = false;

  private readonly recordingDestination: MediaStreamAudioDestinationNode;

  private volumeFaders: Record<1 | 2, number> = { 1: 1, 2: 1 };
  private crossfaderPos = 0.5; // 0 = tutto Deck 1, 1 = tutto Deck 2

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    // Bus cuffie (PFL): un destination separato, instradabile su un dispositivo
    // di uscita diverso da quello del master (vedi CueMonitor/audioDevices.ts).
    this.cueBus = this.ctx.createGain();
    this.cueDestination = this.ctx.createMediaStreamDestination();
    this.cueBus.connect(this.cueDestination);
    this.cueMonitor = new CueMonitor(this.cueDestination.stream);

    // MASTER CUE: monitora anche il mix finale (post-crossfader) in cuffia
    this.masterCueTap = this.ctx.createGain();
    this.masterCueTap.gain.value = 0;
    this.masterGain.connect(this.masterCueTap);
    this.masterCueTap.connect(this.cueBus);

    this.decks = {
      1: new Deck(1, this.ctx, this.masterGain, this.cueBus),
      2: new Deck(2, this.ctx, this.masterGain, this.cueBus),
    };

    // Bus di registrazione: cattura il mix finale (master, post-crossfader) per il MixRecorder.
    this.recordingDestination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.recordingDestination);

    this.fx = new FxEngine(this.ctx, this.masterGain);
  }

  getRecordingStream(): MediaStream {
    return this.recordingDestination.stream;
  }

  /** Da chiamare dentro un gesto utente reale (click) per sbloccare l'AudioContext */
  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.cueMonitor.resume();
  }

  setVolumeFader(deck: 1 | 2, value: number) {
    this.volumeFaders[deck] = value;
    this.applyMix();
  }

  setCrossfader(value: number) {
    this.crossfaderPos = value;
    this.applyMix();
  }

  setMasterCue(active: boolean) {
    this.masterCueActive = active;
    this.masterCueTap.gain.setTargetAtTime(active ? 1 : 0, this.ctx.currentTime, 0.01);
  }

  isMasterCueActive() {
    return this.masterCueActive;
  }

  private applyMix() {
    // Curva a potenza costante, standard per i crossfader dei mixer DJ.
    const gain1 = Math.cos((this.crossfaderPos * Math.PI) / 2);
    const gain2 = Math.sin((this.crossfaderPos * Math.PI) / 2);
    this.decks[1].setMix(this.volumeFaders[1], gain1);
    this.decks[2].setMix(this.volumeFaders[2], gain2);
  }
}
