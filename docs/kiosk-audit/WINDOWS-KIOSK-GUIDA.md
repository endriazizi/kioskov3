# Totem ENEA su Windows: configurazione kiosk

Obiettivo: il visitatore usa solo l'app del totem; uscire è possibile solo al personale, con le procedure del sistema operativo.

Questa guida non è stata provata sul dispositivo, che non è raggiungibile da qui. Ogni passo indica come verificarlo. Nessuna configurazione rende un PC con porte e tastiera accessibili inviolabile: la protezione viene dalla somma di sistema operativo, policy del browser e protezione fisica.

## 0. Prima di tutto: inventario

Sul totem, da un account amministratore:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\totem-windows\00-inventario-totem.ps1 > inventario.txt
```

Lo script legge e basta. L'output dice edizione e build di Windows, versione di Chrome, account e amministratori, autologon, policy Chrome effettive (HKLM e HKCU), disponibilità di Assigned Access, Shell Launcher e Keyboard Filter, alimentazione, dispositivi di input e risoluzione dello schermo. Da questo dipende quale strada seguire al punto 3.

## 1. Modello di minaccia

| Minaccia | Esempio | Contromisura principale |
|---|---|---|
| Tocchi e gesture | swipe dai bordi, pressione prolungata, pinch, trascinamento | Assigned Access, `AllowEdgeSwipe=0`, Chrome `--kiosk`, gesture touch a più dita spente |
| Contenuti | link esterni, iframe di siti terzi, popup, download | Policy Chrome in **HKLM** (`URLBlocklist *` con allowlist), guard dell'app come secondo livello |
| Tastiera collegata | Win, Alt+Tab, Ctrl+Shift+Esc, Ctrl+Alt+Canc, Alt+F4, F11 | niente tastiera accessibile; Assigned Access; su Enterprise/IoT Keyboard Filter |
| Porte USB | chiavetta, tastiera USB, boot da USB | scocca chiusa, BIOS con password e boot solo da disco, blocco archivi rimovibili |
| Account | sessione con diritti admin, password in chiaro nel registro | account `Totem` standard, autologon cifrato, admin separato |
| Alimentazione | spegnimento, interruzione corrente | BIOS "accensione al ritorno corrente", sleep disattivato, pulsante protetto |
| Aggiornamenti | browser vecchio esposto al pubblico | aggiornamenti attivi in una finestra di manutenzione notturna |

## 2. Problemi della configurazione attuale

1. **Policy Chrome in HKCU.** `01-install-kiosk-policies.bat` scrive quasi tutto in `HKCU\SOFTWARE\Policies\Google\Chrome` e chiede di essere eseguito come amministratore. Se l'account Totem è standard, l'elevazione usa le credenziali dell'amministratore e le chiavi finiscono nel profilo dell'amministratore: il Totem resta senza policy. Vanno in `HKLM` (punto 4). Verifica: `chrome://policy` aperto **nella sessione Totem** deve mostrare livello "Macchina".
2. **Console visibili nella sessione Totem.** `start-totem-kiosk.bat` e i watchdog PowerShell aprono finestre `cmd` e PowerShell nella stessa sessione del visitatore. Con una tastiera, Alt+Tab porta a una console. Con Assigned Access queste finestre non dovrebbero proprio esistere nella sessione Totem.
3. **Server di sviluppo in produzione.** Il totem gira con `ng serve` (build di sviluppo) e un watchdog che lo riavvia. Proposta: pubblicare la build `ng build -c totemProdProxy` (o una configurazione dedicata) su HTTPS accanto all'API, con service worker per l'avvio offline. Sul totem resta solo Chrome. Se l'app deve restare locale, servire `dist/` con un servizio Windows (non una console) e niente Node in modalità dev.
4. **Aggiornamenti di Chrome bloccati.** `--check-for-update-interval=31536000` e `--disable-component-update` lasciano Chrome senza patch. Toglierli e regolare gli aggiornamenti con le policy di Google Update (punto 4).
5. **Allowlist troppo ampia.** `unpkg.com` ed `elfsight.com` ospitano contenuti di chiunque. Tenere solo gli host davvero usati.

## 3. Scegliere la modalità kiosk del sistema operativo

Dipende dall'edizione stampata dall'inventario (`EditionID`).

| Edizione | Strada consigliata | Note |
|---|---|---|
| Windows 10/11 **Home** (`Core`) | Nessuna modalità kiosk per app desktop. Aggiornare a Pro. | Senza Assigned Access il desktop resta raggiungibile con una tastiera. |
| Windows 10 (1809+) / 11 **Pro** (`Professional`) | **Assigned Access, esperienza utente con restrizioni** (multi-app) con solo `chrome.exe` consentito e avviato in automatico (`AutoLaunch`). | Niente Esplora risorse, niente desktop, niente barra applicazioni per l'utente Totem. Ctrl+Alt+Canc resta disponibile per cambiare utente. |
| **Enterprise / Education / IoT Enterprise** | **Shell Launcher v2** con Chrome come shell dell'utente Totem e azione "riavvia l'app" alla chiusura, più **Keyboard Filter**. | È la strada più robusta per un'app Win32 come Chrome. |

