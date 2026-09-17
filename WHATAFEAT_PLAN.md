# Whatafeat — Piano funzionale, tecnico e grafico

Versione 1.0 · 17 settembre 2026

Documento operativo per Codex. Consolida il piano del prodotto e la direzione visiva ispirata a [untitled]. Le indicazioni grafiche qui riportate sostituiscono integralmente le precedenti proposte con verde acido, glitch, texture da flyer e titoli condensati oversize.

## 1. Obiettivo e identità

Whatafeat è una web app per artisti underground che vogliono scoprire collaboratori, acquistare feat, scambiare contributi e trovare una voce per un brano incompleto.

Target iniziale: artisti indipendenti rap, trap, rage, pluggnb e alternative R&B. L'interfaccia è interamente in inglese; il presente documento è in italiano. I contenuti degli utenti possono essere in qualsiasi lingua, dichiarata nei profili e negli annunci.

Promessa: **Find your next collaborator.**

Il percorso centrale è ascolto → scoperta → proposta → accordo → collaborazione → consegna. La piattaforma deve far emergere affinità musicali e rendere comprensibili condizioni e responsabilità.

Il riferimento creativo richiesto è [untitled], https://untitled.stream/. Il riferimento guida atmosfera, centralità dell'audio e sobrietà; questo documento definisce un'interfaccia originale per Whatafeat, non una replica verificata schermata per schermata dell'app.

## 2. Decisioni di progetto e confini

### Decisioni consolidate

- Nome del prodotto: Whatafeat; wordmark visuale: `whatafeat`.
- Nicchia: scena underground indipendente.
- Lingua UI: inglese.
- Tre modalità: paid features, trades, open verses.
- Design scuro, minimale, intimo, centrato su musica e artwork.
- Prima consegna di sviluppo: prototipo navigabile con dati dimostrativi.
- Il presente incarico produce un piano, non avvia sviluppo o pubblicazione.

### Assunzioni operative per partire

- Un account può acquistare, vendere e scambiare: nessun ruolo buyer/seller esclusivo.
- Ogni collaborazione coinvolge due artisti; un open verse seleziona un solo collaboratore.
- Nessun obbligo di accettare automaticamente una richiesta a pagamento.
- Valuta unica EUR per la prima beta; configurabile e mostrata esplicitamente. L'inglese non implica USD.
- Una proposta inviata è immutabile: per cambiare le condizioni si ritira e se ne invia una nuova.
- Nessuna approvazione automatica delle consegne nella prima beta.

### Fuori scope iniziale

Feed social, follower, classifiche, distribuzione musicale, split automatici delle royalty, abbonamenti, annunci sponsorizzati, videochiamate, DAW online, app native, raccomandazioni algoritmiche e collaborazioni con più di due partecipanti.

Le funzionalità economiche reali arrivano dopo il prototipo. Commissione, provider, payout, rimborsi e gestione delle contestazioni restano decisioni da definire prima di attivare i pagamenti.

## 3. Direzione grafica

L'interfaccia deve ricordare un archivio musicale personale curato: superfici scure, composizioni tranquille, artwork espressivi e controllo dell'audio immediato. L'identità underground emerge dalla musica e dai contenuti degli artisti.

### Design tokens

| Token | Valore iniziale | Uso |
|---|---|---|
| Background | #101010 | Sfondo principale |
| Surface | #191919 | Pannelli e card |
| Elevated | #232323 | Menu, dialog e superfici sollevate |
| Primary text | #ECECEC | Contenuti principali |
| Secondary text | #A0A0A0 | Metadati e descrizioni |
| Border | #303030 | Separatori decorativi |
| Primary action | #ECECEC con testo #101010 | CTA principale |
| Error | #FF8A8A | Errori con testo e icona |
| Radius | 8–12 px | Pannelli, input e cover |
| Spacing | Multipli di 4 px | Scala 4, 8, 12, 16, 24, 32, 48 |
| Motion | 120–180 ms | Fade, hover e apertura pannelli |

