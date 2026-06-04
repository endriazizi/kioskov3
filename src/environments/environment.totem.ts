import { KIOSK_LEGACY_SPEAKER_ID_TO_SLUG } from './kiosk-legacy-speaker-slugs';

export const environment = {
  production: false,
  appVersion: '0.0.2',
  apiBaseUrl: 'http://127.0.0.1:3000',
  kioskStrictMode: true,
  kioskAllowTelMailto: false,
  useKioskPublicApi: true,
  kioskFeedVersionPollMs: 30_000,
  kioskFeedHardRefreshMinutes: 10,
  kioskLocalHealthCheckEnabled: true,
  kioskLocalHealthCheckMs: 120_000,
  kioskLocalHealthReloadCooldownMs: 120_000,
  weatherOpenWeatherApiKey: '',
  weatherCity: 'Castelraimondo,it',
  legacySpeakerIdToSlug: KIOSK_LEGACY_SPEAKER_ID_TO_SLUG,
  eventsWhatsAppNumber: '',
  eventsWhatsAppPrefillText: 'Segnala un evento per il calendario comunale: ',
};