Documentazione Microsoft da tenere aperta durante la configurazione: "Configure a restricted user experience (multi-app kiosk) with Assigned Access" e "Shell Launcher" su Microsoft Learn. La sintassi XML cambia tra Windows 10 e 11: verificare lo schema sulla build installata.

### 3A. Windows Pro: Assigned Access con restrizioni

1. Crea l'account standard `Totem` (non amministratore). L'account amministratore resta separato, con password lunga.
2. Prepara `totem-assigned-access.xml` (esempio per Windows 11, da validare sul dispositivo):

```xml
<?xml version="1.0" encoding="utf-8"?>
<AssignedAccessConfiguration
  xmlns="http://schemas.microsoft.com/AssignedAccess/2017/config"
  xmlns:rs5="http://schemas.microsoft.com/AssignedAccess/201810/config"
  xmlns:win11="http://schemas.microsoft.com/AssignedAccess/2022/config">
  <Profiles>
    <Profile Id="{9A2A490F-10F6-4764-974A-43B19E722C23}">
      <AllAppsList>
        <AllowedApps>
          <App DesktopAppPath="C:\Program Files\Google\Chrome\Application\chrome.exe"
               rs5:AutoLaunch="true"
               rs5:AutoLaunchArguments="--kiosk https://URL-DEL-TOTEM/tutorial --user-data-dir=C:\TotemChrome --no-first-run --overscroll-history-navigation=0 --disable-pinch" />
        </AllowedApps>
      </AllAppsList>
      <win11:StartPins><![CDATA[{ "pinnedList": [] }]]></win11:StartPins>
      <Taskbar ShowTaskbar="false" />
    </Profile>
  </Profiles>
  <Configs>
    <Config>
      <Account>.\Totem</Account>
      <DefaultProfile Id="{9A2A490F-10F6-4764-974A-43B19E722C23}" />
    </Config>
  </Configs>
</AssignedAccessConfiguration>
```

   Su Windows 10 al posto di `win11:StartPins` serve un `StartLayout` vuoto. Sostituisci `URL-DEL-TOTEM` con l'URL reale e genera un GUID nuovo.
3. Applica la configurazione come SYSTEM (per esempio con `psexec -i -s powershell.exe` di Sysinternals):

```powershell
$xml = Get-Content -Raw C:\Totem\totem-assigned-access.xml
$aa = Get-CimInstance -Namespace root\cimv2\mdm\dmmap -ClassName MDM_AssignedAccess
$aa.Configuration = [System.Net.WebUtility]::HtmlEncode($xml)
Set-CimInstance -CimInstance $aa
```

   In alternativa: pacchetto di provisioning con Windows Configuration Designer, oppure Intune se il PC è gestito.
4. Autologon dell'account Totem con **Sysinternals Autologon** (salva la password cifrata in LSA). Non usare `DefaultPassword` in chiaro nel registro: l'inventario segnala se c'è.
5. Verifica: riavvia, deve partire solo Chrome a schermo intero. Con una tastiera collegata, Win, Alt+Tab e Win+R non devono mostrare il desktop né altre app.

Limite da provare sul posto: se il visitatore chiude Chrome (serve una tastiera, Alt+F4), l'esperienza con restrizioni non lo riapre da sola. Per questo la tastiera non deve essere accessibile. I watchdog in console di oggi non vanno portati nella sessione Totem.

### 3B. Enterprise / IoT: Shell Launcher v2 e Keyboard Filter

1. Attiva le funzionalità `Client-EmbeddedShellLauncher` e `Client-KeyboardFilter`.
2. Shell dell'utente Totem: `chrome.exe` con gli stessi argomenti, azione alla chiusura "riavvia la shell". Shell dell'amministratore: `explorer.exe`.
3. Keyboard Filter: blocca Win, Alt+Tab, Ctrl+Esc, Alt+F4, Ctrl+Shift+Esc, F11, e valuta Ctrl+Alt+Canc solo se esiste un'altra via di accesso per il personale (per esempio un account admin con Keyboard Filter disattivato per gli amministratori, che è il comportamento predefinito).

## 4. Policy di Chrome e di Windows (HKLM)

Da applicare come amministratore. Valgono per tutti gli utenti della macchina.