I bordi decorativi non devono essere l'unico modo di identificare un controllo. Verificare contrasto, focus e leggibilità nelle combinazioni reali.

### Tipografia e immagini

- Sans-serif neutra con licenza verificata, ad esempio Inter se disponibile localmente; fallback di sistema.
- Testo operativo 14–16 px, metadati almeno 12 px, titoli di pagina indicativamente 28–36 px desktop e 24–28 px mobile.
- Titoli prevalentemente sentence case e peso medio; niente uppercase sistematico.
- Monospace facoltativo e limitato a durata, BPM o metadati tecnici.
- Artwork quadrati, fotografie personali e immagini di progetto; nessuna foto stock aziendale.
- Il colore proviene soprattutto dagli artwork. Le azioni rimangono prevalentemente monocromatiche.
- Wordmark originale in minuscolo; non riutilizzare logo, parentesi distintive o asset di [untitled].

### Componenti e comportamento

- Card pulite con poco contenitore visivo; cover, titolo, autore e disponibilità.
- Icone coerenti; label accessibili anche sui pulsanti solo icona.
- Pill per filtri e stati, non per qualsiasi elemento.
- Hover discreti, nessun movimento che renda difficile selezionare i controlli.
- Una CTA primaria per sezione operativa.
- Niente glitch, texture invasive, gradienti dominanti o hero a schermo intero.
- Nessuna informazione indispensabile disponibile soltanto su hover.
- Rispettare `prefers-reduced-motion`.

## 4. Navigazione e layout

La home pubblica è una schermata di scoperta musicale con una breve introduzione, non una lunga landing promozionale. Artwork e play devono essere visibili nel primo schermo.

Desktop: sidebar di circa 216 px, area centrale flessibile, player ancorato in basso. Il contenuto operativo può avere una larghezza massima di circa 1280 px.

Mobile: navigazione inferiore con Explore, Open verses, Inbox e Studio; account accessibile dall'avatar. Mini-player sopra la navigazione. Riservare spazio al contenuto e rispettare la safe area.

Griglie indicative: 2 colonne su mobile, 3 su tablet, 4–5 su desktop quando lo spazio lo consente. Le offerte più dense possono diventare liste su schermi stretti.

| Percorso | Schermata | Accesso |
|---|---|---|
| / | Discover: introduzione e selezioni editoriali | Pubblico |
| /explore | Artisti, ricerca e filtri | Pubblico |
| /artists/:slug | Profilo artista e offerte | Pubblico |
| /open-verses | Elenco annunci | Pubblico |
| /open-verses/:id | Progetto e candidatura | Lettura pubblica |
| /sign-in, /join | Accesso e registrazione | Pubblico |
| /onboarding | Creazione profilo | Autenticato |
| /studio | Attività e proposte | Proprietario |
| /studio/offers | Gestione offerte | Proprietario |
| /studio/open-verses | Gestione annunci e candidati | Proprietario |
| /inbox | Conversazioni legate a proposte e collaborazioni | Partecipanti |
| /collaborations/:id | Spazio della collaborazione | Partecipanti |
| /settings | Account e profilo | Proprietario |

L'accesso è richiesto quando si invia una proposta o candidatura, non per ascoltare le anteprime pubbliche. Dopo il login riprendere l'azione richiesta senza perdere il contesto.

## 5. Specifica delle schermate

### Discover

Titolo: `Find your next collaborator.` Sottotitolo: `Discover artists. Trade verses. Book features.`

Azioni: `Explore artists` e `Post an open verse`.

Sezioni: open verses selezionati, artisti selezionati, esplorazione per sound, breve spiegazione delle tre modalità. Non utilizzare numeri di utenti, recensioni o badge di verifica inventati. Nel prototipo indicare che i dati sono dimostrativi.

### Explore

Ricerca per nome e descrizione. Filtri: genere, lingua, disponibilità paid/trade, prezzo massimo, tempo di consegna. Ordinamento iniziale semplice e dichiarato: selezione editoriale o più recenti; evitare un ranking di popolarità fittizio.

