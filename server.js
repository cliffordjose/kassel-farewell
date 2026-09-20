const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'wishes.json');
const PASSWORD_HASH = 'd2f52c93395a5bda41718d53b0eb37ebb68f4e8f5c73d0e75e79f54a711e4b02';
const MEMBERS = new Set(['Clifford', 'Anjitha', 'Nandhana', 'Varsha', 'Justin', 'Sandra Sabu', 'Sandra Sebastian', 'Kripa', 'Naveen', 'Anu', 'Jeffry', 'Aleena']);
const sessions = new Set();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg' };

function send(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v[0])); }
function authorised(req) { return sessions.has(cookies(req).kasselSession); }
async function body(req) { let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 10000) throw new Error('Request too large'); } return JSON.parse(text || '{}'); }
async function wishes() { try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); } catch { return []; } }
async function save(entries) { await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8'); }

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const { password } = await body(req);
      const digest = crypto.createHash('sha256').update(String(password || '')).digest('hex');
      if (digest !== PASSWORD_HASH) return send(res, 401, { error: 'Incorrect password.' });
      const token = crypto.randomBytes(32).toString('hex'); sessions.add(token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': `kasselSession=${token}; HttpOnly; SameSite=Strict; Path=/` });
    }
    if (url.pathname === '/api/wishes') {
      if (!authorised(req)) return send(res, 401, { error: 'Please enter the shared password.' });
      if (req.method === 'GET') return send(res, 200, { wishes: await wishes() });
      if (req.method === 'POST') {
        const { name, text } = await body(req); const clean = String(text || '').trim();
        if (!MEMBERS.has(name) || !clean || clean.length > 700) return send(res, 400, { error: 'Choose a member and enter a message up to 700 characters.' });
        const entries = await wishes(); entries.push({ id: crypto.randomUUID(), name, text: clean, time: new Date().toISOString() }); await save(entries);
        return send(res, 201, { ok: true });
      }
      return send(res, 405, { error: 'Method not allowed.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
    const requested = url.pathname === '/' ? '/kassel-farewell.html' : decodeURIComponent(url.pathname);
    const file = path.resolve(ROOT, `.${requested}`);
    if (!file.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Forbidden.' });
    const content = await fs.readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' }); res.end(content);
  } catch (error) { if (error.code === 'ENOENT') return send(res, 404, { error: 'Not found.' }); send(res, 500, { error: 'Something went wrong.' }); }
}).listen(3000, () => console.log('Kassel site: http://localhost:3000'));
