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



## Performance pad (hot cue vere)

Gli 8 pad per deck ora salvano davvero un punto nel brano: primo click su un
pad spento = salva la posizione attuale; click su un pad già acceso = salta
subito lì e riparte la riproduzione. Caricare un nuovo brano sul deck
azzera tutti i suoi pad. Da controller fisico, SHIFT+pad cancella un singolo
hot cue.

## Registrazione del mix

Il pannello "Registrazione" cattura tutto quello che esce dal Master (il mix
finale, crossfader incluso) tramite `MediaRecorder` e produce un file webm
scaricabile a fine registrazione. Puoi registrare più take nella stessa
sessione (restano elencati con un link di download finché non ricarichi la
pagina). Implementato in `src/audio/recorder.ts` (classe `MixRecorder`).

## Pulsante Info

L'icona ⓘ accanto al titolo apre una guida in-app (`src/components/InfoDialog.tsx`)
che spiega mixaggio, performance pad, automix, preview in cuffia,
registrazione, code per deck e i limiti noti su YouTube — utile come
riferimento rapido per chi usa il programma senza aver letto questo README.



## Beat Sync e "tempo generale"

Il numero BPM mostrato sopra ogni deck è ora il **BPM effettivo** (BPM
rilevato del brano × velocità di riproduzione attuale), non più il valore
statico: è il "tempo generale" impostato in quel momento su quel deck.

Il pulsante rotondo **BEAT SYNC** sotto il jog è ora funzionante: regola la
velocità del deck su cui lo premi per farla combaciare con il BPM effettivo
dell'altro deck (stessa formula usata dall'Automix per il beatmatching
automatico). Richiede che il BPM di **entrambi** i brani sia stato rilevato:
funziona quindi solo tra file locali — su YouTube il pulsante resta
disattivato (più sbiadito) perché il BPM non è calcolabile (vedi sopra).

## Salto preciso nel brano

Oltre a cliccare sulla barra di avanzamento, sotto il titolo di ogni deck c'è
un campo **"VAI A mm:ss"**: scrivi un istante (es. `1:30`) e premi "SALTA" (o
Invio) per portarti lì subito, utile per mixare da un punto preciso senza
dover ascoltare tutto il brano dall'inizio.

## Coda per deck: visibile e modificabile

La coda di ogni deck ora è visibile per intero sotto il titolo, non solo un
contatore: puoi **trascinare** un brano (icona ⠿, mouse) per riordinarlo, o
usare le frecce **▲▼** (funzionano anche da touch/mobile, dove il drag&drop
nativo HTML non è affidabile), oltre a **×** per rimuoverlo e **SKIP ▶** per
passare subito al prossimo.

## Pad FX

Nuovo pannello "Pad FX" con effetti classici da DJ set **generati al momento
con Web Audio** (oscillatori/rumore sintetizzati in `src/audio/fxPads.ts`,
nessun campione audio esterno — zero problemi di copyright):

- **SIRENA** — oscillatore che sale/scende ciclicamente
- **AEREO** — rumore + oscillatore che salgono di tono insieme con taglio
  secco finale (il classico riser da drop)
- **AIR HORN** — tre onde sovrapposte, come l'accordo di un corno da stadio
- **NOISE SWEEP** — rumore filtrato che cresce e si ferma di colpo
- **ECHO** — non è un pad "usa e getta" ma un interruttore: attiva/disattiva
  un delay/feedback vero sul master, per il classico "buttare in eco" prima
  di una transizione

Tutti mandati sul bus master, quindi li senti anche in registrazione e sul
Master Cue.

## Ordinamento della libreria per BPM

Nella Libreria, tab "File locali", ogni brano caricato viene analizzato in
background (vedi `bpmDetect.ts`) e mostra il suo BPM stimato sotto il nome.
Con almeno due file caricati compare il pulsante **"Ordina per BPM"**, che
alterna tra nessun ordine, crescente e decrescente — utile per costruire una
scaletta che sale (o scende) di energia. Riguarda solo i file locali: per
YouTube il BPM non è calcolabile (stesso limite di EQ e Beat Sync).



## Inizio/fine personalizzati e fade in/out per brano

Nella Libreria, ogni brano (locale o YouTube) ha un pulsante **✂️** che apre un
editor inline:

- **Inizio (mm:ss)**: quando mandi quel brano su un deck, parte già da lì
  invece che dall'inizio del file (anche CUE torna a questo punto, non a 0).
