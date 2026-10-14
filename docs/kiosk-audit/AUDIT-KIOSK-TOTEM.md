# Audit Kiosk Totem ENEA

Data: 13 ottobre 2026. Audit in sola lettura di `kioskov3`, `enea-be`, `enea-fe` ed `enea-connect` sul codice di `main`.
Unica modifica al codice: la correzione di sicurezza in enea-be PR #10 (vedi SECURITY, S1).

Legenda gravità: **Critica** (sfruttabile oggi da chiunque), **Alta**, **Media**, **Bassa**.
"Verificato" significa provato in locale o letto riga per riga; "Dedotto" significa ricavato dal codice ma non eseguito.

## Architettura reale

| Pezzo | Dove | Ruolo |
|---|---|---|
| App del totem | `kioskov3` (Angular 20, Ionic 8, standalone) | Interfaccia pubblica. Nata dal template "Ionic Conference App": le attività sono ancora `speakers`, gli eventi `schedule`. |
| Business Portal e moderazione | `enea-fe` (`src/app/features/kiosk-business/*`) | Rotte `/business/register`, `/business/login`, `/business/profile`, `/business/media`, `/business/home-poster`, `/business/banners`, `/business/map-marker`; staff: `/settings/kiosk-moderation`, `/settings/kiosk-directory`, `/settings/kiosk-events`, `/settings/kiosk-plans`. |
| API | `enea-be` | `/api/business-auth/*`, `/api/business-portal/*`, `/api/kiosk-admin/*`, `/api/public-kiosk/*`, `/api/public-kiosk-lead/*`. |
| Windows | `kioskov3/scripts/totem-windows/*` | `.bat` e PowerShell: Chrome `--kiosk`, watchdog, policy di registro. |
| ENEA Connect | `enea-connect` | **Non usato dal totem**: nessun riferimento a kiosk/totem in `enea-connect/src` e nessun riferimento a ENEA Connect in `kioskov3/src`. Non va introdotto. |

In produzione il totem gira con `ng serve` (server di sviluppo Angular) sulla porta 8200, configurazione `totemProdProxy`, che inoltra `/api` e `/uploads` al backend di produzione (`start-totem-stack.bat`, `watch-totem-dev-server.ps1`). Non c'è una build di produzione né un service worker attivo sul totem.

## Flusso funzione per funzione

