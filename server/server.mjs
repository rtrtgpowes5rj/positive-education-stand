// Сервер стенда: раздаёт собранную игру (dist/) и общий топ для всех планшетов в зале.
// Без внешних зависимостей, Node 20+.  Запуск: node server/server.mjs
//
// Переменные окружения:
//   PORT                 порт (по умолчанию 8080)
//   HOST                 адрес (по умолчанию 0.0.0.0)
//   DATA_DIR             где лежит таблица board.json и резервные копии (по умолчанию ./data)
//   STATIC_DIR           собранная игра (по умолчанию ./dist)
//   ADMIN_PASSWORD_HASH  отпечаток пароля демо-режима: node server/hash-password.mjs '<пароль>'
//   TRUST_PROXY=1        брать IP клиента из X-Forwarded-For (за nginx/Caddy)
//   CORS_ORIGIN          разрешённый источник, если игра открыта с другого домена (обычно не нужно)
//
// API (всё под /api):
//   GET  /api/health                 {ok, count}
//   GET  /api/board                  {rev, list}
//   GET  /api/stream                 SSE: событие rev при каждом изменении таблицы
//   POST /api/records                {name, score, secs, at} — результат смены
//   POST /api/admin/login            {password} → {token, expiresIn}
//   POST /api/admin/logout | clear | seed {rows} | remove {at}   — с заголовком Authorization: Bearer <token>
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080), HOST = process.env.HOST || '0.0.0.0';
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const STATIC = path.resolve(process.env.STATIC_DIR || path.join(ROOT, 'dist'));
const HASH = (process.env.ADMIN_PASSWORD_HASH || '').trim();
const TRUST_PROXY = process.env.TRUST_PROXY === '1', CORS = process.env.CORS_ORIGIN || '';
const MAX = 20000, TOKEN_TTL = 12 * 3600;
if (!HASH) console.warn('[stand] ADMIN_PASSWORD_HASH не задан: демо-режим и очистка топа на сервере недоступны');

// ---------- таблица ----------
const FILE = path.join(DATA, 'board.json');
fs.mkdirSync(path.join(DATA, 'backup'), {recursive: true});
const cmp = (a, b) => b.score - a.score || a.secs - b.secs || a.at - b.at;
const nickKey = s => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
let board = [], rev = Date.now();
try { board = JSON.parse(fs.readFileSync(FILE, 'utf8')).filter(x => x && x.name && Number.isFinite(x.score)).sort(cmp); } catch (e) { if (e.code !== 'ENOENT') { console.error('[stand] board.json не читается, начинаю с пустой таблицы', e.message); fs.copyFileSync(FILE, FILE + '.broken-' + Date.now()); } }
console.log(`[stand] в таблице ${board.length} записей, данные: ${DATA}`);

let saving = null, dirty = false;
async function persist() {
  if (saving) { dirty = true; return saving; }
  saving = (async () => {
    do {
      dirty = false;
      const tmp = FILE + '.tmp';
      await fsp.writeFile(tmp, JSON.stringify(board));
      await fsp.rename(tmp, FILE);   // атомарная замена: файл не бывает наполовину записан
    } while (dirty);
  })().finally(() => { saving = null; });
  return saving;
}
// ежечасная копия + копия перед очисткой: случайную очистку можно откатить
async function backup(tag) {
  const name = `board-${new Date().toISOString().replace(/[:.]/g, '-')}${tag ? '-' + tag : ''}.json`;
  await fsp.writeFile(path.join(DATA, 'backup', name), JSON.stringify(board));
  const all = (await fsp.readdir(path.join(DATA, 'backup'))).filter(f => f.endsWith('.json')).sort();
  for (const f of all.slice(0, Math.max(0, all.length - 200))) await fsp.unlink(path.join(DATA, 'backup', f)).catch(() => {});
}
setInterval(() => { if (board.length) backup('hourly').catch(e => console.error(e)); }, 3600e3).unref();

const changed = () => { rev = Math.max(rev + 1, Date.now()); persist().catch(e => console.error('[stand] запись не удалась', e)); for (const c of clients) c.write(`event: rev\ndata: ${rev}\n\n`); };