La card mostra cover/avatar, nome, massimo due tag musicali, play della demo, prezzo iniziale e/o `Open to trades`. Play e apertura del profilo sono azioni distinte. I filtri vengono serializzati nell'URL; su mobile aprire un pannello con Apply e Clear.

### Profilo artista

Header compatto con avatar, nome, breve bio, lingue e generi. Subito sotto una tracklist delle demo con titolo, durata e play. Offerte in un pannello desktop o sotto la tracklist su mobile.

Ogni offerta specifica contributo, prezzo, tempi, revisioni, file inclusi. CTA: `Request feature` o `Propose a trade`. Mostrare link musicali e recensioni autentiche in sezioni secondarie. Le offerte archiviate non sono richiedibili, ma gli accordi precedenti restano leggibili.

### Open verses

Card con artwork, titolo, autore, play, lingua cercata, genere e tipo di collaborazione. BPM e tonalità sono opzionali. Filtri separati Paid e Trade.

Dettaglio a due colonne su desktop: progetto/audio a sinistra, richiesta/condizioni a destra. Su mobile mantenere quest'ordine verticale.

Un open verse Paid significa che **l'autore dell'annuncio paga il collaboratore selezionato**. Usare `Budget: €…` o `Pays €…`, mai una label ambigua. La candidatura può proporre un compenso diverso dal budget, da accettare espressamente.

Candidatura: messaggio, demo di riferimento e compenso richiesto se Paid. Non richiedere una registrazione personalizzata gratuita per candidarsi. Una candidatura attiva per artista e annuncio. Non rendere pubbliche candidature e negoziazioni.

### Onboarding e gestione profilo

Richiedere nome artista, slug univoco, generi, lingue e disponibilità Paid/Trade. Avatar, bio e demo si possono completare dopo; richiedere almeno una demo prima di pubblicare un'offerta o inviare una candidatura. Consentire salvataggio progressivo.

### My Studio

Sezioni: Needs your action, Active collaborations, Proposals, Your offers, Your open verses. Dare priorità alle decisioni pendenti e alle scadenze; evitare grafici finanziari e KPI decorativi nella prima versione.

### Proposal form

Presentare contributo richiesto, brief, demo privata, tempi, prezzo e condizioni. Per gli scambi mostrare esplicitamente `Your contribution` e `Their contribution`. Prima dell'invio visualizzare un riepilogo. Nessun pagamento al semplice invio.

### Collaboration room

Header con titolo, partecipanti e stato. Area principale con messaggi, tracce e versioni; pannello laterale con accordo, scadenze e prossima azione. Mobile: sezioni impilate, accordo richiudibile.

Ogni consegna mostra versione, autore, data, note e file. Differenziare anteprima ascoltabile e originali scaricabili. Non sovrascrivere le versioni precedenti. Azioni: `Upload delivery`, `Request revision`, `Accept delivery`.

Inbox riusa le conversazioni delle proposte e delle collaborazioni; non introdurre una seconda chat indipendente per lo stesso lavoro.

## 6. Flussi e accordi

### Paid feature da un'offerta

1. L'acquirente ascolta e invia una proposta.
2. Il venditore accetta o rifiuta.
3. L'accettazione congela le condizioni e crea la collaborazione Awaiting payment.
4. Nel prodotto reale il pagamento confermato dal server attiva il lavoro; nel prototipo si usa un comando esplicitamente simulato.
5. Il venditore consegna; l'acquirente approva o richiede una revisione inclusa.
6. L'approvazione completa il lavoro. L'eventuale payout è uno stato economico separato.

### Trade

1. L'artista A propone due contributi, uno per ciascun partecipante.
2. B accetta le condizioni; la collaborazione diventa Active senza pagamento.
3. Ciascuno consegna il proprio contributo e approva quello ricevuto.
4. Il sistema completa la collaborazione solo quando entrambi i contributi sono approvati.

Non simulare garanzie di reciprocità: se uno non consegna, il lavoro resta incompleto e può essere segnalato.

### Open verse

