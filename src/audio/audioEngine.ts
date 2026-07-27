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

  /**
   * BEAT SYNC: interruttore persistente (non un'azione momentanea). Se lo
   * attivi e conosciamo il BPM di entrambe le tracce, allinea sia la
   * velocità che la fase del beat-grid di questo deck a quella dell'altro
   * (auto-align, non solo lo stesso BPM: anche i battiti combaciano nel
   * tempo). Se lo disattivi, il LED si spegne (pitch e posizione raggiunti
   * restano quelli finché non tocchi di nuovo il fader tempo).
   */
  toggleSync(deck: 1 | 2, bpms: Record<1 | 2, number | null>, phases: Record<1 | 2, number | null>) {
    const other = deck === 1 ? 2 : 1;
    const d = this.decks[deck];
    if (d.isSyncActive()) {
      d.setSyncActive(false);
      return;
    }
    const myBpm = bpms[deck];
    const otherBpm = bpms[other];
    if (myBpm && otherBpm) {
      const otherRate = this.decks[other].getPlaybackRate();
      d.setPlaybackRateAbsolute((otherBpm * otherRate) / myBpm);
      this.alignPhase(deck, other, bpms, phases);
    }
    d.setSyncActive(true);
  }

  /**
   * Allinea la fase del beat-grid del deck "target" a quella del deck
   * "reference": calcola dove cade il battito più vicino in entrambi (usando
   * il BPM/fase grezzi di ciascun file, indipendenti dal playback rate
   * attuale) e sposta la posizione del target del minimo necessario perché
   * i due battiti combacino nel tempo.
   */
  private alignPhase(target: 1 | 2, reference: 1 | 2, bpms: Record<1 | 2, number | null>, phases: Record<1 | 2, number | null>) {
    const bpmT = bpms[target];
    const bpmR = bpms[reference];
    const phaseT = phases[target];
    const phaseR = phases[reference];
    if (!bpmT || !bpmR || phaseT == null || phaseR == null) return;

    const intervalT = 60 / bpmT;
    const intervalR = 60 / bpmR;

    const fracT = (((this.decks[target].getCurrentTime() - phaseT) % intervalT) + intervalT) % intervalT / intervalT;
    const fracR = (((this.decks[reference].getCurrentTime() - phaseR) % intervalR) + intervalR) % intervalR / intervalR;

    let deltaBeats = fracR - fracT;
    if (deltaBeats > 0.5) deltaBeats -= 1;
    if (deltaBeats < -0.5) deltaBeats += 1;

    this.decks[target].seekBy(deltaBeats * intervalT);
  }

  private applyMix() {
    // Curva a potenza costante, standard per i crossfader dei mixer DJ.
    const gain1 = Math.cos((this.crossfaderPos * Math.PI) / 2);
    const gain2 = Math.sin((this.crossfaderPos * Math.PI) / 2);
    this.decks[1].setMix(this.volumeFaders[1], gain1);
    this.decks[2].setMix(this.volumeFaders[2], gain2);
  }
}
