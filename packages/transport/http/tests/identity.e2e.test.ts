/**
 * The split hole, closed over real HTTP.
 *
 * A receiver used to take the `state` it was handed: identity read straight off the
 * wire, with the loopback default as its only protection. These tests post the exact
 * payload that used to work and watch it be refused — then post the signed one and
 * watch the same call go through.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  EMPTY_INVOCATION,
  signEnvelope,
  verifyEnvelope,
  type Transport,
  type FrondIdentity,
} from '@fougere/core';
import { generateKeyPair, issueGrant } from '@fougere/core/node';
import { createHttpTransport, serve } from '../src/index.js';
import type { RunningReceiver } from '../src/index.js';

/** The handler's whole job here: report what it was told, and who it was told it by. */
const runner: Transport = async (_call, invocation) => ({
  state: invocation.state,
  caller: invocation.caller,
});

/** What `fougere keys issue <name>` produces, and what a deployment injects. */
function issue(rootPrivateKey: string, name: string): FrondIdentity {
  const pair = generateKeyPair();
  return { privateKey: pair.privateKey, grant: issueGrant(rootPrivateKey, name, pair.publicKey) };
}

const root = generateKeyPair();
const app = issue(root.privateKey, 'app');

let receiver: RunningReceiver;
let base: string;

beforeAll(async () => {
  receiver = await serve(runner, {
    // The receiver holds the root public key and nothing else — no list of callers.
    verify: (identity, presented) => verifyEnvelope(identity, root.publicKey, presented),
    requireIdentity: true,
  });
  base = `http://127.0.0.1:${receiver.port}`;
});
afterAll(async () => {
  await receiver.close();
});

/** Post straight to the wire, the way anything that is not a Fougere sender would. */
async function post(params: unknown): Promise<{ result?: unknown; error?: { data?: { code?: string } } }> {
  const res = await fetch(`${base}/_fougere/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'post.list', params }),
  });
  return res.json() as Promise<{ result?: unknown; error?: { data?: { code?: string } } }>;
}

describe('a receiver that establishes its caller', () => {
  it('refuses the payload that used to make a reader an admin', async () => {
    const answer = await post({
      params: {},
      query: {},
      state: { user: { id: 'mallory', role: 'admin' } },
    });

    expect(answer.result).toBeUndefined();
    expect(answer.error?.data?.code).toBe('UNAUTHORIZED');
  });

  it('refuses a call carrying nothing at all', async () => {
    expect((await post({ params: {}, query: {}, state: {} })).error?.data?.code).toBe('UNAUTHORIZED');
  });

  it('lets a signed call through, and the state arrives as signed', async () => {
    const transport = createHttpTransport(base, { sign: (call) => signEnvelope(app, call) });
    const state = await transport(
      { entity: 'post', op: 'list' },
      { ...EMPTY_INVOCATION, state: { user: { id: 'alice', role: 'reader' } } },
    );

    expect(state).toEqual({ state: { user: { id: 'alice', role: 'reader' } }, caller: 'app' });
  });

  it('carries an anonymous call — nobody is signed in and it still passes', async () => {
    // The correction that matters: a visitor listing posts has no user, and the call
    // must go through anyway. It is the PEER that is always present, not the user.
    const transport = createHttpTransport(base, { sign: (call) => signEnvelope(app, call) });

    expect(await transport({ entity: 'post', op: 'list' }, EMPTY_INVOCATION)).toEqual({ state: {}, caller: 'app' });
  });

  it('refuses a frond signed by another root — a parallel system, valid throughout', async () => {
    const outsider = generateKeyPair();
    const impostor = issue(outsider.privateKey, 'app');
    const transport = createHttpTransport(base, { sign: (call) => signEnvelope(impostor, call) });

    await expect(transport({ entity: 'post', op: 'list' }, EMPTY_INVOCATION)).rejects.toThrow(/grant signature/);
  });

  it('drops a claimed state when a signed one travels beside it', async () => {
    // Belt and braces: the sender blanks `state`, but a hand-rolled client need not.
    // What is verified wins, and the claim never reaches a handler.
    const answer = await post({
      params: {},
      query: {},
      state: { user: { role: 'admin' } },
      identity: await signEnvelope(app, { entity: 'post', op: 'list', state: { user: { role: 'reader' } } }),
    });

    expect(answer.result).toEqual({ state: { user: { role: 'reader' } }, caller: 'app' });
  });

  it('names the LAST hop, never the first', async () => {
    // `shop → catalog → billing`: what billing must read is catalog. A sender that
    // spread its own invocation would forward the name it was handed.
    const transport = createHttpTransport(base, { sign: (call) => signEnvelope(app, call) });
    const relayed = await transport(
      { entity: 'post', op: 'list' },
      { ...EMPTY_INVOCATION, caller: 'shop' },
    );

    expect(relayed).toEqual({ state: {}, caller: 'app' });
  });
});

describe('a receiver that establishes nothing', () => {
  // No verifier wired — the laptop case, and the one where a claim used to pass for a
  // proof. `state` is taken as given here BY DESIGN; what must not happen is a claimed
  // name reading downstream like an established one.
  let open: RunningReceiver;
  let openBase: string;

  const ask = async (params: unknown) => {
    const res = await fetch(`${openBase}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'post.list', params }),
    });
    return (await res.json()) as { result: { state: unknown; caller?: string } };
  };

  beforeAll(async () => {
    open = await serve(runner);
    openBase = `http://127.0.0.1:${open.port}`;
  });
  afterAll(async () => {
    await open.close();
  });

  it('leaves `caller` absent even when the payload names one', async () => {
    // The flaw a peer session caught, at its own address: as a key of `state` this name
    // survived a receiver with no verifier and was indistinguishable from a proven one.
    const answer = await ask({ params: {}, query: {}, state: { user: { role: 'reader' } }, caller: 'billing' });

    // The state IS taken — nothing here validates it — but the name is not.
    expect(answer.result.state).toEqual({ user: { role: 'reader' } });
    expect(answer.result.caller).toBeUndefined();
  });

  it('leaves it absent when the name hides inside state', async () => {
    expect((await ask({ params: {}, query: {}, state: { caller: 'billing' } })).result.caller).toBeUndefined();
  });
});