| Funzione | File (FE) | Endpoint | Auth | Ruolo | Stato dati | Socket.IO | Dopo approvazione | Bug / rischio |
|---|---|---|---|---|---|---|---|---|
| Home poster (carosello) | `kioskov3/.../tutorial/tutorial.ts` | `GET /api/public-kiosk/banners`, `/home-posters`, `/home`, `/feed-version` | nessuna | pubblico | `kiosk_business_media.kind='home_poster'`, `editorial_status='approved'` | no | polling `feed-version` ogni 12 s, poi refetch | ok per i poster; il polling ricalcola due liste complete per ogni totem ogni 12 s |
| Strip banner promo | `tutorial.ts` | `GET /api/public-kiosk/promo-banners` | nessuna | pubblico | `kiosk_banners.status='approved'` | no | come sopra | eccezione hardcoded: per lo slug `comune-castelraimondo` anche banner `draft` e `pending_review` sono pubblici (`kiosk-public.service.js:745-755`) |
| Elenco attività | `speaker-list.ts`, `conference.service.ts` | `GET /api/public-kiosk/businesses?limit=200` | nessuna | pubblico | `kiosk_businesses.status='approved'` e account `active` | no | **non si aggiorna mai** finché la pagina non viene ricaricata | vedi REALTIME R1 e R2 |
| Dettaglio attività | `speaker-detail.ts` | `GET /api/public-kiosk/businesses/:slug` | nessuna | pubblico | come sopra + gallery | no | ricaricato a ogni ingresso | la gallery include media mai moderati (S4) |
| Eventi | `schedule.ts` | `GET /api/public-kiosk/events` | nessuna | pubblico | `kiosk_events` | no | caricati una volta e messi in cache con le attività | stesso problema di cache di R1 |
| Piani Premium (form) | `piani-premium.page.ts` | `POST /api/public-kiosk-lead/premium-request` | nessuna | pubblico | email SMTP diretta | no | n/a | raccoglie nome, email, telefono su uno schermo pubblico (P3) |
| Pagine partner | `turismo`, `infiorata`, `vivere-camerino`, `cronache-maceratesi`, `picchio-news`, `comune-castelraimondo`, `cosmari`, `plateform` | iframe verso siti esterni | n/a | pubblico | n/a | no | n/a | navigazione libera dentro l'iframe (S6) |
| Registrazione | `enea-fe/.../business-register.page.ts` | `POST /api/business-auth/register` | nessuna | pubblico | account `pending`, attività `draft` | no | n/a | nessuna verifica email, nessun captcha; email e username enumerabili (409) |
| Login titolare | `business-login.page.ts` | `POST /api/business-auth/login` | password | titolare | JWT HS256 `aud=kiosk_business_portal`, 8 h | no | n/a | account `pending` ammesso; token in `localStorage` |
| Recupero password | assente | assente | | | | | | da costruire |
| Profilo | `business-profile.page.ts` | `GET/PUT /api/business-portal/profile` | JWT titolare | proprietario (account_id dal token) | aggiorna `kiosk_businesses` direttamente | no | **le modifiche vanno live subito se l'attività è già approvata** (S3) | |
| Upload media | `business-media.page.ts` | `POST /api/business-portal/media/upload` | JWT titolare | proprietario | `kiosk_business_media status='active'`, gallery senza moderazione | no | gallery pubblica subito (S4) | MIME dichiarato dal client, nessun controllo magic bytes per gallery/logo |
| Poster home | `business-home-poster.page.ts` | `/api/business-portal/home-poster*` | JWT titolare | proprietario, piano Premium | `editorial_status` | no | richiede approvazione | validato con `sharp` |
| Banner | `business-banners.page.ts` | `/api/business-portal/banners*` | JWT titolare | proprietario | `kiosk_banners.status` | no | richiede approvazione | |
| Invio in revisione | portale | `POST /api/business-portal/submit-for-review` | JWT titolare | proprietario | `status='pending_review'` da **qualsiasi** stato | no | n/a | un'attività `suspended` torna in coda da sola (W2) |
| Moderazione | `kiosk-moderation.page.ts` | `PUT /api/kiosk-admin/businesses/:id/status` e simili | JWT staff | `admin` o `super_admin` dal token | qualsiasi stato verso qualsiasi stato | no | il totem lo vede solo al prossimo reload | nessuna motivazione, nessuna email, due UPDATE senza transazione (W1) |
| Audit | `kiosk_audit` | interno | | | `tryAudit` best-effort | | | errori di audit ignorati |

## ROOT CAUSE

1. **Token del portale attività accettato come token staff.** `enea-be/src/middleware/auth.js` (`requireAuth`, `verifyJwtToken`, `verifyStaffJwtForRefresh`) rifiutava solo le audience meals. Il token del portale ha `aud: kiosk_business_portal` ma è firmato con lo stesso `JWT_SECRET`, quindi passava. Verificato (PoC locale con segreto finto) e corretto in PR #10.
2. **Il catalogo attività del totem è una cache senza scadenza.** `kioskov3/src/app/providers/conference.service.ts` → `load()` restituisce `this.data` per sempre dopo il primo caricamento. Una nuova approvazione o una sospensione non arrivano all'elenco finché qualcuno non ricarica la pagina.
3. **Se l'API fallisce all'avvio, il totem resta vuoto.** Stesso file: `catchError` costruisce un catalogo vuoto con `processData()`, che lo salva in `this.data`. Dopo un'interruzione di rete all'avvio l'elenco attività resta vuoto fino al reload. Dedotto.
4. **Nessun realtime per il totem.** `socket.io-client` è in `package.json` di kioskov3 ma non è mai importato. Il backend non emette alcun evento kiosk (`grep emit` su `kiosk-admin.js`, `business-portal.js`, `kiosk-*.service.js`: zero risultati). L'unico aggiornamento automatico è il polling di `feed-version`, che copre solo poster e banner.
5. **Moderazione aggirabile.** `PUT /api/business-portal/profile` aggiorna la scheda pubblica senza riportarla in revisione; la gallery è pubblica senza `editorial_status`.
6. **Totem servito da `ng serve`.** Build di sviluppo, proxy verso produzione, watchdog che riavviano il dev server: fragile e lento all'avvio.

## SECURITY

