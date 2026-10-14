// Smoke test del totem /v2 con API pubbliche simulate (nessun backend reale).
// Uso: npx ng build --configuration ci && PW=$(npm root -g)/playwright node scripts/v2-smoke.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');
import http from 'http';
import fs from 'fs';
import path from 'path';

const WWW = path.resolve(process.env.WWW || 'www');
const OUT = path.resolve(process.env.OUT || 'v2-smoke-out');
fs.mkdirSync(OUT, { recursive: true });
const today = new Date(); const iso = (d) => d.toISOString().slice(0, 10);
const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

let businesses = [
  { id: 1, slug: 'bar-centrale', name: 'Bar Centrale', category: 'Bar e caffè', address: 'Piazza Dante 1', phone: '0737 000000', website: 'barcentrale.example.it', about: '<p>Colazioni <b>artigianali</b><script>alert(1)</script></p>', listing_tier: 'premium' },
  { id: 2, slug: 'forno-rossi', name: 'Forno Rossi', category: 'Alimentari', address: 'Via Roma 4' },
  { id: 3, slug: 'hotel-bosco', name: 'Hotel Bosco', category: 'Dormire', address: 'Loc. Bosco' },
];
const events = [
  { id: 10, title: 'Sagra del tartufo', event_date: plus(3), time_label: '18:00', location: 'Piazza' },
  { id: 11, title: 'Evento passato', event_date: plus(-10) },
];
let feed = 'v1';
const api = (u) => {
  const p = u.pathname.replace('/api/public-kiosk/', '');
  if (p === 'home') return { ok: true, idleFullscreen: { enabled: true, timeoutMs: 60000 } };
  if (p === 'businesses') return { ok: true, items: businesses };
  if (p.startsWith('businesses/')) { const b = businesses.find((x) => x.slug === p.split('/')[1]); return b ? { ok: true, data: b } : null; }
  if (p === 'business-categories') return { ok: true, items: ['Bar e caffè', 'Alimentari', 'Dormire', 'Vuota'] };
  if (p === 'events') return { ok: true, items: events };
  if (p === 'banners' || p === 'home-posters') return { ok: true, items: [{ id: 1, image_url: '/assets/img/kiosk-poster-placeholder.svg', business_slug: 'bar-centrale', business_name: 'Bar Centrale', listing_tier: 'premium', status: 'approved', is_active: true }] };
  if (p === 'feed-version') return { ok: true, version: feed };
  return { ok: true, items: [] };
};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const body = api(u);
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(body ?? { ok: false }));
  }
  let f = path.join(WWW, u.pathname);
  if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WWW, 'index.html');
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
// Opzionale: ENEA_BE=<cartella enea-be> monta il vero canale socket del backend su questo server di prova.
let kioskPublic = null;
if (process.env.ENEA_BE) {
  const beRequire = createRequire(path.join(path.resolve(process.env.ENEA_BE), 'package.json'));
  const { Server } = beRequire('socket.io');
  kioskPublic = beRequire('./src/sockets/kiosk-public.js');
  kioskPublic.mount(new Server(server));
}
await new Promise((r) => server.listen(8299, r));

