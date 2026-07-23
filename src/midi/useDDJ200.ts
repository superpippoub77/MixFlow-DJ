import { useCallback, useEffect, useRef, useState } from 'react';
import { DDJ200Decoder, type DDJ200Event } from './decodeDDJ200';

export type ConnectionStatus =
  | 'unsupported' // il browser non ha Web MIDI
  | 'idle' // in attesa che l'utente conceda il permesso / scelga la porta
  | 'requesting'
  | 'no-input' // nessuna porta MIDI di input trovata
  | 'connected'
  | 'error';

export interface MidiInputInfo {
  id: string;
  name: string;
}

const MAX_LOG = 200;

export function useDDJ200() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const [inputs, setInputs] = useState<MidiInputInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | undefined>();
  const [lastEvent, setLastEvent] = useState<DDJ200Event | undefined>();
  const [log, setLog] = useState<DDJ200Event[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const decoderRef = useRef(new DDJ200Decoder());
  const listenersRef = useRef(new Set<(e: DDJ200Event) => void>());
  const currentInputRef = useRef<MIDIInput | null>(null);

  /** Punto di estensione: qui il "tuo programma" si aggancia per reagire ai comandi */
  const onEvent = useCallback((cb: (e: DDJ200Event) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const handleMessage = useCallback((ev: MIDIMessageEvent) => {
    if (!ev.data) return;
    const decoded = decoderRef.current.decode(ev.data);
    setLastEvent(decoded);
    setLog((prev) => [decoded, ...prev].slice(0, MAX_LOG));

    if (decoded.kind === 'knob' || decoded.kind === 'fader') {
      setValues((prev) => ({ ...prev, [decoded.key]: decoded.value }));
    }
    if (decoded.kind === 'button' || decoded.kind === 'hotcue') {
      setValues((prev) => ({ ...prev, [decoded.key]: decoded.pressed ? 1 : 0 }));
    }

    for (const cb of listenersRef.current) cb(decoded);
  }, []);

  const attachInput = useCallback(
    (input: MIDIInput) => {
      if (currentInputRef.current) {
        currentInputRef.current.onmidimessage = null;
      }
      currentInputRef.current = input;
      input.onmidimessage = handleMessage;
      setSelectedInputId(input.id);
      setStatus('connected');
    },
    [handleMessage],
  );

  const refreshInputs = useCallback(
    (access: MIDIAccess) => {
      const list: MidiInputInfo[] = [];
      access.inputs.forEach((input) => list.push({ id: input.id, name: input.name ?? input.id }));
      setInputs(list);

      if (list.length === 0) {
        setStatus('no-input');
        return;
      }

      // Preferisci automaticamente una porta il cui nome contiene "DDJ-200"
      const preferred =
        Array.from(access.inputs.values()).find((i) => (i.name ?? '').toLowerCase().includes('ddj-200')) ??
        Array.from(access.inputs.values())[0];

      if (preferred && preferred.id !== currentInputRef.current?.id) {
        attachInput(preferred);
      }
    },
    [attachInput],
  );

  const connect = useCallback(async () => {
    if (!('requestMIDIAccess' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    setError(undefined);
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      access.onstatechange = () => refreshInputs(access);
      refreshInputs(access);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refreshInputs]);

  const selectInput = useCallback((id: string) => {
    const access = midiAccessRef.current;
    if (!access) return;
    const input = access.inputs.get(id);
    if (input) attachInput(input);
  }, [attachInput]);

  useEffect(() => {
    return () => {
      if (currentInputRef.current) currentInputRef.current.onmidimessage = null;
      if (midiAccessRef.current) midiAccessRef.current.onstatechange = null;
    };
  }, []);

  return {
    status,
    error,
    inputs,
    selectedInputId,
    connect,
    selectInput,
    lastEvent,
    log,
    values,
    onEvent,
  };
}
