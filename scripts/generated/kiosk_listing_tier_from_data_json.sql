-- kiosk_businesses.listing_tier da kioskov3/src/assets/data/data.json
-- Premium: slug presente in array `speakers` o `map` (unici). Altre righe: free.
-- NON eseguire alla cieca: verifica in staging e fai backup.

START TRANSACTION;

UPDATE `kiosk_businesses` SET `listing_tier` = 'free';

UPDATE `kiosk_businesses` SET `listing_tier` = 'premium'
WHERE `slug` IN (
  'agos',
  'bar-leclissi',
  'borgo-lanciano-relais',
  'castello-di-lanciano',
  'chiesa-san-biagio',
  'conad-city',
  'gelateria-carnevali',
  'gelateria-centrale',
  'hotel-bellavista',
  'hotel-le-magnolie',
  'hotel-panorama-crispiero',
  'la-lanterna',
  'ludwig',
  'museo-costume-folcloristico',
  'pizza-el-pedro',
  'ristorante-nuovo-mondo',
  'tabaccheria-cerqueti',
  'torre-del-cassero'
);

COMMIT;
