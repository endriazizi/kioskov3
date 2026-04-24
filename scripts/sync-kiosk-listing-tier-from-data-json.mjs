/**
 * Genera SQL per allineare `kiosk_businesses.listing_tier` al file data del totem:
 * - `premium` → righe il cui `slug` compare in `speakers` o `map` nel JSON (insieme unico, slug normalizzati in minuscolo).
 * - `free` → tutte le altre righe della tabella.
 *
 * Uso:
 *   node scripts/sync-kiosk-listing-tier-from-data-json.mjs
 *   node scripts/sync-kiosk-listing-tier-from-data-json.mjs --json path/to/data.json
 *   node scripts/sync-kiosk-listing-tier-from-data-json.mjs --write   # salva anche il file .sql generato
 *
 * Esecuzione SQL (dopo revisione): mysql ... < scripts/generated/kiosk_listing_tier_from_data_json.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sqlStringLiteral(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/** @param {unknown} data */
function collectSlugsFromDataJson(data) {
  const set = new Set();
  if (!data || typeof data !== 'object') return [];

  for (const key of ['speakers', 'map']) {
    const arr = /** @type {unknown} */ (data)[key];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      const slug = /** @type {{ slug?: unknown }} */ (row).slug;
      if (typeof slug !== 'string') continue;
      const t = slug.trim().toLowerCase();
      if (t) set.add(t);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function buildSql(slugs) {
  const lines = [
    '-- kiosk_businesses.listing_tier da kioskov3/src/assets/data/data.json',
    '-- Premium: slug presente in array `speakers` o `map` (unici). Altre righe: free.',
    '-- NON eseguire alla cieca: verifica in staging e fai backup.',
    '',
    'START TRANSACTION;',
    '',
    "UPDATE `kiosk_businesses` SET `listing_tier` = 'free';",
    '',
  ];

  if (slugs.length === 0) {
    lines.push('-- Nessuno slug nel JSON: tutte le attività restano free (solo primo UPDATE).');
  } else {
    const list = slugs.map((s) => `  ${sqlStringLiteral(s)}`).join(',\n');
    lines.push("UPDATE `kiosk_businesses` SET `listing_tier` = 'premium'");
    lines.push('WHERE `slug` IN (');
    lines.push(list);
    lines.push(');');
  }

  lines.push('');
  lines.push('COMMIT;');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  let jsonPath = path.join(__dirname, '..', 'src', 'assets', 'data', 'data.json');
  const ji = args.indexOf('--json');
  if (ji !== -1 && args[ji + 1]) jsonPath = path.resolve(args[ji + 1]);

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const slugs = collectSlugsFromDataJson(data);
  const sql = buildSql(slugs);

  process.stdout.write(sql + '\n');

  if (write) {
    const outDir = path.join(__dirname, 'generated');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'kiosk_listing_tier_from_data_json.sql');
    fs.writeFileSync(outFile, sql + '\n', 'utf8');
    process.stderr.write(`\nScritto: ${outFile}\nSlug premium (${slugs.length}): ${slugs.join(', ')}\n`);
  } else {
    process.stderr.write(`\nSlug premium (${slugs.length}): ${slugs.join(', ')}\n`);
    process.stderr.write('Aggiungi --write per salvare scripts/generated/kiosk_listing_tier_from_data_json.sql\n');
  }
}

main();
