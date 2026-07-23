import { JOG_CENTER, lookupCC, lookupNote, type Deck } from './ddj200Map';

export type DDJ200Event =
  | {
      kind: 'button';
      deck: Deck;
      control: string;
      key: string;
      pressed: boolean;
      raw: number[];
      timestamp: number;
    }
  | {
      kind: 'hotcue';
      deck: Deck;
      pad: number;
      action: 'activate' | 'clear';
      pressed: boolean;
      key: string;
      raw: number[];
      timestamp: number;
    }
  | {
      kind: 'knob';
      deck: Deck;
      control: string;
      key: string;
      value: number; // 0..1
      raw: number[];
      timestamp: number;
    }
  | {
      kind: 'fader';
      deck: Deck;
      control: string;
      key: string;
      value: number; // 0..1, ricomposto da MSB+LSB (o solo MSB se l'LSB non è ancora arrivato)
      raw: number[];
      timestamp: number;
    }
  | {
      kind: 'jog';
      deck: Deck;
      control: string;
      key: string;
      delta: number; // positivo = orario, negativo = antiorario
      raw: number[];
      timestamp: number;
    }
  | {
      kind: 'unknown';
      raw: number[];
      timestamp: number;
    };

/**
 * Decoder con stato: serve per ricomporre i controlli a 14 bit (crossfader,
 * volume, tempo) che il DDJ-200 invia come due Control Change separati
 * (MSB e LSB) sullo stesso "key" logico.
 */
export class DDJ200Decoder {
  private msbCache = new Map<string, number>();

  decode(data: Uint8Array | number[], timestamp = performance.now()): DDJ200Event {
    const raw = Array.from(data);
    const [status, data1 = 0, data2 = 0] = raw;
    const messageType = status & 0xf0;

    // --- Note On / Note Off: pulsanti e hotcue ---
    if (messageType === 0x90 || messageType === 0x80) {
      const def = lookupNote(status, data1);
      const pressed = messageType === 0x90 && data2 > 0;
      if (def?.kind === 'hotcue') {
        const isClear = def.name.endsWith('_clear');
        const padMatch = def.name.match(/hotcue_(\d)/);
        const pad = padMatch ? Number(padMatch[1]) : 0;
        return {
          kind: 'hotcue',
          deck: def.deck,
          pad,
          action: isClear ? 'clear' : 'activate',
          pressed,
          key: def.key,
          raw,
          timestamp,
        };
      }
      if (def?.kind === 'button') {
        return {
          kind: 'button',
          deck: def.deck,
          control: def.name,
          key: def.key,
          pressed,
          raw,
          timestamp,
        };
      }
      return { kind: 'unknown', raw, timestamp };
    }

    // --- Control Change: knob, fader 14-bit, jog ---
    if (messageType === 0xb0) {
      const def = lookupCC(status, data1);
      if (!def) return { kind: 'unknown', raw, timestamp };

      if (def.kind === 'knob') {
        return {
          kind: 'knob',
          deck: def.deck,
          control: def.name,
          key: def.key,
          value: data2 / 127,
          raw,
          timestamp,
        };
      }

      if (def.kind === 'jog') {
        const delta = data2 - JOG_CENTER;
        return {
          kind: 'jog',
          deck: def.deck,
          control: def.name,
          key: def.key,
          delta,
          raw,
          timestamp,
        };
      }

      if (def.kind === 'fader14') {
        if (def.part === 'msb') {
          this.msbCache.set(def.key, data2);
          const value = data2 / 127; // valore provvisorio finché non arriva l'LSB
          return { kind: 'fader', deck: def.deck, control: def.name, key: def.key, value, raw, timestamp };
        }
        // LSB: combina con l'ultimo MSB noto per quel controllo
        const msb = this.msbCache.get(def.key) ?? 0;
        const combined = (msb << 7) | data2;
        const value = combined / 16383;
        return { kind: 'fader', deck: def.deck, control: def.name, key: def.key, value, raw, timestamp };
      }
    }

    return { kind: 'unknown', raw, timestamp };
  }
}

export function describeEvent(e: DDJ200Event): string {
  switch (e.kind) {
    case 'button':
      return `${e.deck === 'master' ? 'Master' : `Deck ${e.deck}`} · ${e.control} ${e.pressed ? 'premuto' : 'rilasciato'}`;
    case 'hotcue':
      return `Deck ${e.deck} · Hotcue ${e.pad} ${e.action === 'activate' ? 'attiva' : 'cancella'} ${e.pressed ? '(premuto)' : '(rilasciato)'}`;
    case 'knob':
      return `${e.deck === 'master' ? 'Master' : `Deck ${e.deck}`} · ${e.control} = ${(e.value * 100).toFixed(0)}%`;
    case 'fader':
      return `${e.deck === 'master' ? 'Master' : `Deck ${e.deck}`} · ${e.control} = ${(e.value * 100).toFixed(1)}%`;
    case 'jog':
      return `Deck ${e.deck} · ${e.control} delta=${e.delta}`;
    case 'unknown':
      return `Messaggio non mappato: [${e.raw.map((b) => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`;
  }
}