1. L'autore pubblica l'annuncio.
2. Gli artisti inviano candidature.
3. L'autore seleziona un candidato e gli invia una proposta finale.
4. L'accettazione della proposta crea una sola collaborazione e chiude l'annuncio.
5. Se la proposta è rifiutata o scade, l'autore può selezionare un altro candidato.

La selezione riserva una candidatura ma non avvia automaticamente il lavoro. Una transazione impedisce accettazioni concorrenti e doppie collaborazioni.

### Contenuto dell'accordo accettato

Tipo e durata del contributo; file attesi; prezzo e valuta oppure obblighi dello scambio; scadenze; revisioni incluse; crediti; condizioni di pubblicazione e quote concordate; eventuale promozione inclusa; partecipanti e timestamp.

L'accordo è una copia immutabile delle condizioni accettate. Una modifica al profilo, al prezzo pubblico o all'annuncio non lo altera. Non assumere che il pagamento trasferisca automaticamente ogni diritto. Le condizioni contrattuali definitive richiedono definizione separata prima del lancio commerciale.

Per lavori Paid proporre un tempo di consegna in giorni dall'attivazione dopo il pagamento; salvare la scadenza risultante all'attivazione. Per Trade salvare una scadenza per ciascun contributo.

## 7. Stati e regole di dominio

| Entità | Stati |
|---|---|
| Proposal | Draft, Sent, Accepted, Declined, Withdrawn, Expired |
| OpenVerse | Draft, Published, Closed |
| Application | Submitted, Shortlisted, Selected, Rejected, Withdrawn |
| Collaboration | Awaiting payment, Active, Completed, Cancelled |
| Contribution | Pending, Delivered, Revision requested, Approved |
| Payment futuro | Pending, Succeeded, Failed, Partially refunded, Refunded |

Delivered e Revision requested appartengono ai singoli contributi: una collaborazione Trade può averne uno approvato e l'altro ancora Pending. L'interfaccia deriva un riepilogo leggibile senza duplicare stati contraddittori.

- Solo il destinatario accetta la proposta; nessuna proposta a sé stessi.
- Una proposta accettata non si può ritirare.
- Solo il destinatario di un contributo può approvarlo o chiedere revisioni.
- Il contatore revisioni aumenta con la richiesta valida, non con ogni file caricato.
- Una consegna approvata non è modificabile unilateralmente.
- Il superamento della scadenza produce un indicatore Overdue, non una cancellazione automatica.
- Prima dell'attivazione il richiedente può annullare una richiesta non pagata. Dopo l'attivazione gestire richiesta di cancellazione e accordo delle parti; i casi contestati passano a supporto.
- Bloccare un utente impedisce nuove interazioni, senza eliminare prove e obblighi dei lavori esistenti.
- Recensioni soltanto a lavoro completato: una per autore e collaborazione.
- Timestamp in UTC, visualizzazione locale. Importi interi in unità minime e codice valuta.
- Tutte le transizioni sono validate dal server; mai fidarsi dello stato inviato dal browser.

## 8. Architettura tecnica proposta

Monolite modulare, senza microservizi iniziali. Le scelte seguenti sono default di progetto, da adattare alle convenzioni di un eventuale repository esistente. Verificare compatibilità e documentazione delle versioni al momento dell'implementazione.

| Livello | Scelta |
|---|---|
| Web app | Next.js e React con TypeScript |
| UI | CSS variables e Tailwind; componenti accessibili riutilizzabili |
| Database | PostgreSQL |
| Accesso dati | ORM con migrazioni versionate, ad esempio Prisma |
| Validazione | Schemi condivisi, ad esempio Zod |
| Auth | Provider gestito, da selezionare prima della fase backend |
| File | Object storage compatibile S3, metadati nel database |
| Audio | HTML audio con stato condiviso a livello applicazione |
| Messaggi | Persistenza server e aggiornamento periodico iniziale |
| Job | Elaborazione audio e notifiche asincrone quando necessarie |

### Moduli e struttura