function upsert(rec) {
  const k = nickKey(rec.name), same = board.find(x => nickKey(x.name) === k);
  if (same && cmp(same, rec) < 0) return {at: same.at, place: board.indexOf(same) + 1, kept: same.score};
  while (board.some(x => x.at === rec.at && x !== same)) rec.at++;   // at — ключ записи
  board = [...board.filter(x => x !== same), rec].sort(cmp).slice(0, MAX);
  changed();
  return {at: rec.at, place: board.findIndex(x => x.at === rec.at) + 1};
}
const NICK = /^[\p{L}\p{N} _.\-]{2,14}$/u;
function valid(r, fake = false) {
  if (!r || typeof r !== 'object') return null;
  const name = String(r.name || '').trim().replace(/\s+/g, ' ');
  const score = Math.round(+r.score), secs = Math.round(+r.secs * 10) / 10, now = Date.now();
  let at = Math.round(+r.at);
  if (!NICK.test(name) || !Number.isFinite(score) || score < 0 || score > 50000 || !Number.isFinite(secs) || secs < 0 || secs > 86400) return null;
  if (!Number.isFinite(at) || Math.abs(at - now) > 7 * 86400e3) at = now;   // часы планшета могут врать
  return fake ? {name, score, secs, at, fake: true} : {name, score, secs, at};
}

// ---------- защита ----------
const ip = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
const hits = new Map();   // простое ограничение частоты по IP
function limited(key, max, windowMs) {
  const now = Date.now(), h = hits.get(key) || {n: 0, t: now};
  if (now - h.t > windowMs) { h.n = 0; h.t = now; }
  h.n++; hits.set(key, h); return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h.t > 3600e3) hits.delete(k); }, 600e3).unref();
const fails = new Map(); let globalFails = [];
function checkPassword(pw) {
  // формат: scrypt:N:r:p:salt(hex):hash(hex) — без $, чтобы Docker Compose и оболочка ничего не подставляли
  const [kind, N, r, p, salt, hex] = HASH.split(':');
  if (kind !== 'scrypt' || !hex) return false;
  const want = Buffer.from(hex, 'hex');
  const got = crypto.scryptSync(String(pw).normalize('NFC'), Buffer.from(salt, 'hex'), want.length, {N: +N, r: +r, p: +p, maxmem: 256 * 1024 * 1024});
  return crypto.timingSafeEqual(got, want);
}
const tokens = new Map();
const authed = req => { const t = String(req.headers.authorization || '').replace(/^Bearer\s+/, ''); const exp = tokens.get(t); if (!exp) return false; if (exp < Date.now()) { tokens.delete(t); return false; } return true; };