```bat
set "CP=HKLM\SOFTWARE\Policies\Google\Chrome"
reg add "%CP%" /v DeveloperToolsAvailability /t REG_DWORD /d 2 /f
reg add "%CP%" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f
reg add "%CP%" /v BrowserGuestModeEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v BrowserAddPersonEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v BrowserSignin /t REG_DWORD /d 0 /f
reg add "%CP%" /v SyncDisabled /t REG_DWORD /d 1 /f
reg add "%CP%" /v PasswordManagerEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v AutofillAddressEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v AutofillCreditCardEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v TranslateEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v DefaultPopupsSetting /t REG_DWORD /d 2 /f
reg add "%CP%" /v DefaultNotificationsSetting /t REG_DWORD /d 2 /f
reg add "%CP%" /v DownloadRestrictions /t REG_DWORD /d 3 /f
reg add "%CP%" /v AllowFileSelectionDialogs /t REG_DWORD /d 0 /f
reg add "%CP%" /v PrintingEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v BackgroundModeEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v TaskManagerEndProcessEnabled /t REG_DWORD /d 0 /f
reg add "%CP%" /v AllowDinosaurEasterEgg /t REG_DWORD /d 0 /f
reg delete "%CP%\URLBlocklist" /f
reg delete "%CP%\URLAllowlist" /f
reg add "%CP%\URLBlocklist" /v 1 /t REG_SZ /d "*" /f
reg add "%CP%\URLAllowlist" /v 1 /t REG_SZ /d "URL-DEL-TOTEM" /f
reg add "%CP%\URLAllowlist" /v 2 /t REG_SZ /d "api.pizzerialalanterna.it" /f
:: aggiungi qui solo gli host davvero usati (meteo, tile mappa, font) e nessun CDN generico

reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\EdgeUI" /v AllowEdgeSwipe /t REG_DWORD /d 0 /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices" /v Deny_All /t REG_DWORD /d 1 /f
```

Per le pagine partner in iframe (Turismo, Infiorata, testate locali, Cosmari, Comune) l'allowlist deve includere i loro domini finché restano; la proposta è sostituirle con schede interne e QR.

Aggiornamenti di Chrome: lasciarli attivi e spostarli di notte con le policy di Google Update in `HKLM\SOFTWARE\Policies\Google\Update` (finestra di manutenzione e riavvio automatico). Verifica: `chrome://policy` nella sessione Totem mostra le policy con livello "Macchina" e nessun errore.

Gesture touch: in Impostazioni, Bluetooth e dispositivi, Tocco, spegnere le gesture a tre e quattro dita per l'account Totem. La tastiera touch di Windows non serve: la ricerca usa la tastiera dell'app.

## 5. Avvio, crash, riavvio, aggiornamenti

- BIOS/UEFI: password amministratore, boot solo dal disco interno, avvio da USB disattivato, Secure Boot attivo, "accensione al ritorno della corrente".
- BitLocker sul disco di sistema.
- `powercfg`: sospensione e ibernazione disattivate con alimentazione da rete, schermo sempre acceso (o spento di notte con un'attività pianificata).
- Windows Update: orario di attività sulle ore di apertura, riavvio fuori orario.
- Crash di Chrome: con Shell Launcher si riavvia da solo; con Assigned Access Pro serve una prova sul posto. In ogni caso l'app ricarica l'ultimo catalogo valido senza intervento.
- Avvio dopo un riavvio: autologon del Totem, Chrome parte da Assigned Access o Shell Launcher, l'app recupera i dati. Nessuna console.

## 6. Uscita autorizzata per il personale

- Con tastiera di servizio (portata dal tecnico): Ctrl+Alt+Canc, "Cambia utente", accesso con l'account amministratore.
- Da remoto, se il PC è gestito: Intune o Accesso remoto con account amministratore.
- `exit-kiosk-admin.bat` e gli altri script non devono essere eseguibili dall'utente Totem: spostarli in una cartella leggibile solo dagli amministratori.

## 7. Checklist manuale di collaudo

Da compilare sul totem dopo ogni modifica. Esito: PASS, FAIL o NOT TESTED.

| # | Prova | Atteso |
|---|---|---|
| 1 | Riavvio a freddo | Parte solo il totem a schermo intero, senza desktop visibile |
| 2 | Swipe da ogni bordo, pressione prolungata, pinch, tre e quattro dita | Nessun pannello di sistema, nessuno zoom, nessun menu contestuale |
| 3 | Tastiera USB collegata: Win, Win+D, Win+R, Win+E, Alt+Tab, Ctrl+Esc | Nessuna altra app o desktop |
| 4 | Ctrl+Shift+Esc | Task Manager non disponibile per il Totem |
| 5 | Alt+F4, Ctrl+W, F11, Esc | Chrome resta aperto o si riapre; mai desktop |
| 6 | Ctrl+Alt+Canc | Solo le opzioni previste; accesso admin con password |
| 7 | Chiavetta USB | Non montata per l'utente Totem |
| 8 | Link esterni dentro l'app e dentro gli iframe partner | Bloccati con messaggio, nessuna nuova finestra |
| 9 | Download, stampa (Ctrl+P), DevTools (F12, Ctrl+Shift+I) | Bloccati |
| 10 | `chrome://settings`, `file:///C:/` digitati (con tastiera) | Bloccati dalla policy |
| 11 | Cavo di rete staccato per 5 minuti | Il totem mostra l'ultimo catalogo e l'ora dei dati, poi si riallinea da solo |
| 12 | Corrente staccata e ridata | Si riaccende e torna al totem senza intervento |
| 13 | Approvazione di un'attività dal pannello admin | Compare sul totem senza toccarlo e senza reload |
| 14 | Sospensione di un'attività aperta sul totem | Messaggio chiaro, ritorno all'elenco |
| 15 | 8 ore di funzionamento | Memoria di Chrome stabile, nessun rallentamento |