```text
src/
  app/                  # routing, layout e confini server/client
  components/ui/        # primitive condivise
  features/
    artists/
    offers/
    open-verses/
    proposals/
    collaborations/
    messaging/
    player/
  domain/               # modelli, regole e transizioni
  server/               # autorizzazioni, servizi, repository, integrazioni
  mocks/                # fixture e adapter del prototipo
  styles/               # tokens e stili globali
```

Separare componenti, regole di dominio e accesso ai dati. Usare interfacce di repository per passare dai mock al backend senza riscrivere tutte le schermate. Evitare astrazioni non necessarie e doppie fonti di stato.

### Operazioni applicative

Esporre operazioni esplicite per inviare/accettare/rifiutare proposte, selezionare candidati, consegnare, chiedere revisione e approvare. Non offrire un endpoint generico che permetta al client di impostare qualsiasi stato.

Le liste devono supportare paginazione, ricerca e filtri server-side. Accettazione proposta, selezione candidato e completamento collaborazione richiedono transazioni e vincoli database. Utilizzare chiavi di idempotenza per operazioni economiche e accettazioni ripetibili.

## 9. Modello dati

| Entità | Campi e responsabilità principali |
|---|---|
| User | ID, auth subject univoco, email privata, ruolo amministrativo, stato account |
| ArtistProfile | User ID univoco, slug univoco, nome, bio, avatar, generi, lingue, disponibilità, link |
| AudioSample | Profilo, titolo, asset pubblico, durata, ordine |
| FeatureOffer | Artista, titolo, tipo contributo, importo, valuta, tempi, revisioni, file inclusi, stato |
| OpenVerse | Autore, titolo, brief, preview, modalità, budget, lingua, genere, BPM, tonalità, scadenza candidature, stato |
| Application | Annuncio, candidato, messaggio, demo, compenso richiesto, stato |
| Proposal | Mittente, destinatario, fonte, condizioni proposte, scadenza accettazione, stato |
| Collaboration | Proposal ID univoco, partecipanti, accordo snapshot, modalità, stato, date |
| Contribution | Collaborazione, performer, destinatario, obbligo, scadenza, revisioni, stato |
| Delivery | Contributo, versione, note, data, file associati |
| Conversation | Partecipanti, proposta/collaborazione collegata |
| Message | Conversazione, autore, testo, allegati, data |
| Asset | Proprietario, storage key, mime, dimensione, visibilità, stato elaborazione |
| Review | Collaborazione, autore, destinatario, voto, testo |
| Report | Segnalante, oggetto, motivo, stato di gestione |
| Payment | Collaborazione, provider ID, importo, valuta, stato; fase pagamenti |
| AuditEvent | Attore, operazione critica, oggetto e data |

Vincoli: una collaborazione per proposta; una candidatura per candidato/annuncio riattivabile dopo ritiro secondo policy; una recensione per autore/collaborazione; massimo un esito accettato per open verse. I file possono essere molti per messaggio e consegna, mediante relazioni dedicate.

## 10. Audio, upload e privacy

### Player

- Un solo elemento audio attivo, mantenuto nel layout persistente.
- Nessun autoplay; cambio pagina senza interrompere il brano quando il contesto resta autorizzato.
- Play/pause, seek, durata, titolo, autore e artwork; volume su desktop.
- Mini-player mobile espandibile; spazio riservato nel layout.
- Durante un cambio traccia gestire caricamento ed errori senza stati play incoerenti.
- Fermare e svuotare l'audio privato al logout o alla revoca dell'accesso.
- Waveform facoltativa e reale; nel prototipo è sufficiente una progress bar. Non usare una waveform casuale presentata come analisi del file.

### File

Anteprime pubbliche separate da demo private e consegne. Gli originali restano distinti dalle versioni per streaming.

Flusso backend: autorizzazione upload → URL temporaneo → caricamento → conferma server e validazione → stato Ready/Rejected → eventuale transcodifica asincrona. Non fidarsi di estensione, MIME o dimensione dichiarati dal client.

