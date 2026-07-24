# DDJ-200 MIDI Bridge

App React + Vite + TypeScript + MUI che si collega al **Pioneer DDJ-200** via
**Web MIDI API**, decodifica ogni messaggio MIDI ricevuto (pulsanti, hotcue,
knob EQ, fader volume/tempo/crossfader, jog wheel) in eventi semantici
tipizzati, e li mostra live in una dashboard. E' pensata come base di partenza:
il tuo programma si aggancia con `ddj.onEvent(callback)` e riceve ogni comando
gia interpretato, pronto da applicare alla tua logica.

## Avvio

```bash
npm install
npm run dev
```

Apri l'URL mostrato (es. http://localhost:5173) **con Chrome, Edge o Opera**
(la Web MIDI API richiede uno di questi browser su desktop). Collega il
DDJ-200 via USB, premi "Connetti controller" e concedi il permesso MIDI.

## Come funziona / dove guardare

- `src/midi/ddj200Map.ts` - tabella di lookup status/data -> controllo, ricavata
  dal documento ufficiale Pioneer ("DDJ-200 List of MIDI messages") e dalla
  mappatura community per Mixxx.
- `src/midi/decodeDDJ200.ts` - `DDJ200Decoder`, la classe che trasforma i byte
  grezzi in eventi tipizzati (`button`, `hotcue`, `knob`, `fader`, `jog`),
  incluso il ricompattamento dei controlli a 14 bit (crossfader, volume,
  tempo) inviati come coppia MSB/LSB.
- `src/midi/useDDJ200.ts` - hook React: gestisce permesso/porta MIDI, mantiene
  lo stato corrente di tutti i controlli e espone `onEvent(callback)` per
  agganciare la tua logica.
- `src/App.tsx` + `src/components/` - dashboard di esempio (solo per
  visualizzare/debuggare quello che arriva dal controller).

## Integrare il tuo programma

```ts
const ddj = useDDJ200();

useEffect(() => {
  return ddj.onEvent((event) => {
    if (event.kind === 'fader' && event.control === 'volume') {
      // event.deck -> 1 | 2 | 'master'
      // event.value -> 0..1
      miaFunzioneMixaggio(event.deck, event.value);
    }
    if (event.kind === 'button' && event.control === 'play' && event.pressed) {
      miaFunzionePlay(event.deck);
    }
  });
}, [ddj]);
```

## Cose da sapere / da calibrare

- **Jog wheel e scratch** sono encoder *relativi*: il controller manda un
  valore centrato (qui assunto `64`, costante `JOG_CENTER` in `ddj200Map.ts`)
  e la distanza dal centro indica verso e velocita. Questo valore non e
  documentato ufficialmente per il DDJ-200: se il verso ti sembra invertito o
  poco sensibile, ricalibra la costante osservando i valori grezzi nel log.
- I controlli a 14 bit (crossfader, volume, tempo) mandano prima l'MSB e poi
  l'LSB: il valore mostrato si aggiorna (in modo approssimato) gia al primo
  messaggio e si affina quando arriva il secondo.
- Se il tuo DDJ-200 e collegato ma non appare nulla, controlla che nessun'altra
  app (Rekordbox, Serato, WeDJ...) stia gia tenendo aperta la porta MIDI in
  esclusiva.

## Riproduzione audio (file locali + YouTube)

L'app ora include anche un motore audio vero (`src/audio/`) collegato ai
comandi del mixer:

- **File locali**: dal pannello "Libreria" -> tab "File locali", scegli uno o
  più file audio dal computer e mandali su Deck 1 o Deck 2. Passano per un
  vero grafico Web Audio, quindi **EQ, volume, tempo e jog funzionano
  davvero** sull'audio.
- **YouTube**: tab "YouTube". Serve una tua **API key di YouTube Data API
  v3** (creala su Google Cloud Console, abilita "YouTube Data API v3",
  genera una API key) - resta salvata solo nel tuo browser (`localStorage`).
  Cerca un brano, mandalo su un deck: viene riprodotto tramite il player
  ufficiale YouTube (nessun download). Limiti noti:
  - **niente EQ** (YouTube non espone i dati audio grezzi al browser, quindi
    i knob LOW/MID/HIGH non hanno effetto sulle tracce YouTube);
  - il **tempo** viene approssimato ai pochi valori discreti che l'API
    permette (0.25/0.5/0.75/1/1.25/1.5/1.75/2x), non è continuo come sui file
    locali;
  - volume e crossfader funzionano normalmente.
  - Nota d'uso: stai incorporando video con il player ufficiale di YouTube,
    non scaricando né ridistribuendo l'audio. Se il progetto è per un uso
    pubblico (es. eventi con pubblico pagante), verifica comunque i termini
    di servizio di YouTube per la tua situazione specifica.

Il volume/EQ/tempo/crossfader del mixer sono già collegati ai deck tramite
`useAudioEngine` (vedi `src/audio/useAudioEngine.ts`): non serve altro
codice per farli funzionare, sia con file locali che con YouTube.



| Controllo | Canale/Status | Note/CC |
|---|---|---|
| Play (Deck 1/2) | Note On ch0/ch1 | 0x0B |
| Cue (Deck 1/2) | Note On ch0/ch1 | 0x0C |
| Sync (Deck 1/2) | Note On ch0/ch1 | 0x58 |
| Shift (Deck 1/2) | Note On ch0/ch1 | 0x3F |
| Headphone cue / PFL | Note On ch0/ch1 | 0x54 |
| Hotcue 1-8 attiva (Deck1/2) | Note On ch7/ch9 | 0x00-0x07 |
| Hotcue 1-8 cancella (Deck1/2) | Note On ch8/ch10 | 0x00-0x07 |
| EQ Low/Mid/High (Deck 1/2) | CC ch0/ch1 | 0x0F / 0x0B / 0x07 |
| Volume fader (Deck 1/2) | CC ch0/ch1 | MSB 0x13, LSB 0x33 |
| Tempo fader (Deck 1/2) | CC ch0/ch1 | MSB 0x00, LSB 0x20 |
| Jog rotation (Deck 1/2) | CC ch0/ch1 | 0x21 |
| Scratch / top plate (Deck 1/2) | CC ch0/ch1 | 0x22 |
| Seek (Shift+jog) (Deck 1/2) | CC ch0/ch1 | 0x29 |
| Crossfader | CC ch6 | MSB 0x1F, LSB 0x3F |
| Filtro/Color FX Deck1/2 | CC ch6 | 0x17 / 0x18 |
| AutoDJ on/off | Note On ch6 | 0x59 |

Dettaglio completo nei commenti di `src/midi/ddj200Map.ts`.