describe('loopback or signed — there is no third way', () => {
  const hosts = ['0.0.0.0'];

  it('refuses to START when reachable from outside and establishing nothing', async () => {
    // At boot, not per call: a receiver that starts and then rejects everything is
    // found in production; one that will not start is found at deployment.
    await expect(serve(runner, { hosts, host: '0.0.0.0' })).rejects.toThrow(/reachable from outside/);
  });

  it('starts when it can establish its caller', async () => {
    const open = await serve(runner, {
      hosts,
      host: '0.0.0.0',
      verify: (identity, presented) => verifyEnvelope(identity, root.publicKey, presented),
    });
    expect(open.port).toBeGreaterThan(0);
    await open.close();
  });

  it('starts unsigned when something in front already authenticated — said out loud', async () => {
    // The mesh case: the sidecar terminated mTLS, a second signature would redo it.
    const open = await serve(runner, { hosts, host: '0.0.0.0', allowUnsigned: true });
    expect(open.port).toBeGreaterThan(0);
    await open.close();
  });

  it('says nothing to a receiver that stayed on loopback', async () => {
    // The laptop, untouched: `pnpm dev` needs no key and no ceremony.
    const local = await serve(runner);
    expect(local.port).toBeGreaterThan(0);
    await local.close();
  });
});

describe('an envelope proves WHAT, not only WHO', () => {
  it('refuses a captured envelope replayed against another operation', async () => {
    // Signed for `post.list`, posted as `post.delete`: same signature, same grant, same
    // 60-second window. Binding the call is what closes it.
    const captured = await signEnvelope(app, { entity: 'post', op: 'list' });
    const res = await fetch(`${base}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'post.delete',
        params: { params: {}, query: {}, identity: captured },
      }),
    });
    const answer = (await res.json()) as { result?: unknown; error?: { data?: { code?: string } } };

    expect(answer.result).toBeUndefined();
    expect(answer.error?.data?.code).toBe('UNAUTHORIZED');
  });

  it('refuses one replayed with a swapped body', async () => {
    const captured = await signEnvelope(app, { entity: 'post', op: 'list', input: { title: 'hello' } });
    const res = await fetch(`${base}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'post.list',
        params: { params: {}, query: {}, input: { title: 'defaced' }, identity: captured },
      }),
    });
    const answer = (await res.json()) as { error?: { data?: { code?: string } } };

    expect(answer.error?.data?.code).toBe('UNAUTHORIZED');
  });
});
