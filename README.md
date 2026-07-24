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

## Playlist

- **Locali**: nel tab "File locali" puoi scegliere singoli file oppure un'intera
  **cartella** (pulsante "Carica cartella (playlist)") da usare come playlist.
- **YouTube**: nel tab "YouTube", oltre alla ricerca, c'è un campo per incollare
  un **link o ID di playlist** (es. `youtube.com/playlist?list=PL...`): carica
  tutti i video della playlist nella stessa lista, pronti da mandare su D1/D2.

## Automix

Il pulsante **AUTOMIX** in Master attiva/disattiva il mix automatico:

- quando il brano che sta suonando è vicino alla fine (ultimi ~16 secondi di
  default), se l'altro deck ha una traccia caricata e ferma, parte da solo e
  il crossfader si sposta gradualmente verso di lui in ~12 secondi;
- se il **BPM** di entrambe le tracce è noto (solo per file locali, vedi
  sotto), il brano in entrata viene sincronizzato di tono/velocità sul BPM di
  quello in uscita (beatmatching automatico), regolando il playback rate.
- I tempi (secondi prima della fine, durata del mix) sono costanti in
  `src/audio/useAutoMix.ts` (`TRIGGER_SECONDS_BEFORE_END`, `TRANSITION_SECONDS`):
  modificali lì se vuoi transizioni più lunghe/brevi.

**Stima del BPM**: `src/audio/bpmDetect.ts` analizza offline il file audio
locale (isola le basse frequenze, cerca i picchi di energia con soglia
adattiva) e stima il BPM. È una stima euristica pensata per musica a beat
regolare, non un vero beat-tracking: su alcuni brani può risultare impreciso o
non disponibile (mostrato come "-- BPM"). Per YouTube il BPM non è calcolabile
(nessun accesso all'audio grezzo), quindi l'automix farà comunque il crossfade
ma senza beatmatching del pitch tra una traccia locale e una YouTube (o tra
due YouTube).

## Display "dot matrix"

I valori numerici (tempo trascorso/durata, BPM, percentuali di volume/tempo/
crossfader/filtri) sono renderizzati con `src/components/DotDisplay.tsx`: uno
sfondo puntinato scuro + testo monospace con un lieve bagliore, in stile
vecchio display LED dei mixer/lettori CD. Per applicarlo altrove basta
avvolgere un valore in `<DotDisplay color={...}>...</DotDisplay>`.

## Layout fedele all'hardware e responsive

L'interfaccia ora rispecchia i controlli reali del DDJ-200:

- **Filtro/CFX** per deck (knob dedicato, sopra l'EQ): sweep low-pass/high-pass
  vero sui file locali (al centro è trasparente, a sinistra taglia gli alti
  progressivamente, a destra taglia i bassi). Su YouTube è solo visuale, stesso
  limite dell'EQ.
- **Play/Cue** come pulsanti rotondi (icona play/pausa), **Beat Sync** e
  **Tempo Range** come pulsanti tondi sotto il jog (Tempo Range è solo
  visuale: non c'è ancora un range del fader tempo selezionabile).
  Il pulsante headphone-cue resta visuale: il browser non permette di
  instradare l'audio su un'uscita cuffie separata senza API/hardware dedicati
  (stesso discorso per **MASTER CUE** in Master).
- **Tempo** come fader verticale con lettura ±% in stile dot-display, come sul
  mixer reale (prima era un semplice slider orizzontale).
- **Performance Pads** etichettati esplicitamente, 2x4 come sull'hardware.
- **Crossfader** con tacche 0-10 come sul mixer reale.
- **TRANSITION FX**: sul controller reale applica un effetto automatico
  durante il passaggio tra i deck. Qui il pulsante "ON/OFF" riusa la stessa
  idea per attivare/disattivare l'**Automix** (vedi sopra): è una scelta di
  design, non una riproduzione 1:1 della funzione hardware (che richiederebbe
  effetti audio dedicati non ancora implementati).

Il layout è **responsive**: su schermi larghi i due deck affiancano il mixer
al centro (come la console fisica); su mobile/tablet tutto si impila in
verticale (Deck 1, Mixer, Deck 2) a piena larghezza, pensato per essere usato
anche da telefono.


## Coda per deck

Ogni deck può avere più brani in fila, non solo uno:

- Dalla Libreria, "→ D1" / "→ D2" **carica subito** se quel deck è libero
  (nessuna traccia caricata), altrimenti **accoda** il brano.
- Quando la traccia in riproduzione finisce da sola, il deck passa
  automaticamente al brano successivo in coda (se c'è).
- Il pulsante **SKIP ▶** (visibile solo quando la coda non è vuota) salta
  subito al prossimo, senza aspettare la fine del brano attuale.
- Locali e YouTube possono stare nella stessa coda, mischiati liberamente.

## Preview in cuffia (PFL)

Il pulsante cuffia 🎧 su ciascun deck e **MASTER CUE** in Master ora fanno
qualcosa di vero: mandano quel segnale su un **bus cuffie separato**,
instradabile su un dispositivo audio diverso da quello del master (es. le tue
cuffie collegate via USB/jack, mentre il pubblico continua a sentire gli
altoparlanti).

- In Master, sezione "🎧 Preview in cuffia": premi **"Trova dispositivi"** (il
  browser chiederà un permesso — serve solo per leggere i nomi dei dispositivi
  di uscita, non registra nulla) e scegli l'uscita per il preview dal menu a
  tendina.
- Attiva la cuffia 🎧 su un deck per sentire quel brano in anteprima (segnale
  pre-fader: dopo EQ/filtro, prima di volume e crossfader — come il PFL di un
  mixer vero). **MASTER CUE** manda invece il mix finale (post-crossfader).
- **Limiti onesti**:
  - Funziona solo per i **file locali**: l'audio di YouTube non passa dal
    grafico Web Audio (stesso motivo per cui EQ e filtro non hanno effetto su
    YouTube), quindi non può essere "spillato" su un'altra uscita.
  - La scelta del dispositivo di uscita (`setSinkId`) è supportata da
    **Chrome/Edge/Opera**. Su Safari e Firefox il preview suona comunque, ma
    sulla stessa uscita del master: non è possibile scegliere un dispositivo
    diverso da browser.
  - Se hai delle vere cuffie DJ con un solo ingresso audio dal PC (non due
    ingressi separati), l'unico modo per sentire davvero "cuffia vs master"
    su due uscite fisiche diverse è avere due dispositivi audio distinti
    (es. altoparlanti + cuffie USB collegate insieme).



## Mappa MIDI (riassunto)

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
