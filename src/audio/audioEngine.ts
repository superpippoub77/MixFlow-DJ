import { Deck } from './deck';

export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  readonly decks: Record<1 | 2, Deck>;

  private volumeFaders: Record<1 | 2, number> = { 1: 1, 2: 1 };
  private crossfaderPos = 0.5; // 0 = tutto Deck 1, 1 = tutto Deck 2

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.decks = {
      1: new Deck(1, this.ctx, this.masterGain),
      2: new Deck(2, this.ctx, this.masterGain),
    };
  }

  /** Da chiamare dentro un gesto utente reale (click) per sbloccare l'AudioContext */
  resume() {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumeFader(deck: 1 | 2, value: number) {
    this.volumeFaders[deck] = value;
    this.applyMix();
  }

  setCrossfader(value: number) {
    this.crossfaderPos = value;
    this.applyMix();
  }

  private applyMix() {
    // Curva a potenza costante, standard per i crossfader dei mixer DJ.
    const gain1 = Math.cos((this.crossfaderPos * Math.PI) / 2);
    const gain2 = Math.sin((this.crossfaderPos * Math.PI) / 2);
    this.decks[1].setMix(this.volumeFaders[1], gain1);
    this.decks[2].setMix(this.volumeFaders[2], gain2);
  }
}
