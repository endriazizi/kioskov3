'use strict';

/**
 * Totem `start:totem:prodproxy`:
 * - JSON `/api` → Plesk (feed produzione), identico da localhost e da 192.168.x.x
 * - File poster: disco locale (upload da questo PC) → BE :3000 → Plesk
 *
 * ⚠️ `bypass` viene **atteso** da Vite (`ng serve` Angular 20): se torna `false`
 * Vite risponde subito `404` e chiude il socket. La risposta va quindi completata
 * PRIMA di uscire dalla funzione, altrimenti i file locali arrivano troncati
 * (200 con 0 byte) e il fallback Plesk non fa in tempo a partire.
 * Quando abbiamo già servito il file torniamo `req.url` (stringa): Vite vede
 * `res.writableEnded` e non aggiunge nulla.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

const PLESK = String(process.env.KIOSK_PROXY_PLESK || 'https://api.pizzerialalanterna.it').replace(/\/$/, '');
const LOCAL = String(process.env.KIOSK_PROXY_LOCAL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const LOCAL_UPLOAD_ROOT = path.resolve(__dirname, '..', 'enea_be', 'uploads', 'kiosk-business');
/** Copia su disco i file scaricati da Plesk: il totem li rivede anche con rete/BE giù. */
const CACHE_REMOTE_ON_DISK = String(process.env.KIOSK_PROXY_CACHE_REMOTE || '1') !== '0';

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function reqUrl(req) {
  return String(req.originalUrl || req.url || '');
}

function uploadsRelFromReq(req) {
  const raw = reqUrl(req);
  const noQuery = raw.split('?')[0];
  if (noQuery.startsWith('/uploads/kiosk-business/')) {
    return noQuery.slice('/uploads/kiosk-business/'.length).replace(/\\/g, '/');
  }
  try {
    const u = new URL(raw, 'http://kiosk.local');
    const rel = String(u.searchParams.get('rel') || u.searchParams.get('file') || '').trim();
    if (rel && !rel.includes('..')) return rel.replace(/^\/+/, '');
    const b = String(u.searchParams.get('b') || '').trim();
    const n = String(u.searchParams.get('n') || '').trim();
    if (/^\d+$/.test(b) && n && !n.includes('..') && !n.includes('/') && !n.includes('\\')) {
      return `${b}/${n}`;
    }
  } catch {
    /* ignore */
  }
  return '';
}

function absFromRel(rel) {
  const safe = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!safe || safe.includes('..')) return null;
  const abs = path.resolve(LOCAL_UPLOAD_ROOT, ...safe.split('/').filter(Boolean));
  const root = path.resolve(LOCAL_UPLOAD_ROOT);
  if (!(abs === root || abs.startsWith(`${root}${path.sep}`))) return null;
  return abs;
}

function tryLocalDisk(rel) {
  const abs = absFromRel(rel);
  if (!abs) return null;
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size > 0) return abs;
  } catch {
    return null;
  }
  return null;
}

/** Risolve a `true` solo quando la risposta è chiusa (Vite può uscire senza toccarla). */
function endResponse(res, resolve, ok) {
  if (!res.writableEnded) {
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
  resolve(ok);
}

function sendLocalFile(res, abs) {
  return new Promise((resolve) => {
    const ext = path.extname(abs).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=120',
    };
    try {
      headers['Content-Length'] = String(fs.statSync(abs).size);
    } catch {
      /* senza Content-Length */
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(abs);
    stream.on('error', () => endResponse(res, resolve, true));
    res.on('close', () => resolve(true));
    res.on('finish', () => resolve(true));
    stream.pipe(res);
  });
}

/** Scrive su `enea_be/uploads/kiosk-business/<rel>` una copia del file remoto. */
function cacheStreamOnDisk(upstream, rel) {
  if (!CACHE_REMOTE_ON_DISK || !rel) return;
  const abs = absFromRel(rel);
  if (!abs) return;
  let tmp = '';
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    tmp = path.join(os.tmpdir(), `kiosk-proxy-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const out = fs.createWriteStream(tmp);
    upstream.pipe(out);
    out.on('finish', () => {
      try {
        fs.renameSync(tmp, abs);
      } catch {
        try {
          fs.copyFileSync(tmp, abs);
          fs.unlinkSync(tmp);
        } catch {
          /* cache best-effort */
        }
      }
    });
    out.on('error', () => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* cache best-effort */
  }
}

/** `false` = upstream non ha il file (si prova la sorgente successiva). */
function fetchAndPipe(url, res, cacheRel) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https:') ? https : http;
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const r = lib.get(url, { timeout: 12000 }, (up) => {
      if (Number(up.statusCode || 0) !== 200) {
        up.resume();
        done(false);
        return;
      }
      if (res.headersSent) {
        up.resume();
        done(true);
        return;
      }
      const headers = {
        'Content-Type': up.headers['content-type'] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=120',
      };
      if (up.headers['content-length']) headers['Content-Length'] = up.headers['content-length'];
      res.writeHead(200, headers);
      up.on('error', () => endResponse(res, done, true));
      res.on('close', () => done(true));
      res.on('finish', () => done(true));
      if (cacheRel) {
        const tee = new PassThrough();
        cacheStreamOnDisk(tee, cacheRel);
        tee.pipe(res);
        up.pipe(tee);
      } else {
        up.pipe(res);
      }
    });
    r.on('error', () => done(false));
    r.on('timeout', () => {
      r.destroy();
      done(false);
    });
  });
}

/** Ordine: disco locale → BE locale :3000 → Plesk. `false` = nessuna sorgente ha il file. */
async function serveKioskMedia(req, res) {
  const rel = uploadsRelFromReq(req);
  const disk = rel ? tryLocalDisk(rel) : null;
  if (disk) return sendLocalFile(res, disk);
  const url = reqUrl(req);
  if (await fetchAndPipe(`${LOCAL}${url}`, res, '')) return true;
  return fetchAndPipe(`${PLESK}${url}`, res, rel);
}

function kioskMediaProxy() {
  return {
    target: LOCAL,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
    async bypass(req, res) {
      const served = await serveKioskMedia(req, res);
      if (!served) return false;
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }
      return req.url;
    },
  };
}

module.exports = {
  '/uploads/kiosk-business': kioskMediaProxy(),
  '/api/public-kiosk/media-file': kioskMediaProxy(),
  '/api': {
    target: PLESK,
    secure: true,
    changeOrigin: true,
    logLevel: 'warn',
  },
  '/uploads': {
    target: PLESK,
    secure: true,
    changeOrigin: true,
    logLevel: 'warn',
  },
};