// ---------- HTTP ----------
const send = (res, code, obj, req) => {
  let body = Buffer.from(JSON.stringify(obj));
  const h = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'};
  if (req && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; }
  res.writeHead(code, h); res.end(body);
};
const readJson = req => new Promise((ok, bad) => {
  let n = 0, chunks = [];
  req.on('data', c => { n += c.length; if (n > 2e6) { bad(Object.assign(new Error('too big'), {code: 413})); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { bad(Object.assign(e, {code: 400})); } });
  req.on('error', bad);
});
const clients = new Set();

async function api(req, res, p) {
  const m = req.method, who = ip(req);
  if (p === 'health' && m === 'GET') return send(res, 200, {ok: true, count: board.length, admin: !!HASH});
  if (p === 'board' && m === 'GET') return send(res, 200, {rev, list: board}, req);
  if (p === 'stream' && m === 'GET') {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'});
    res.write(`retry: 3000\nevent: rev\ndata: ${rev}\n\n`); clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (m !== 'POST') return send(res, 404, {error: 'not found'});
  if (limited('post:' + who, 120, 60e3)) return send(res, 429, {error: 'too many requests'});
  const body = await readJson(req);
  if (p === 'records') {
    const r = valid(body); if (!r) return send(res, 400, {error: 'bad record'});
    return send(res, 200, upsert(r));
  }
  if (p === 'admin/login') {
    if (!HASH) return send(res, 503, {error: 'admin disabled'});
    const now = Date.now(); globalFails = globalFails.filter(t => now - t < 15 * 60e3);
    const f = (fails.get(who) || []).filter(t => now - t < 15 * 60e3);
    if (f.length >= 5 || globalFails.length >= 30) return send(res, 429, {error: 'locked'});
    if (!checkPassword(body.password || '')) { f.push(now); fails.set(who, f); globalFails.push(now); console.warn(`[stand] неверный пароль с ${who}`); return send(res, 401, {error: 'wrong password'}); }
    fails.delete(who);
    const token = crypto.randomBytes(32).toString('hex'); tokens.set(token, now + TOKEN_TTL * 1000);
    console.log(`[stand] вход в демо-режим с ${who}`);
    return send(res, 200, {token, expiresIn: TOKEN_TTL});
  }
  if (p.startsWith('admin/')) {
    if (!authed(req)) return send(res, 401, {error: 'auth required'});
    if (p === 'admin/logout') { tokens.delete(String(req.headers.authorization).replace(/^Bearer\s+/, '')); return send(res, 200, {ok: true}); }
    if (p === 'admin/clear') { await backup('before-clear'); board = []; changed(); console.log(`[stand] топ очищен с ${who}`); return send(res, 200, {ok: true}); }
    if (p === 'admin/remove') { const at = +body.at; const n = board.length; board = board.filter(x => x.at !== at); if (board.length !== n) changed(); return send(res, 200, {ok: true}); }
    if (p === 'admin/seed') {
      const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 200).map(r => valid(r, true)).filter(Boolean);
      const real = board.filter(x => !x.fake);
      const add = rows.filter(r => !real.some(x => nickKey(x.name) === nickKey(r.name)));
      board = [...real, ...add].sort(cmp).slice(0, MAX); changed();
      return send(res, 200, {ok: true, added: add.length});
    }
  }
  return send(res, 404, {error: 'not found'});
}

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm'};
const ZIP = /\.(html|js|css|json|svg|glb|webmanifest|txt)$/;
const gzCache = new Map();
async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(STATIC, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(STATIC)) { res.writeHead(403); return res.end(); }
  let st; try { st = await fsp.stat(file); } catch (e) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); return res.end('Not found'); }
  if (st.isDirectory()) { res.writeHead(301, {Location: url.pathname + '/'}); return res.end(); }
  const ext = path.extname(file).toLowerCase(), h = {'Content-Type': TYPES[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff'};
  // файлы из assets/ с хешем в имени не меняются — кэш на год; остальное проверяется каждый раз
  h['Cache-Control'] = /[\\/]assets[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
  h['Last-Modified'] = st.mtime.toUTCString();
  if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) { res.writeHead(304, h); return res.end(); }
  if (ZIP.test(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const key = file + ':' + st.mtimeMs; let gz = gzCache.get(key);
    if (!gz) { gz = zlib.gzipSync(await fsp.readFile(file), {level: 9}); gzCache.set(key, gz); }
    h['Content-Encoding'] = 'gzip'; h['Content-Length'] = gz.length; h.Vary = 'Accept-Encoding';
    res.writeHead(200, h); return res.end(req.method === 'HEAD' ? undefined : gz);
  }
  h['Content-Length'] = st.size; res.writeHead(200, h);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (CORS) { res.setHeader('Access-Control-Allow-Origin', CORS); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); } }
  try {
    // /api/... в любом подкаталоге: игра может жить не в корне домена
    const m = url.pathname.match(/\/api\/(.+)$/);
    if (m) return await api(req, res, m[1].replace(/\/+$/, ''));
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return await serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, {error: e.code === 400 ? 'bad json' : 'server error'});
    if (!e.code) console.error('[stand]', e);
  }
});
server.keepAliveTimeout = 65000;
server.listen(PORT, HOST, () => console.log(`[stand] http://${HOST}:${PORT}  (игра: ${STATIC})`));
const stop = async () => { console.log('[stand] остановка, сохраняю таблицу'); for (const c of clients) c.end(); server.close(); await persist().catch(() => {}); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
