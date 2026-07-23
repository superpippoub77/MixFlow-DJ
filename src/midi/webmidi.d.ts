// Dichiarazioni minime per la Web MIDI API.
// TypeScript non le include di default nella lib "dom".

interface MIDIMessageEvent extends Event {
  data: Uint8Array | null;
}

interface MIDIPort extends EventTarget {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => void) | null;
}

interface MIDIOutput extends MIDIPort {
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

interface MIDIInputMap {
  forEach(callback: (input: MIDIInput, key: string) => void): void;
  get(id: string): MIDIInput | undefined;
  values(): IterableIterator<MIDIInput>;
}

interface MIDIOutputMap {
  forEach(callback: (output: MIDIOutput, key: string) => void): void;
  get(id: string): MIDIOutput | undefined;
  values(): IterableIterator<MIDIOutput>;
}

interface MIDIAccess extends EventTarget {
  inputs: MIDIInputMap;
  outputs: MIDIOutputMap;
  onstatechange: ((this: MIDIAccess, ev: Event) => void) | null;
  sysexEnabled: boolean;
}

interface MIDIOptions {
  sysex?: boolean;
  software?: boolean;
}

interface Navigator {
  requestMIDIAccess(options?: MIDIOptions): Promise<MIDIAccess>;
}