const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const browser = await chromium.launch();
for (const [design, vw, vh] of [['A', 1366, 768], ['B', 1920, 1080], ['B', 1080, 1920]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', (d) => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
  const tag = `${design} ${vw}x${vh}`;
  await page.goto(`http://localhost:8299/v2?design=${design}`);
  await page.waitForSelector('.v2-dock');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/home-${design}-${vw}x${vh}.png` });
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(`${tag} nessuno scroll orizzontale`, noHScroll);
  if (design === 'A') {
    check(`${tag} poster visibile`, await page.locator('.v2-poster img').count() === 1);
    check(`${tag} solo eventi futuri`, (await page.locator('.v2-event-row').count()) === 1);
  } else {
    const cats = await page.locator('.v2-cat').allInnerTexts();
    check(`${tag} categorie senza "Vuota"`, cats.length === 3 && !cats.join().includes('Vuota'), JSON.stringify(cats));
  }
  // Elenco + filtro
  await page.goto(`http://localhost:8299/v2/attivita?cat=Alimentari`);
  await page.waitForSelector('.v2-card');
  check(`${tag} filtro categoria`, (await page.locator('.v2-card').count()) === 1);
  // Scheda
  await page.goto(`http://localhost:8299/v2/attivita/bar-centrale`);
  await page.waitForSelector('.v2-qr img', { timeout: 5000 }).catch(() => {});
  check(`${tag} scheda con QR`, (await page.locator('.v2-qr img').count()) === 1);
  check(`${tag} script rimosso dalla prosa`, (await page.locator('.v2-prose script').count()) === 0);
  if (vw === 1366) await page.screenshot({ path: `${OUT}/detail-${design}.png` });
  // Ritiro in tempo reale: l'admin sospende l'attività aperta
  const saved = businesses;
  businesses = businesses.filter((b) => b.slug !== 'bar-centrale');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.v2-gone', { timeout: 5000 }).catch(() => {});
  check(`${tag} scheda chiusa dopo ritiro senza refresh`, (await page.locator('.v2-gone').count()) === 1);
  // Nuova attività approvata: compare senza ricaricare
  businesses = [...saved, { id: 4, slug: 'nuova-osteria', name: 'Nuova Osteria', category: 'Alimentari' }];
  await page.goto(`http://localhost:8299/v2/attivita`);
  await page.waitForSelector('.v2-card');
  businesses = [...saved];
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(800);
  const before = await page.locator('.v2-card').count();
  businesses = [...saved, { id: 4, slug: 'nuova-osteria', name: 'Nuova Osteria', category: 'Alimentari' }];
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.v2-badge', { timeout: 5000 }).catch(() => {});
  const after = await page.locator('.v2-card').count();
  check(`${tag} nuova attività senza refresh`, after === before + 1 && (await page.locator('.v2-badge').count()) === 1, `${before}->${after}`);
  check(`${tag} avviso a schermo`, (await page.locator('.v2-toast').count()) === 1);
  if (vw === 1366) await page.screenshot({ path: `${OUT}/new-${design}.png` });
  businesses = saved;
  // Ricerca con tastiera a schermo
  await page.click('.v2-dock a[href="/v2/cerca"]');
  await page.waitForSelector('.v2-kb');
  for (const k of ['F', 'O', 'R']) await page.click(`.v2-key:text-is("${k}")`);
  await page.waitForTimeout(200);
  check(`${tag} ricerca da tastiera`, (await page.locator('.v2-card').count()) === 1);
  await page.screenshot({ path: `${OUT}/search-${design}-${vw}x${vh}.png` });
  // Backend giù: resta l'ultimo catalogo
  await page.route('**/api/public-kiosk/**', (r) => r.abort());
  await page.click('.v2-dock a[href="/v2/attivita"]');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.v2-chip.off', { timeout: 5000 }).catch(() => {});
  check(`${tag} offline mantiene i dati`, (await page.locator('.v2-chip.off').count()) === 1 && (await page.locator('.v2-card').count()) >= 3);
  await page.unroute('**/api/public-kiosk/**');
  const realErrs = errs.filter((e) => !/Failed to load resource|ERR_FAILED|net::/.test(e));
  check(`${tag} nessun errore console`, realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
  await ctx.close();
}
// Idle: timeout corto dal backend
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.route('**/api/public-kiosk/home', (r) => r.fulfill({ json: { ok: true, idleFullscreen: { enabled: true, timeoutMs: 5000 } } }));
  await page.goto('http://localhost:8299/v2/cerca?design=A');
  await page.waitForSelector('.v2-kb');
  await page.click('.v2-key:text-is("B")');
  await page.waitForTimeout(7500);
  const url1 = page.url();
  const q = await page.evaluate(() => document.querySelector('.v2-kb') ? 'kb' : 'no-kb');
  check('idle: torna alla Home e azzera la ricerca', new URL(url1).pathname === '/v2' && q === 'no-kb', url1);
  await page.waitForTimeout(6500);
  check('idle: poi schermata di benvenuto', (await page.locator('.v2-attract').count()) === 1);
  await page.screenshot({ path: OUT + '/attract.png' });
  await ctx.close();
}
// Realtime: l'admin approva e il totem aggiorna senza polling né eventi del browser
if (kioskPublic) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8299/v2/attivita?design=A');
  await page.waitForSelector('.v2-card');
  await page.waitForSelector('.v2-chip.live', { timeout: 8000 }).catch(() => {});
  check('realtime: chip In diretta', (await page.locator('.v2-chip.live').count()) === 1);
  const before = await page.locator('.v2-card').count();
  const saved = businesses;
  businesses = [...saved, { id: 5, slug: 'pizzeria-live', name: 'Pizzeria Live', category: 'Alimentari' }];
  const t0 = Date.now();
  kioskPublic.notifyCatalogChanged('admin:businesses');
  await page.waitForFunction((n) => document.querySelectorAll('.v2-card').length === n + 1, before, { timeout: 8000 }).catch(() => {});
  const ms = Date.now() - t0;
  check('realtime: nuova attività via socket', (await page.locator('.v2-card').count()) === before + 1, `${ms} ms`);
  businesses = saved;
  await ctx.close();
}
await browser.close();
server.close();
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