| ID | Gravità | Problema | Dove | Stato |
|---|---|---|---|---|
| S1 | **Critica** | Chiunque si registra come attività, fa login (anche `pending`) e con quel token legge le API staff protette solo da login (clienti, prenotazioni, ordini, HACCP…) ed entra nella room socket `admins`. | `enea-be/src/middleware/auth.js`, `src/sockets/index.js` | Verificato. Corretto in [enea-be #10](https://github.com/endriazizi/enea-be/pull/10) (bozza) |
| S2 | Alta | I ruoli staff e lo stato dell'account titolare non sono riletti dal DB: un account sospeso o un admin revocato restano validi fino a 8 h. `requireKioskBusinessAuth` non controlla `kiosk_business_accounts.status`. | `kiosk-business-auth.js`, `kiosk-staff-admin.js` | Da correggere in PR 3 |
| S3 | Alta | Il titolare modifica nome, descrizioni, logo, cover e sito di una scheda già approvata e le modifiche vanno sul totem senza moderazione. `logo_url` e `cover_url` accettano qualsiasi URL http(s): un'immagine esterna approvata può essere cambiata dopo l'approvazione. | `business-portal.js` `PUT /profile` | Da correggere in PR 4 (bozza di revisione separata dalla versione pubblicata) |
| S4 | Alta | Le immagini gallery caricate dal titolare sono pubbliche subito (`status='active'`, la query pubblica non filtra `editorial_status`). | `business-portal.js:653`, `kiosk-public.service.js:459-464` | PR 4 |
| S5 | Alta | Sul totem le finestre `cmd` e PowerShell dei watchdog girano nella sessione dell'utente Totem: con una tastiera, Alt+Tab porta a una console. Le policy Chrome sono scritte in **HKCU** da uno script lanciato "come amministratore": con un account Totem standard finiscono nel profilo dell'amministratore, non in quello del Totem. | `scripts/totem-windows/*.bat` | Guida Windows, PR 8 |
| S6 | Media | Le pagine partner (Turismo, Infiorata, testate locali, Cosmari, Comune, Plateform) sono iframe di siti esterni: dentro l'iframe il visitatore naviga liberamente (link interni ai siti, pubblicità, ricerche). Il sandbox blocca popup e navigazione top-level, l'`URLBlocklist *` di Chrome limita i domini, ma il contenuto resta fuori controllo. | `pages/*/*.page.html` | Decisione di prodotto: sostituire con schede interne o QR |
| S7 | Media | La pagina Plateform carica `elfsightcdn.com/platform.js` nel documento principale: uno script di terzi può fare tutto ciò che fa l'app, comprese le navigazioni che la guard JS cerca di bloccare. | `plateform.page.ts:136` | Rimuovere o isolare in iframe sandbox |
| S8 | Media | Registrazione senza verifica email né protezione anti-bot; risposte 409 rivelano email e username esistenti; il rate limit è in memoria per processo. | `business-auth.js` | PR 3 |
| S9 | Media | Nessuna route jolly (`**`) nel totem: un URL sconosciuto lascia una pagina vuota. Restano rotte demo `/login`, `/signup`, `/account`, `/support` (login finto in locale). | `app.routes.ts` | PR 1 |
| S10 | Media | Aggiornamenti di Chrome disattivati (`--check-for-update-interval=31536000`, `--disable-component-update`): il browser esposto al pubblico non riceve patch di sicurezza. | `03-start-chrome-kiosk.bat` | Guida Windows |
| S11 | Bassa | `GET /api/public-kiosk/media-file` serve qualsiasi file sotto `uploads/kiosk-business`, anche bozze e rifiutati, se si conosce il percorso (nomi casuali, rischio basso). | `public-kiosk.js:190` | PR 4 |
| S12 | Bassa | `unpkg.com` e `elfsight.com` nell'allowlist URL di Chrome: domini che ospitano contenuti arbitrari. | `01-install-kiosk-policies.bat` | Guida Windows |

Cose fatte bene: `kioskStrictMode` blocca ogni http(s) verso altri origin, `tel:`/`mailto:` sono bloccati, `sanitizeKioskProseHtml` toglie i link dall'HTML delle schede, i siti web delle attività non sono cliccabili dal poster, `URLBlocklist *` con allowlist, `--user-data-dir` dedicato, DevTools, incognito, download e stampa disattivati da policy, il token del portale non entra nelle rotte `kiosk-admin` (403).

Le difese JavaScript (`kiosk-outbound-guard.ts`) sono utili come secondo livello ma non sono un confine di sicurezza: il confine è il sistema operativo (Assigned Access o Shell Launcher) più le policy di Chrome in HKLM.

## UI/UX

Problemi attuali:
- Il codice porta ancora i nomi del template conferenza (`speakers`, `schedule`, `session-detail`, menu "Conference"), con una home da 3.010 righe (`tutorial.ts`) che fa carosello, video, meteo, idle, polling e supporto insieme.
- Sette tab nella barra inferiore, alcune verso siti esterni in iframe: troppe scelte per un visitatore occasionale.
- Due timer di inattività indipendenti (in `app.component.ts` e in `tutorial.ts`) più un `InactivityService` mai usato.
- `ion-menu` laterale ancora presente nella shell.
- Il messaggio di aggiornamento del service worker è in inglese ("Update available!") e ricarica la pagina.
- Il form Premium resta compilato nella cache di pagina di Ionic dopo il ritorno alla Home (dedotto, da verificare in E2E).

Proposte: [anteprima interattiva A e B](https://claude.ai/artifact/5stV32wwrLbX1ahGCH2jwg), copia nel repo in `docs/design-preview/kiosk-preview.html`.
- **A, Digital signage**: tema scuro, poster grande in rotazione, eventi a lato, sei categorie a tutta larghezza, dock con Home sempre evidente.
- **B, Directory interattiva**: tema chiaro, domanda e ricerca in alto con tastiera a schermo, griglia di categorie con conteggi, attività in evidenza, schede ricche.
- Entrambe: base tipografica calcolata dalla risoluzione reale (lato corto) e non dalla diagonale, target touch di almeno 2,6 em (circa 64 px a 1080p), nessuno scroll orizzontale, contatti mostrati come testo e QR invece di link, schermata di attrazione dopo l'inattività.

## AUTH

| Contesto | Oggi | Proposta |
|---|---|---|
| Visitatore | Nessun login. API `/api/public-kiosk/*` pubbliche, solo dati approvati (con l'eccezione Comune, vedi sopra). | Invariato. Aggiungere un token dispositivo (tabella `kiosk_devices` già presente, mai usata) solo per Socket.IO e telemetria, mai per dati riservati. |
| Titolare | JWT HS256 `aud=kiosk_business_portal`, 8 h, `localStorage`, ownership ricavata dall'`account_id` del token e rilettura del business dal DB (corretto). | Rifiuto dei token non-staff (PR #10, fatto). Controllo dello stato account a ogni richiesta. Verifica email prima del primo invio in revisione. Recupero password con token monouso. Captcha leggero o honeypot e rate limit per email oltre che per IP. |
| Admin | Login staff, ruolo `admin`/`super_admin` letto dal JWT. | Rilettura ruolo dal DB sulle rotte `kiosk-admin`, motivazione obbligatoria su rifiuto, sospensione e richiesta modifiche. |

Password: bcrypt costo 12 (ok). Rate limit login: 10 tentativi per IP ogni 15 minuti, in memoria (si azzera al riavvio e non è condiviso tra istanze PM2).

## WORKFLOW (stati)

Stati attuali (`302_kiosk_businesses.sql`): `draft`, `pending_review`, `approved`, `suspended`, `rejected`. Mancano una richiesta di modifiche distinta dal rifiuto e una motivazione visibile al titolare.

Proposta compatibile, senza rinominare i valori esistenti:

```
draft ──invio──▶ pending_review ──approva──▶ approved (pubblicata)
                     │  ├──richiedi modifiche──▶ changes_requested ──reinvio──▶ pending_review
                     │  └──rifiuta──▶ rejected ──nuova revisione──▶ pending_review
approved ──sospendi──▶ suspended ──riattiva──▶ approved
```

Una sola migrazione: aggiungere `changes_requested` all'enum e le colonne `review_note`, `reviewed_by`, `reviewed_at`. Le transizioni ammesse stanno in una tabella nel service; ogni cambio è un `UPDATE ... WHERE id=? AND status=?` dentro `withTransaction` insieme a audit, outbox email e incremento della versione del catalogo. `EXPIRED` e `ARCHIVED` non servono oggi: le scadenze esistono già come `valid_from`/`valid_until` su poster e banner.

## REALTIME

Oggi: approvazione → `UPDATE` → nessun evento → il totem vede i poster entro 12 s (polling) e le attività solo dopo un reload.

Proposta (simulata nell'anteprima):

1. Admin approva → transazione: stato, audit, outbox, `kiosk_catalog_version = v+1` → **COMMIT**.
2. Dopo il commit: `io.to('kiosk:public').emit('kiosk:catalog-changed', { v, id, reason })`. Nessun dato personale nel payload.
3. Il totem confronta `v` con la sua versione, scarta duplicati per `id`, chiama `GET /api/public-kiosk/catalog?since=<v>` e aggiorna lo store a Signals.
4. In Home aggiorna subito; in una scheda aperta aggiorna in silenzio; se la scheda aperta viene sospesa mostra "Questa scheda non è più disponibile" e torna all'elenco.
5. Riconnessione automatica di Socket.IO con `since` all'handshake; con socket giù, controllo della versione ogni 60 s; con backend giù, ultimo catalogo valido e indicazione dell'ora dei dati.
6. Una sola connessione socket e un solo listener di inattività per l'intera app.

`feed-version` va sostituito da una versione persistita (una riga incrementata nella transazione) invece del SHA1 calcolato rileggendo tutti i poster a ogni richiesta.

## EMAIL

Oggi per il dominio kiosk esiste solo l'email "richiesta Premium" (`public-kiosk-premium-lead.js`), inviata in modo sincrono nella richiesta HTTP. Le notifiche di nuovi media all'admin vanno su WhatsApp, fire-and-forget. Nessuna email a titolari per registrazione, approvazione, rifiuto, sospensione o recupero password.

Proposta: tabella `email_outbox` (destinatario, template, variabili, chiave di idempotenza unica, stato, tentativi, ultimo errore) scritta nella stessa transazione della transizione; un worker invia con retry esponenziali e limite di tentativi, riusando `mailer.service.js` (`renderTemplatedEmail` già esiste) e i template di `mail-templates`. Tutte comunicazioni di servizio; nessun uso marketing degli indirizzi senza consenso separato.

## PERFORMANCE

Non misurato sul dispositivo (nessun accesso). Dal codice:
- `plateform.page.ts` registra un listener `click` su `document` a ogni apertura della pagina e non lo rimuove mai.
- `tutorial.ts` aggiunge un listener `visibilitychange` anonimo mai rimosso; la stessa pagina è montata sia su `/tutorial` sia su `/app/tabs/home`, quindi due istanze possono fare polling in parallelo.
- `feed-version` ricalcola due liste complete per ogni totem ogni 12 s.
- Due registrazioni del service worker in `main.ts` (`ServiceWorkerModule.register` e `provideServiceWorker`), entrambe spente con `ng serve`.
- Asset in repo pesanti e inutilizzati (`.psd`, `Archive.zip`, video MP4 nei sorgenti).

## TEST

| Area | Esito |
|---|---|
| Token attività rifiutato da `requireAuth` e socket (nuovo test unit) | PASS con la patch, FAIL sul codice attuale (2 su 3) |
| Suite unit enea-be | 698 PASS, 6 FAIL già presenti su `main` (customer-message-templates, notification-mgmt, order-customer-items-summary, pos-nexi-ditron-receipt-append, public-booking-manage), nessun nuovo fallimento |
| Anteprima A/B: flusso registra → approva → evento → aggiornamento, nessun errore console, nessuno scroll orizzontale a 1440 e 400 px | PASS (Chromium headless) |
| E2E Playwright sul totem (fullscreen, link esterni, back/forward, idle, socket, offline) | NOT TESTED: da scrivere in PR 1 e PR 5 |
| Checklist manuale Windows | NOT TESTED: serve il dispositivo, vedi la guida |

## GITHUB

| Repo | Branch | PR | Stato |
|---|---|---|---|
| enea-be | `claude/project-thread-itkwa5` | [#10](https://github.com/endriazizi/enea-be/pull/10) fix auth | bozza, non mergiata |
| kioskov3 | `claude/project-thread-itkwa5` | audit, guida Windows, anteprima | bozza, non mergiata |

## NEXT STEP

1. Approvare e pubblicare la correzione S1 (enea-be #10).
2. Scegliere il design: rispondere `APPROVO DESIGN KIOSK` indicando A, B o un misto.
3. Lanciare sul totem lo script di inventario e incollare l'output, per scegliere la configurazione Windows giusta.

Ordine proposto delle PR dopo l'approvazione del design: PR 1 guardrail totem (route jolly, rimozione demo, cache catalogo, listener), PR 3 auth titolare, PR 4 workflow e moderazione, PR 5 realtime, PR 6 email e outbox, PR 2 UI approvata, PR 7 OpenAPI, PR 8 Windows.
