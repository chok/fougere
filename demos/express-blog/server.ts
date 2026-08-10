/**
 * An Express app that already exists, and the four lines that add Fougere to it.
 *
 * This is the additive case, and it is the only demo in the repo where Fougere is
 * NOT the framework: there is no page, no scan-driven routing, no convention over
 * the app's own structure. `express()` is the server; Fougere is a guest that
 * registers three paths and touches nothing else.
 *
 * The routes below `// ── the app you already had` are deliberately mounted first
 * and deliberately overlap `/api` — they still answer, because Express matches in
 * registration order and the REST projection is a catch-all registered after them.
 */
import express from 'express';
import { createExpressRouter } from '@fougere/http';
import { mountDoors, useFougereApp, invokeOn } from '@fougere/app';
import Post from './fronds/blog/entities/Post.ts';

const app = express();
app.use(express.json());

// ── the app you already had ────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, from: 'the app, not fougere' });
});

app.get('/', async (_req, res) => {
  // A server-side read, named the way every other host names it: class + verb.
  // `invokeOn` takes the app explicitly because Express has no ambient request —
  // which is exactly why this host needs no `invoke` of its own.
  const fougere = await useFougereApp();
  const posts = await invokeOn<Post[]>(fougere, Post, 'list', undefined, {});
  res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>fougere · express</title>
<body style="font-family:system-ui;max-width:720px;margin:2rem auto;line-height:1.55">
<h1>Published</h1>
${posts.map((post) => `<article style="border-bottom:1px solid #eee;padding:.75rem 0">
  <h2 style="font-size:1.05rem;margin:0">${post.title}</h2>
  <p style="margin:.25rem 0;color:#555">${post.body}</p>
  <small style="color:#999">${post.status}</small></article>`).join('')}
<p style="color:#999;margin-top:2rem">Rendered by Express. The data came from a Frond
that has never heard of Express.</p>
</body>`);
});

// ── the four lines that add fougere ────────────────
// `/api/*splat` is Express 5's wildcard spelling. `mountDoors` does not guess it:
// the syntax belongs to the framework, and an adapter that guessed would work on
// one host and silently not on another.
mountDoors(createExpressRouter(app), { restPath: '/api/*splat' });

app.listen(3300, () => {
  console.log('express-blog on http://localhost:3300');
});