Limiti iniziali proposti, configurabili: artwork JPEG/PNG/WebP fino a 10 MB; demo MP3/WAV fino a 100 MB; consegne audio/ZIP fino a 500 MB per file. Nel prototipo validare selezione e metadati senza promettere conservazione dei file locali dopo un refresh.

I download privati richiedono verifica del partecipante e URL a breve scadenza. Non esporre storage key o bucket privati come link pubblici. Sanitizzare nomi e testi; prevedere controllo file e quote per utente prima della beta.

## 11. Accessibilità, affidabilità e moderazione

Per ogni pagina: loading, empty, error con retry, success e access denied. Empty state utili, per esempio `No open verses match your filters` con azione Clear filters.

Navigazione da tastiera, focus visibile, label dei controlli audio, dialog con focus gestito e touch target adeguati. Non affidare stato, errori o selezione solo al colore. Verificare da 360 px in su e senza scroll orizzontale involontario.

Autorizzazione server su ogni oggetto privato; rate limit su login, messaggi, proposte e upload. Segreti solo server-side. Evitare contenuti privati nei log e negli eventi analytics.

Prevedere segnalazione profili/annunci/messaggi e blocco utenti. Prima della beta reale predisporre una vista amministrativa minima per sospendere contenuti e gestire segnalazioni, con accessi tracciati. Le regole di conservazione, cancellazione account e gestione diritti sui file devono essere definite prima del lancio.

Notifiche iniziali in-app per proposta ricevuta, accettazione, nuova consegna e revisione richiesta. Email e realtime possono essere introdotti dopo il core.

## 12. Fasi di realizzazione

### Fase 1 — Prototipo completo

1. Esaminare repository e convenzioni; fissare dipendenze compatibili nel lockfile.
2. Creare tokens, tipografia, app shell, controlli e player.
3. Realizzare Explore, Artist Profile e Open Verse Detail come riferimento visuale.
4. Completare Discover, elenchi, onboarding, proposte, Studio, Inbox e collaboration room.
5. Aggiungere adapter mock con persistenza locale versionata per i soli dati dimostrativi.
6. Verificare scenari end-to-end e layout mobile/desktop.

Dati: almeno 8 artisti fittizi, 6 open verses, offerte Paid/Trade e collaborazioni in più stati. Usare asset originali o autorizzati; niente nomi reali associati a prezzi o endorsement inventati. I sample devono poter essere realmente riprodotti.

Prevedere un controllo `Demo account` per passare tra due identità fittizie e provare accettazione/consegna, distinto dalla futura autenticazione. Comando Reset demo per ripristinare le fixture. Badge discreto `Demo` e pagamento `Simulate payment`, senza finte richieste di carte.

**Accettazione:** discovery → ascolto → proposta → accettazione → attivazione simulata → consegna → approvazione; trade completato soltanto dopo due approvazioni; candidatura open verse convertita in proposta e collaborazione unica. Nessun bottone principale senza comportamento.

### Fase 2 — Backend e scambi reali

Database e migrazioni, account, autorizzazioni, storage, profili, offerte, annunci, proposte, messaggi e consegne. Rimuovere i controlli demo nell'ambiente reale.

Prima beta senza pagamenti: attivare gli scambi; le richieste Paid non possono diventare lavori attivi finché non esiste un'integrazione economica reale. Non trasferire la simulazione di pagamento in produzione.

**Accettazione:** due account reali completano uno scambio; un terzo non può leggere messaggi o scaricare file privati. Operazioni concorrenti non creano duplicati.

### Fase 3 — Pagamenti marketplace

Selezionare provider e definire onboarding beneficiari, fee, modalità di incasso/accredito, cancellazioni, rimborsi e contestazioni. Implementare webhook firmati, deduplicazione eventi e riconciliazione; non attivare un ordine sulla sola pagina di successo del checkout.

Distinguere pagamento del cliente, completamento del lavoro e accredito al venditore. Non promettere escrow senza verifica del modello effettivo del provider. Coprire pagamenti falliti, webhook duplicati/ritardati e rimborsi.

