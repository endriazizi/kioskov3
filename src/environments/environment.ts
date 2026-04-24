// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.
import { KIOSK_LEGACY_SPEAKER_ID_TO_SLUG } from './kiosk-legacy-speaker-slugs';

export const environment = {
  production: false,
  /** Bump su deploy (allineare a package.json o script bump). */
  appVersion: '0.0.2',
  /**
   * Base URL API (senza slash finale). Vuoto = stesso origin → in dev serve **proxy** `proxy.conf.json`
   * verso Node (es. 127.0.0.1:3000) così `/api/public-kiosk/*` raggiunge `enea_be`.
   */
  apiBaseUrl: 'http://127.0.0.1:3000',
  /** Se true, nessuna navigazione http/https verso host esterni (solo app + tel/mail opzionali). */
  kioskStrictMode: true,
  /** In strict mode: consenti tel: e mailto: (azioni “sicure” sul dispositivo). */
  kioskAllowTelMailto: true,
  /** Se false, salta le chiamate /api/public-kiosk/* e usa solo assets/data/data.json. */
  useKioskPublicApi: true,
  /**
   * OpenWeatherMap API key (opzionale). Se valorizzata, ha priorità su Open-Meteo.
   * Se vuota, la home usa Open-Meteo (nessuna chiave; geocoding + previsione pubblici).
   */
  weatherOpenWeatherApiKey: '',
  /** Città (es. Castelraimondo,it): usata da OpenWeather come `q` e da Open-Meteo come nome per il geocoding. */
  weatherCity: 'Castelraimondo,it',
  /**
   * Id legacy in `data.json` (`speakers[].id`) → slug pubblico (`speakers[].slug`) usato dall’API kiosk.
   */
  legacySpeakerIdToSlug: KIOSK_LEGACY_SPEAKER_ID_TO_SLUG,
  /**
   * Numero WhatsApp (solo cifre, con prefisso paese es. 393xxxxxxxxxx) per QR “segnala evento” in tab Eventi.
   * Vuoto = nessun QR (configurare in deploy).
   */
  eventsWhatsAppNumber: '',
  /** Testo precompilato nel link wa.me (opzionale). */
  eventsWhatsAppPrefillText: 'Segnala un evento per il calendario comunale: ',
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
