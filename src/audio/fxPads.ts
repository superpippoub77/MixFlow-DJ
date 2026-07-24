/**
 * Pad FX "classici" da DJ set, generati proceduralmente con Web Audio (nessun
 * campione/file esterno: zero problemi di copyright). Ogni trigger crea un
 * piccolo grafico usa-e-getta (oscillatori/rumore + inviluppo di volume) e lo
 * manda sul bus indicato — di solito il master, per sentirlo sopra al mix.
 */
export class FxEngine {
  private ctx: AudioContext;
  private output: GainNode; // dove finiscono i pad "usa e getta" (sirena, aereo, air horn, noise sweep)

  // Echo/delay: sempre inserito in parallelo sul master, ma con volume (wet) a
  // zero finché non lo attivi tu — quindi non altera il suono se è spento.
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private wetGain: GainNode;
  private echoActive = false;

  constructor(ctx: AudioContext, masterBus: GainNode) {
    this.ctx = ctx;

    this.output = ctx.createGain();
    this.output.connect(masterBus);

    this.delayNode = ctx.createDelay(2);
    this.delayNode.delayTime.value = 0.28;
    this.feedbackGain = ctx.createGain();
    this.feedbackGain.gain.value = 0.45;
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0;

    masterBus.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(masterBus);
  }

  /** Costruisce un grafico temporaneo (oscillatori/rumore + gain d'inviluppo) collegato al master */
  private trigger(build: (out: GainNode, now: number) => void) {
    const out = this.ctx.createGain();
    out.connect(this.output);
    build(out, this.ctx.currentTime);
  }

  private makeNoiseBuffer(durationSeconds: number): AudioBuffer {
    const length = Math.max(1, Math.ceil(this.ctx.sampleRate * durationSeconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Sirena: oscillatore che sale e scende ciclicamente */
  triggerSiren() {
    this.trigger((out, now) => {
      const dur = 2.4;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(1200, now + dur / 4);
      osc.frequency.linearRampToValueAtTime(300, now + dur / 2);
      osc.frequency.linearRampToValueAtTime(1200, now + (3 * dur) / 4);
      osc.frequency.linearRampToValueAtTime(300, now + dur);

      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(0.35, now + 0.05);
      out.gain.setValueAtTime(0.35, now + dur - 0.15);
      out.gain.linearRampToValueAtTime(0, now + dur);

      osc.connect(out);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    });
  }

  /** "Aereo": rumore + oscillatore che salgono di tono insieme, con taglio secco finale — il classico riser da drop */
  triggerRiser() {
    this.trigger((out, now) => {
      const dur = 3;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.makeNoiseBuffer(dur);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(6000, now + dur);
      filter.Q.value = 0.8;
      noise.connect(filter);
      filter.connect(out);

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + dur);
      const oscGain = this.ctx.createGain();
      oscGain.gain.value = 0.25;
      osc.connect(oscGain);
      oscGain.connect(out);

      out.gain.setValueAtTime(0.001, now);
      out.gain.exponentialRampToValueAtTime(0.5, now + dur * 0.9);
      out.gain.linearRampToValueAtTime(0, now + dur);

      noise.start(now);
      osc.start(now);
      noise.stop(now + dur);
      osc.stop(now + dur);
    });
  }

  /** Air horn: tre onde a dente di sega sovrapposte, come l'accordo di un corno da stadio */
  triggerAirhorn() {
    this.trigger((out, now) => {
      const dur = 0.9;
      const freqs = [233, 349, 466];
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(0.4, now + 0.03);
      out.gain.setValueAtTime(0.4, now + dur - 0.15);
      out.gain.linearRampToValueAtTime(0, now + dur);
      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.connect(out);
        osc.start(now);
        osc.stop(now + dur + 0.05);
      }
    });
  }

  /** Noise sweep (stile piatto rovesciato): rumore filtrato che cresce e si ferma di colpo */
  triggerNoiseSweep() {
    this.trigger((out, now) => {
      const dur = 1.6;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.makeNoiseBuffer(dur);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4000, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + dur);
      noise.connect(filter);
      filter.connect(out);

      out.gain.setValueAtTime(0.001, now);
      out.gain.exponentialRampToValueAtTime(0.45, now + dur * 0.85);
      out.gain.linearRampToValueAtTime(0, now + dur);

      noise.start(now);
      noise.stop(now + dur);
    });
  }

  /** Echo/delay sul master: on/off, per il classico "buttare in eco" prima di una transizione */
  toggleEcho() {
    this.echoActive = !this.echoActive;
    this.wetGain.gain.setTargetAtTime(this.echoActive ? 0.45 : 0, this.ctx.currentTime, 0.05);
  }

  isEchoActive(): boolean {
    return this.echoActive;
  }
}