- **Fine (mm:ss)**: quando la riproduzione arriva lì, il deck si comporta
  come se il brano fosse finito naturalmente — si ferma e, se c'è qualcosa in
  coda, parte da solo il prossimo (stessa logica dell'automix/coda).
- **Fade in / Fade out** (checkbox) + **durata fade** in secondi: dissolvenza
  in ingresso dal punto di inizio e/o in uscita verso il punto di fine.

Le impostazioni sono legate al brano (nome+dimensione per i file locali, ID
video per YouTube), quindi restano valide se lo ricarichi più volte o lo
rimetti in coda; si resettano ricaricando la pagina. Implementato in
`src/audio/deck.ts` (metodo `applyTrim`, gestito con un piccolo timer interno
che controlla ogni 100ms se sei nella finestra di fade o hai superato il
punto di fine).



## Libreria persistente (sopravvive al refresh)

Fino ad ora ricaricare la pagina svuotava tutto. Ora:

- **File locali**: vengono salvati nell'IndexedDB del browser (il database
  interno, adatto a file grandi — a differenza di localStorage) tramite
  `src/utils/localLibraryDB.ts`. Al riavvio dell'app la libreria si ricarica
  da sola, BPM incluso (ricalcolato in background). Ogni brano ha ora anche
  una **×** per rimuoverlo definitivamente dalla libreria salvata.
- **Risultati/playlist YouTube**: gli ultimi risultati mostrati restano in
  `localStorage` e si ricaricano all'apertura della pagina.
- **Inizio/fine/fade per brano**: le impostazioni di taglio (vedi sopra)
  sono anch'esse salvate in `localStorage`, legate alla stessa chiave
  stabile del brano.

Tutto è locale al tuo browser: non c'è nessun server esterno coinvolto.
Se cambi browser o svuoti i dati del sito, la libreria salvata si perde.



## Stato iniziale dei controlli alla connessione

Il DDJ-200 non annuncia da solo la posizione di knob/fader/pulsanti quando ti
connetti (limite comune a molti controller MIDI: normalmente inviano un
messaggio solo quando muovi qualcosa, non "su richiesta"). Esiste però un
comando **SysEx non documentato ufficialmente da Pioneer**, individuato dal
progetto Mixxx facendo reverse engineering del traffico USB tra rekordbox e
il DDJ-200, che dice al controller "rimandami lo stato di ogni controllo":
`[0xF0, 0x00, 0x20, 0x7F, 0x03, 0x01, 0xF7]`.

L'app ora lo invia automaticamente non appena il DDJ-200 si connette (vedi
`requestControllerStateDump` in `src/midi/useDDJ200.ts`), quindi conosce quasi
subito i valori con cui è iniziata la sessione, invece di aspettare che tu
muova ogni singolo controllo per la prima volta. Non essendo documentato
ufficialmente potrebbe non funzionare su ogni unità/firmware: se il
comando viene rifiutato dal driver, l'app continua comunque a funzionare
normalmente (i valori si sincronizzano al primo tocco, come prima).



## Più stili di Transition FX

L'Automix non fa più solo un crossfade classico: dal menu accanto al
pulsante AUTOMIX puoi scegliere lo stile di transizione:

- **Crossfade classico** — il passaggio graduale di sempre (12s, curva a
  potenza costante)
- **Filter sweep** — il deck in uscita viene progressivamente "filtrato via"
  (low-pass crescente) mentre sfuma
- **Echo out** — attiva l'eco sul master per tutta la durata della
  transizione, poi la spegne
- **Cut secco** — passaggio molto più rapido (2s), per generi che richiedono
  tagli netti invece di lunghe sovrapposizioni

Implementato in `src/audio/useAutoMix.ts`.

## Tutorial interattivo

L'icona 🎓 accanto al titolo apre un tutorial passo-passo
(`src/components/TutorialOverlay.tsx`): 12 lezioni che spiegano cosa fa ogni
controllo, con uno **spotlight** che evidenzia esattamente il pulsante/knob/
fader di cui si sta parlando (il resto dello schermo si scurisce). Puoi
andare avanti/indietro liberamente o chiudere il tutorial in qualsiasi
momento. Copre: connessione controller, caricare un brano, play/cue, volume,
EQ, filtro, crossfader, hot cue, beat sync, automix/transition FX,
registrazione.



## Correzioni: valori iniziali e cuffia bloccata

- **EQ, tempo e volume ora partono da una posizione neutra sensata** (0.5 =
  centro per EQ/tempo, pieno per il volume) invece che da 0 — prima, finché
  un controllo non veniva toccato almeno una volta (fisicamente o via SysEx),
  la UI mostrava 0, che per EQ/tempo significa un estremo (taglio totale /
  pitch al minimo), non una posizione neutra.
