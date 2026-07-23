/**
 * Pioneer DDJ-200 — mappa MIDI
 * ----------------------------
 * Ricavata dal documento ufficiale Pioneer "DDJ-200 List of MIDI messages"
 * e dalla mappatura open-source per Mixxx (dan-giddins/mixxx-ddj-200-mapping).
 *
 * Struttura di un messaggio MIDI a 3 byte: [status, data1, data2]
 *  - nibble alto di `status`  -> tipo messaggio (0x8 Note Off, 0x9 Note On, 0xB Control Change)
 *  - nibble basso di `status` -> canale MIDI (0-15)
 *
 * Canali usati dal DDJ-200:
 *   0  (0x_0) -> Deck 1 (pulsanti, EQ, volume, tempo, jog)
 *   1  (0x_1) -> Deck 2
 *   6  (0x_6) -> Sezione mixer/master (crossfader, filtro/color FX, AutoDJ...)
 *   7  (0x_7) -> Deck 1, hot cue: attivazione pad
 *   8  (0x_8) -> Deck 1, hot cue: cancellazione pad (SHIFT + pad)
 *   9  (0x_9) -> Deck 2, hot cue: attivazione pad
 *   10 (0x_A) -> Deck 2, hot cue: cancellazione pad (SHIFT + pad)
 *
 * NOTE IMPORTANTI:
 *  - Jog wheel (rotazione, "jog"/"scratch") e SEEK (SHIFT+jog) sono encoder
 *    RELATIVI: il controller non manda una posizione assoluta ma un valore
 *    centrato (qui assunto 64) la cui distanza dal centro indica verso e
 *    velocità di rotazione. Il valore esatto di centratura non è documentato
 *    ufficialmente per questo modello: se nella UI vedi che il "verso" risulta
 *    invertito o poco sensibile, calibra la costante JOG_CENTER più sotto.
 *  - Crossfader, Volume e Tempo sono inviati come coppia MSB/LSB (14 bit) per
 *    maggiore risoluzione: il valore va ricomposto (vedi decodeDDJ200.ts).
 */

export type Deck = 1 | 2 | 'master';

export const JOG_CENTER = 64; // valore assunto di "zero" per gli encoder relativi

export type ControlKind = 'button' | 'hotcue' | 'knob' | 'fader14' | 'jog';

export interface ControlDef {
  kind: ControlKind;
  deck: Deck;
  name: string; // etichetta leggibile
  key: string; // chiave stabile univoca, usata per raggruppare MSB/LSB e per lo stato "values"
  /** per i controlli 14 bit: indica se questo midino è la parte MSB o LSB */
  part?: 'msb' | 'lsb';
}

/** status byte -> canale */
export const STATUS = {
  NOTE_ON_CH0: 0x90,
  NOTE_ON_CH1: 0x91,
  NOTE_ON_CH6: 0x96,
  NOTE_ON_CH7: 0x97,
  NOTE_ON_CH8: 0x98,
  NOTE_ON_CH9: 0x99,
  NOTE_ON_CH10: 0x9a,
  CC_CH0: 0xb0,
  CC_CH1: 0xb1,
  CC_CH6: 0xb6,
} as const;

function key(deck: Deck, name: string) {
  return `${deck}.${name}`;
}

/** Pulsanti (Note On) sui canali Deck 1 / Deck 2 (0x90 / 0x91) */
const DECK_BUTTONS: Record<number, string> = {
  0x0b: 'play',
  0x0c: 'cue',
  0x48: 'cue_goto_and_stop', // SHIFT + CUE
  0x58: 'sync',
  0x3f: 'shift',
  0x54: 'headphone_cue', // PFL
  0x68: 'toggle_deck', // SHIFT + PFL
  0x60: 'bpm_tap',
  0x47: 'cue_set',
  0x36: 'jog_touch',
};

/** Pulsanti (Note On) sul canale Master (0x96) */
const MASTER_BUTTONS: Record<number, string> = {
  0x63: 'headmix',
  0x78: 'toggle_four_deck_mode', // SHIFT + headmix
  0x59: 'autodj_enable',
  0x5a: 'autodj_fade_now',
};

