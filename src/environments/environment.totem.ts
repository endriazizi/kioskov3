import { KIOSK_LEGACY_SPEAKER_ID_TO_SLUG } from './kiosk-legacy-speaker-slugs';

export const environment = {
  production: false,
  appVersion: '0.0.2',
  apiBaseUrl: 'http://127.0.0.1:3000',
  kioskStrictMode: true,
  kioskAllowTelMailto: true,
  useKioskPublicApi: true,
  kioskFeedVersionPollMs: 30_000,
  kioskFeedHardRefreshMinutes: 10,
  weatherOpenWeatherApiKey: '',
  weatherCity: 'Castelraimondo,it',
  legacySpeakerIdToSlug: KIOSK_LEGACY_SPEAKER_ID_TO_SLUG,
  eventsWhatsAppNumber: '',
  eventsWhatsAppPrefillText: 'Segnala un evento per il calendario comunale: ',
};