**Accettazione:** percorso sandbox del provider verificato end-to-end e regole operative definite prima dell'attivazione reale.

### Fase 4 — Beta controllata

Invitare un piccolo gruppo di artisti; misurare ascolti → profili → proposte → accettazioni → completamenti. Monitorare tempi di risposta, revisioni e abbandoni, separando dati demo e reali.

Eventi proposti: sample_played, artist_viewed, proposal_sent, proposal_accepted, collaboration_activated, delivery_uploaded, revision_requested, collaboration_completed. Non includere messaggi, URL privati o dettagli degli accordi negli eventi.

## 13. Verifiche essenziali

| Ambito | Verifica |
|---|---|
| Audio | Una traccia alla volta, continuità tra pagine, errore gestito |
| Ricerca | Filtri combinati, URL ripristinabile, nessun risultato |
| Proposta | Nessuna auto-proposta; solo destinatario può accettare |
| Trade | Una sola consegna approvata non completa il lavoro |
| Revisioni | Richiesta oltre il limite impedita dal dominio/server |
| Open verse | Accettazioni concorrenti producono una sola collaborazione |
| Privacy | Terzo account escluso da messaggi e file privati |
| Pagamenti | Redirect client insufficiente; webhook idempotente |
| Responsive | 360, 390, 768 e 1440 px; player non copre le CTA |
| Accessibilità | Tastiera, focus, dialog, label e contrasto |

Test mirati sulle regole di dominio e pochi percorsi end-to-end significativi. Nella fase prototipo la simulazione dei permessi non sostituisce la verifica server della fase 2. Build, typecheck e controlli previsti dal repository devono passare prima della consegna.

## 14. Prompt iniziale pronto per Codex

```text
Leggi WHATAFEAT_PLAN.md e implementa esclusivamente la Fase 1.

Prima esamina il repository e le istruzioni locali. Riutilizza le convenzioni
esistenti; se vuoto, inizializza lo stack proposto con versioni compatibili.
Scrivi un breve piano di implementazione e poi procedi.

Whatafeat è una web app in inglese per artisti underground: paid features,
trade e open verses. La direzione visiva definitiva è quella descritta nel
documento, ispirata all'atmosfera minimale e alla centralità dell'audio di
[untitled], con identità originale. Superfici scure, tipografia neutra,
artwork protagonisti, controlli monocromatici e player persistente.

Costruisci prima Explore, Artist Profile e Open Verse Detail, poi completa
gli altri flussi. Mantieni coerenti tutte le schermate. Nessun glitch,
verde acido dominante, hero gigante o dashboard aziendale generica.

Separa UI, dominio e repository mock. Implementa dati dimostrativi coerenti,
ricerca/filtri, player reale, proposte, accettazione, pagamento esplicitamente
simulato, scambi con due contributi, candidature, consegne e revisioni.
Includi selezione account demo e reset delle fixture.

Ogni azione principale deve funzionare; ciò che è fuori scope deve essere
disabilitato con spiegazione. Non integrare pagamenti reali, non chiedere
credenziali non necessarie al prototipo e non pubblicare il sito in questa fase.

Verifica scenari e viewport indicati nel piano, build e typecheck.
Consegna README con avvio locale, comandi, cosa funziona, cosa è simulato,
limiti noti e prossimi passi. Non dichiarare sicuri o pronti per produzione
i controlli che esistono soltanto nel browser.
```

## 15. Deliverable attesi dallo sviluppo

- Codice sorgente e dipendenze fissate nel lockfile.
- Prototipo navigabile con tutte le schermate della fase 1.
- Tokens e componenti condivisi, fixture e sample audio autorizzati.
- Regole di dominio e adapter sostituibili dal backend.
- README, risultati delle verifiche e limiti noti.
- Backlog delle integrazioni successive, senza attivarle implicitamente.

Il prototipo serve a validare identità, ascolto e collaborazione. La release commerciale richiede inoltre backend verificato, moderazione, gestione dei file e regole economiche effettive.