/** Control Change su Deck 1 / Deck 2 (0xB0 / 0xB1) */
const DECK_CC: Record<number, Omit<ControlDef, 'deck'>> = {
  0x0f: { kind: 'knob', name: 'eq_low', key: 'eq_low' },
  0x0b: { kind: 'knob', name: 'eq_mid', key: 'eq_mid' },
  0x07: { kind: 'knob', name: 'eq_high', key: 'eq_high' },
  0x13: { kind: 'fader14', name: 'volume', key: 'volume', part: 'msb' },
  0x33: { kind: 'fader14', name: 'volume', key: 'volume', part: 'lsb' },
  0x00: { kind: 'fader14', name: 'tempo', key: 'tempo', part: 'msb' },
  0x20: { kind: 'fader14', name: 'tempo', key: 'tempo', part: 'lsb' },
  0x21: { kind: 'jog', name: 'jog_rotation', key: 'jog_rotation' },
  0x22: { kind: 'jog', name: 'scratch', key: 'scratch' },
  0x29: { kind: 'jog', name: 'seek', key: 'seek' }, // SHIFT + jog
};

/** Control Change sul canale Master (0xB6) */
const MASTER_CC: Record<number, Omit<ControlDef, 'deck'>> = {
  0x1f: { kind: 'fader14', name: 'crossfader', key: 'crossfader', part: 'msb' },
  0x3f: { kind: 'fader14', name: 'crossfader', key: 'crossfader', part: 'lsb' },
  0x17: { kind: 'knob', name: 'filter_deck1', key: 'filter_deck1' },
  0x18: { kind: 'knob', name: 'filter_deck2', key: 'filter_deck2' },
};

export function lookupNote(status: number, data1: number): ControlDef | null {
  if (status === STATUS.NOTE_ON_CH0 && DECK_BUTTONS[data1]) {
    return { kind: 'button', deck: 1, name: DECK_BUTTONS[data1], key: key(1, DECK_BUTTONS[data1]) };
  }
  if (status === STATUS.NOTE_ON_CH1 && DECK_BUTTONS[data1]) {
    return { kind: 'button', deck: 2, name: DECK_BUTTONS[data1], key: key(2, DECK_BUTTONS[data1]) };
  }
  if (status === STATUS.NOTE_ON_CH6 && MASTER_BUTTONS[data1]) {
    return { kind: 'button', deck: 'master', name: MASTER_BUTTONS[data1], key: key('master', MASTER_BUTTONS[data1]) };
  }
  if (status === STATUS.NOTE_ON_CH7 && data1 <= 0x07) {
    return { kind: 'hotcue', deck: 1, name: `hotcue_${data1 + 1}_activate`, key: key(1, `hotcue_${data1 + 1}`) };
  }
  if (status === STATUS.NOTE_ON_CH8 && data1 <= 0x07) {
    return { kind: 'hotcue', deck: 1, name: `hotcue_${data1 + 1}_clear`, key: key(1, `hotcue_${data1 + 1}`) };
  }
  if (status === STATUS.NOTE_ON_CH9 && data1 <= 0x07) {
    return { kind: 'hotcue', deck: 2, name: `hotcue_${data1 + 1}_activate`, key: key(2, `hotcue_${data1 + 1}`) };
  }
  if (status === STATUS.NOTE_ON_CH10 && data1 <= 0x07) {
    return { kind: 'hotcue', deck: 2, name: `hotcue_${data1 + 1}_clear`, key: key(2, `hotcue_${data1 + 1}`) };
  }
  return null;
}

export function lookupCC(status: number, data1: number): ControlDef | null {
  if (status === STATUS.CC_CH0 && DECK_CC[data1]) {
    const d = DECK_CC[data1];
    return { ...d, deck: 1, key: key(1, d.key) };
  }
  if (status === STATUS.CC_CH1 && DECK_CC[data1]) {
    const d = DECK_CC[data1];
    return { ...d, deck: 2, key: key(2, d.key) };
  }
  if (status === STATUS.CC_CH6 && MASTER_CC[data1]) {
    const d = MASTER_CC[data1];
    return { ...d, deck: 'master', key: key('master', d.key) };
  }
  return null;
}
