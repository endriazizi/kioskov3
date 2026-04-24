/**
 * Allineato a `src/assets/data/data.json` → ogni `speakers[]` ha `id` (legacy totem) e `slug` (pubblico API / DB).
 * Usato per deep link `/speaker-details/:speakerId` → GET `/api/public-kiosk/businesses/:slug`.
 */
export const KIOSK_LEGACY_SPEAKER_ID_TO_SLUG: Record<string, string> = {
  '1': 'agos',
  '2': 'ludwig',
  '3': 'bar-leclissi',
  '4': 'gelateria-carnevali',
  '5': 'tabaccheria-cerqueti',
  '6': 'ristorante-nuovo-mondo',
  '7': 'gelateria-centrale',
  '8': 'pizza-el-pedro',
  '10': 'conad-city',
  '11': 'la-lanterna',
  '12': 'torre-del-cassero',
  '13': 'museo-costume-folcloristico',
  '14': 'chiesa-san-biagio',
  '15': 'castello-di-lanciano',
  '16': 'hotel-bellavista',
  '17': 'hotel-panorama-crispiero',
  '18': 'hotel-le-magnolie',
  '19': 'borgo-lanciano-relais',
};
