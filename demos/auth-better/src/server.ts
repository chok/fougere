/**
 * Fougere Auth Better — full-stack demo.
 *
 * Wires @fougere/auth-better through the central fougere.config.ts, mounts the
 * better-auth handler on Hono, and shows that the same Storage pipeline
 * serves both the auth tables and the app's domain entities.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createApp, frond, type Storage } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { createStorageFactory } from '@fougere/adapter-sql';
import { db } from './db.js';
import { Note, CreateNote, User } from './entities.js';
import config from '../fougere.config.js';

// ─── Boot Fougere ──────────────────────────────────

// Auth tables follow better-auth convention (singular: user, session, account, verification).
// App tables keep the Fougere default (snake_case + plural).
const AUTH_TABLES = new Set(['user', 'session', 'account', 'verification']);
const storageFactory = createStorageFactory(db, {
  tableName: (name) => AUTH_TABLES.has(name) ? name : name.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()) + 's',
});

const app = await createApp({
  createContainer,
  storageFactory,
  db,
  auth: config.auth,
  fronds: [frond('notes', { entities: [User, Note] })],
});

if (!app.auth) throw new Error('auth not initialized');

const noteStorage = app.storageFor('note') as Storage<Note>;

// ─── HTTP layer (Hono) ─────────────────────────────

const hono = new Hono();

// Auth catch-all — better-auth handler wrapped via the AuthRuntime
hono.all('/auth/*', async (c) => {
  const response = await app.auth!.handler(c.req.raw);
  return response;
});

// ─── API ───────────────────────────────────────────

hono.use('/api/*', async (c, next) => {
  const cookie = c.req.header('cookie');
  if (!cookie) return next();
  const result = await (app.auth!.api as any).getSession({ headers: c.req.raw.headers });
  if (result?.session && result?.user) {
    c.set('user', result.user);
    c.set('session', result.session);
  }
  return next();
});

hono.get('/api/me', async (c) => {
  const user = c.get('user' as never) as Record<string, unknown> | undefined;
  if (!user) return c.json({ error: 'Not logged in' }, 401);
  const sessions = await (app.auth!.storages.session as any).findAllBy({ userId: user.id });
  const accounts = await (app.auth!.storages.account as any).findAllBy({ userId: user.id });
  return c.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    activeSessions: sessions.length,
    accounts: accounts.map((a: any) => ({ providerId: a.providerId, accountId: a.accountId })),
  });
});

hono.get('/api/notes', async (c) => {
  const user = c.get('user' as never) as Record<string, unknown> | undefined;
  if (!user) return c.json({ error: 'Not logged in' }, 401);
  const notes = await noteStorage.findAllBy({ userId: user.id });
  return c.json(notes);
});

hono.post('/api/notes', async (c) => {
  const user = c.get('user' as never) as Record<string, unknown> | undefined;
  if (!user) return c.json({ error: 'Not logged in' }, 401);
  const body = await c.req.json();
  const validation = CreateNote.validate(body);
  if (!validation.success) return c.json({ errors: validation.errors }, 400);
  const note = await noteStorage.create({ ...validation.data, userId: user.id as string });
  return c.json(note, 201);
});

hono.delete('/api/notes/:id', async (c) => {
  const user = c.get('user' as never) as Record<string, unknown> | undefined;
  if (!user) return c.json({ error: 'Not logged in' }, 401);
  const id = c.req.param('id');
  const note = await noteStorage.findById(id);
  if (!note || (note as any).userId !== user.id) return c.json({ error: 'Not found' }, 404);
  await noteStorage.delete(id);
  return c.json({ success: true });
});

// ─── Home ──────────────────────────────────────────

hono.get('/', (c) => c.html(HOME_PAGE));

serve({ fetch: hono.fetch, port: 3000 });
console.log(`
  🌿 Fougere Auth Better Demo

  Home:      http://localhost:3000
  Auth API:  http://localhost:3000/auth/*
  User API:  http://localhost:3000/api/me
  Notes API: http://localhost:3000/api/notes

  Routes:
    POST /auth/sign-up/email  { email, password, name }
    POST /auth/sign-in/email  { email, password }
    GET  /auth/get-session
    POST /auth/sign-out
    GET  /api/me
    GET  /api/notes
    POST /api/notes           { title, content? }
    DELETE /api/notes/:id
`);

const HOME_PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Fougere Auth Better</title>
<style>
  body { font-family: system-ui; max-width: 640px; margin: 40px auto; padding: 0 20px; }
  input, button, textarea { padding: 8px 12px; margin: 4px 0; font-size: 14px; }
  input, textarea { width: 100%; box-sizing: border-box; }
  textarea { height: 60px; resize: vertical; }
  button { cursor: pointer; background: #16a34a; color: white; border: none; border-radius: 4px; }
  button:hover { background: #15803d; }
  button.danger { background: #dc2626; } button.danger:hover { background: #b91c1c; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
  .error { color: #dc2626; } .success { color: #16a34a; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  h1 { color: #16a34a; }
  .note { border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center; }
  .note-content { flex: 1; }
  .note-title { font-weight: 600; }
  .note-text { color: #6b7280; font-size: 13px; margin-top: 4px; }
</style>
</head><body>
<h1>Fougere Auth Better Demo</h1>
<p>Single config in <code>fougere.config.ts</code> — no Nitro plugin, no <code>configureAuth()</code>.</p>
<p><code>auth: { provider: 'better', user: User, ... }</code> wires better-auth through Fougere Storage.</p>

<div class="card">
  <h2>Sign up</h2>
  <form id="register">
    <input name="email" placeholder="Email" required>
    <input name="password" type="password" placeholder="Password (min 6)" required>
    <input name="name" placeholder="Name" required>
    <button type="submit">Sign up</button>
  </form>
</div>

<div class="card">
  <h2>Sign in</h2>
  <form id="login">
    <input name="email" placeholder="Email" required>
    <input name="password" type="password" placeholder="Password" required>
    <button type="submit">Sign in</button>
  </form>
</div>

<hr>

<div class="card">
  <h2>Current User</h2>
  <div id="user">Loading...</div>
  <br>
  <button class="danger" onclick="logout()">Sign out</button>
</div>

<div class="card">
  <h2>My Notes</h2>
  <form id="addNote">
    <input name="title" placeholder="Title" required>
    <textarea name="content" placeholder="Content (optional)"></textarea>
    <button type="submit">Add Note</button>
  </form>
  <div id="notes">-</div>
</div>

<div id="result"></div>

<script>
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function show(msg, ok) {
  document.getElementById('result').innerHTML =
    typeof msg === 'string'
      ? '<p class="' + (ok ? 'success' : 'error') + '"><strong>' + msg + '</strong></p>'
      : '<pre>' + JSON.stringify(msg, null, 2) + '</pre>';
}

document.getElementById('register').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await api('POST', '/auth/sign-up/email', Object.fromEntries(fd));
  if (r.status === 200) { show('Signed up + logged in!', true); loadUser(); loadNotes(); }
  else show(r.data?.message || r.data?.error || 'Failed', false);
};

document.getElementById('login').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await api('POST', '/auth/sign-in/email', Object.fromEntries(fd));
  if (r.status === 200) { show('Signed in!', true); loadUser(); loadNotes(); }
  else show(r.data?.message || r.data?.error || 'Failed', false);
};

document.getElementById('addNote').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);
  if (!body.content) delete body.content;
  const r = await api('POST', '/api/notes', body);
  if (r.status === 201) { e.target.reset(); loadNotes(); }
  else show(r.data?.errors || 'Failed', false);
};

async function deleteNote(id) {
  await api('DELETE', '/api/notes/' + id);
  loadNotes();
}

async function logout() {
  await api('POST', '/auth/sign-out');
  show('Signed out', true);
  document.getElementById('user').innerHTML = 'Not logged in';
  document.getElementById('notes').innerHTML = '-';
}

async function loadUser() {
  const r = await api('GET', '/api/me');
  if (r.status === 200 && r.data) {
    document.getElementById('user').innerHTML = '<pre>' + JSON.stringify(r.data, null, 2) + '</pre>';
  } else {
    document.getElementById('user').innerHTML = 'Not logged in';
  }
}

async function loadNotes() {
  const r = await api('GET', '/api/notes');
  if (r.status === 200 && r.data && r.data.length > 0) {
    document.getElementById('notes').innerHTML = r.data.map(n =>
      '<div class="note"><div class="note-content"><div class="note-title">' + n.title + '</div>' +
      (n.content ? '<div class="note-text">' + n.content + '</div>' : '') + '</div>' +
      '<button class="danger" onclick="deleteNote(\\'' + n.id + '\\')">x</button></div>'
    ).join('');
  } else if (r.status === 200) {
    document.getElementById('notes').innerHTML = '<p style="color:#9ca3af">No notes yet</p>';
  }
}

loadUser();
loadNotes();
</script>
</body></html>`;
