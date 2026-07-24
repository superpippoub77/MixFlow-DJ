/**
 * Stima approssimativa del BPM di un file audio locale.
 *
 * Funziona solo per i file locali: per le tracce YouTube non abbiamo accesso
 * ai dati audio grezzi (stesso limite dell'EQ, vedi deck.ts).
 *
 * Algoritmo: isola le basse frequenze (tipicamente la cassa), individua i
 * picchi di energia con una soglia adattiva, calcola gli intervalli tra
 * picchi consecutivi e prende l'intervallo più ricorrente come battito.
 * È una stima euristica pensata per musica a beat regolare (house, techno,
 * pop...), non un vero beat-tracking: su generi con ritmica irregolare o
 * poco percussiva può sbagliare o non trovare nulla.
 */
export async function detectBpm(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decodeCtx = new AudioContext();
    const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    await decodeCtx.close();

    const sampleRate = audioBuffer.sampleRate;
    const duration = Math.min(audioBuffer.duration, 60); // analizza al massimo i primi 60s
    const offline = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

    const source = offline.createBufferSource();
    source.buffer = audioBuffer;

    const lowpass = offline.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 150; // isola le basse frequenze (kick)

    source.connect(lowpass);
    lowpass.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    const data = rendered.getChannelData(0);

    // Cerca i picchi abbassando progressivamente la soglia finché non ne trova abbastanza
    let peaks: number[] = [];
    let threshold = 0.9;
    const minGapSamples = Math.floor(sampleRate * 0.2); // non contare due volte lo stesso colpo

    while (peaks.length < 30 && threshold > 0.1) {
      peaks = [];
      let i = 0;
      while (i < data.length) {
        if (data[i] > threshold) {
          peaks.push(i);
          i += minGapSamples;
        } else {
          i++;
        }
      }
      threshold -= 0.05;
    }

    if (peaks.length < 4) return null;

    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1]);

    // Ogni intervallo diventa un BPM candidato, normalizzato in un range plausibile (70-180)
    const buckets = new Map<number, number>();
    for (const interval of intervals) {
      let bpm = 60 / (interval / sampleRate);
      while (bpm < 70) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      const bucket = Math.round(bpm);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }

    let bestBpm: number | null = null;
    let bestCount = 0;
    for (const [bpm, count] of buckets) {
      if (count > bestCount) {
        bestCount = count;
        bestBpm = bpm;
      }
    }

    return bestBpm;
  } catch {
    return null;
  }
}