- **Cuffia (headphone cue) che restava sempre accesa**: il pulsante fisico
  riporta lo stato reale (premuto/rilasciato), non un semplice "click" — il
  codice lo trattava come un interruttore da alternare a ogni pressione, e
  due letture ravvicinate potevano lasciarlo "incastrato" acceso. Ora lo
  stato segue direttamente quello riportato dal controller. Il click da
  mouse continua ad alternare normalmente (non ha un concetto di
  "rilascio").
- **Play/Cue che non si illuminavano dal controller fisico**: se il
  controller manda pressione+rilascio in pochi millisecondi, il lampo può
  essere troppo veloce per vederlo. Ora c'è un lampo garantito di almeno
  180ms ogni volta che arriva una pressione reale da MIDI.



## Comportamento reale dei LED (corretto secondo la documentazione hardware)

Grazie a un riferimento preciso sul funzionamento del DDJ-200, ho corretto
diversi comportamenti che prima erano solo un'approssimazione:

- **CUE**: ora è un vero cue point, non un lampo momentaneo. Da fermo, il
  primo CUE lo imposta al punto attuale; i successivi ci saltano. In
  riproduzione, CUE torna al cue point e mette in pausa. Il LED resta acceso
  finché un cue point è memorizzato (si azzera solo caricando un nuovo
  brano). **SHIFT + CUE** torna invece sempre all'inizio della traccia
  (0:00), ignorando il cue point.
- **BEAT SYNC** è ora un interruttore persistente (acceso = sync attivo,
  spento = disattivato), non più legato alla semplice pressione. **SHIFT +
  BEAT SYNC** cambia il range del pitch (±6% → ±10% → ±16% → Wide, ciclico),
  mostrato sotto il pulsante TEMPO RANGE — anche lui ora cliccabile da mouse.
- **Cuffia (headphone cue)**: il toggle ora scatta solo sul fronte di salita
  della pressione (il momento esatto in cui il tasto viene premuto),
  ignorando eventuali messaggi ripetuti mentre resta fisicamente giù — questo
  evita che possa restare "incastrato" acceso per doppio conteggio.
- **Play**: resta legato allo stato reale di riproduzione, con in più un
  lampo minimo garantito (180ms) per pressioni fisiche molto rapide.
- **EQ, tempo e volume** partono da una posizione neutra sensata (0.5 =
  centro, volume pieno) invece che da 0, finché il valore reale non viene
  letto dal controller.

## Fader tempo invertito

Il fader tempo verticale ora ha il **"-" in alto e il "+" in basso**
(prima era il contrario).

## Crossfader ricostruito da zero

Il crossfader non usa più un `<input type="range">`: è un componente
completamente nuovo basato su eventi pointer con **pointer capture**
(`CrossfaderTrack` in `MasterPanel.tsx`), che calcola il valore direttamente
dalla posizione X del puntatore sulla traccia. Elimina qualunque dipendenza
da comportamenti nativi del browser o da re-render di componenti esterni:
il trascinamento segue il cursore in modo continuo e lineare.



## Cue Point Sampler

Tenendo premuto CUE (da fermo, con un cue point già impostato), il brano
suona in anteprima finché tieni premuto; al rilascio torna al cue point e si
ferma. Se nel frattempo premi PLAY, l'anteprima "si consolida" in
riproduzione vera e il rilascio di CUE non la interrompe più. Da mouse:
premi e tieni il pulsante CUE (non un semplice click).

## Beat Loop sui pad

I Performance Pad ora hanno due modalità, selezionabili con l'etichetta
HOT CUE / BEAT LOOP sopra la griglia: in modalità Beat Loop, gli 8 pad
diventano lunghezze fisse (1/16, 1/8, 1/4, 1/2, 1, 2, 4, 8 battute) calcolate
dal BPM rilevato (solo file locali). Premere un pad avvia un loop di quella
lunghezza dalla posizione attuale; premere di nuovo un pad mentre un loop è
attivo lo disattiva. Il pad si illumina finché il loop è attivo.

## Transition FX guidato dal crossfader

Oltre all'AUTOMIX (automatico a timer), ora c'è un secondo controllo
separato, **TRANSITION FX**, più fedele al comportamento hardware reale: lo
"armi" con un click, poi sei tu a trascinare il crossfader — lo stile scelto
(filter sweep o echo out) si applica in proporzione a quanto ti allontani dal
punto in cui hai armato, sul deck da cui ti stai allontanando. Disarmando si
azzerano eventuali FX rimasti a metà.

## Pulsante Test luci

L'icona 🧪 accanto a Info e Tutorial accende, uno alla volta, ogni indicatore
dell'interfaccia (Play/Cue/Sync/Cuffia/8 pad per deck, Master Cue, Automix,
Transition FX) per verificare che si illumini correttamente — indipendente
da MIDI o audio reale, utile per isolare se un problema è nella UI o nella
mappatura del controller fisico.



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
