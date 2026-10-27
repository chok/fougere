/**
 * The app as an Express middleware.
 *
 * What is pinned is mostly what it DOESN'T do: a middleware that answers a path it was not asked for
 * is worse than no middleware, because the app it was added to stops working. `next()` is the whole
 * contract. Nothing imports express — a plain `node:http` server hands the middleware what Express
 * would, the request the parsers left behind included.
 */
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { entity, json, primary, text } from '@fougere/schema';
import { Collector, frond, type InvocationContext } from '@fougere/core';
import { fougere } from '../src/express.js';
import { configureFougere, useFougereApp } from '../src/boot.js';

class Member extends entity({ id: primary(), name: text() }) {}
class MemberCollector extends Collector(Member) {
  async collect(context: InvocationContext) { return context.state.user; }
}
class CallerHandler {
  async who(member?: unknown) { return member ?? null; }
}
/** What an auth package declares a signed-in call carries — `betterAuth()` does the same. */
const desk = frond('desk', {
  extensions: [{ name: 'members', state: { user: json(Member) } }],
  collectors: [MemberCollector],
  handlers: [{ ctor: CallerHandler, operations: { who: { params: { member: { type: Member, optional: true } }, output: Member } } }],
});

let server: Server;
let base: string;

/** Before the middleware: what an auth middleware or `express.json()` would have put on the request. */
let before: (req: IncomingMessage & Record<string, unknown>) => void = () => {};

beforeAll(async () => {
  configureFougere({ fronds: [desk], storage: { storageFactory: () => ({}) as never } });
  await useFougereApp();
  server = createServer((req, res) => {
    before(req as never);
    fougere()(req, res, (err?: unknown) => {
      res.writeHead(err ? 500 : 299).end(err ? String(err) : 'next');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(() => new Promise<void>((done) => server.close(() => done())));

describe('what the middleware declines', () => {
  it('passes a path that is not its own', async () => {
    expect((await fetch(`${base}/other`, { method: 'POST' })).status).toBe(299);
  });

  it('passes the envelope on the wrong verb', async () => {
    expect((await fetch(`${base}/_fougere/call`)).status).toBe(299);
  });

  it('passes anything outside the REST mount point', async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(299);
  });
});

describe('who the caller is', () => {
  const who = async () => (await (await fetch(`${base}/_fougere/call`, {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'caller.who', params: {} }),
  })).json() as { result: unknown }).result;

  it('is what an auth middleware put on the request', async () => {
    before = (req) => { req.user = { id: 'u1', name: 'Ada' }; };
    expect(await who()).toEqual({ id: 'u1', name: 'Ada' });
  });

  it('reads `req.fougereState` when the app fills it', async () => {
    before = (req) => { req.fougereState = { user: { id: 'u2', name: 'Grace' } }; };
    expect(await who()).toEqual({ id: 'u2', name: 'Grace' });
  });

  it('is nobody when nothing ran before the middleware', async () => {
    before = () => {};
    expect(await who()).toBeNull();
  });
});

describe('a body a parser already read', () => {
  it('reaches the envelope as what the parser made of it', async () => {
    before = (req) => { req.body = { jsonrpc: '2.0', id: 3, method: 'nothing.here', params: {} }; req.resume(); };
    const response = await fetch(`${base}/_fougere/call`, { method: 'POST', body: 'already read' });

    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 3, error: {} });
  });
});
