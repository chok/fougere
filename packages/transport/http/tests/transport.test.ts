import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FougereError, ErrorCode, EMPTY_INVOCATION } from '@fougere/core';
import type { Transport } from '@fougere/core';
import { createHttpTransport, handleRpc, serve, unframeResponse, INVALID_REQUEST, PARSE_ERROR } from '../src/index.js';
import type { RunningReceiver } from '../src/index.js';

const products = [{ id: '1', name: 'Fern' }];

/** Stub runner — the transport moves values, it never needs a real app. */
const runner: Transport = async (call, invocation) => {
  if (call.entity === 'rpc' && call.op === 'discover') {
    return { fronds: [{ name: 'catalog', entities: [{ name: 'product', ops: ['list'], schema: {} }] }] };
  }
  if (call.op === 'list') return products;
  if (call.op === 'echo') return { got: invocation.params, state: invocation.state };
  if (call.op === 'absence') return { params: invocation.params, input: invocation.input };
  if (call.op === 'empty') return null;
  if (call.op === 'boom') {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'already exists',
      entity: call.entity,
      operation: call.op,
      details: { field: 'name' },
    });
  }
  if (call.op === 'slow') {
    await new Promise((r) => setTimeout(r, 400));
    return 'late';
  }
  throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Unknown op '${call.op}'`, entity: call.entity, operation: call.op });
};

let receiver: RunningReceiver;
let base: string;

beforeAll(async () => {
  receiver = await serve(runner);
  base = `http://127.0.0.1:${receiver.port}`;
});
afterAll(async () => {
  await receiver.close();
});

describe('sender ↔ receiver over real HTTP', () => {
  it('round-trips a result', async () => {
    const transport = createHttpTransport(base);
    const result = await transport({ entity: 'product', op: 'list' }, EMPTY_INVOCATION);
    expect(result).toEqual(products);
  });

  it('carries the invocation whole — params and state cross', async () => {
    const transport = createHttpTransport(base);
    const result = await transport(
      { entity: 'product', op: 'echo' },
      { params: { id: '7' }, query: {}, input: undefined, state: { user: 'max' } },
    );
    expect(result).toEqual({ got: { id: '7' }, state: { user: 'max' } });
  });

  it('omits undefined properties on JSON while preserving explicit null', async () => {
    const transport = createHttpTransport(base);
    const result = await transport(
      { entity: 'product', op: 'absence' },
      {
        params: { optional: undefined, nullable: null },
        query: {},
        input: { optional: undefined, nullable: null, optionalNullable: null },
        state: {},
      },
    ) as { params: Record<string, unknown>; input: Record<string, unknown> };

    expect(result.params.optional).toBeUndefined();
    expect(Object.hasOwn(result.params, 'optional')).toBe(false);
    expect(result.params.nullable).toBeNull();
    expect(result.input.optional).toBeUndefined();
    expect(Object.hasOwn(result.input, 'optional')).toBe(false);
    expect(result.input.nullable).toBeNull();
    expect(result.input.optionalNullable).toBeNull();
  });

  it('serves rpc.discover like any call', async () => {
    const transport = createHttpTransport(base);
    const card = await transport({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION);
    expect(card).toMatchObject({ fronds: [{ name: 'catalog' }] });
  });

  it('a null result stays null', async () => {
    const transport = createHttpTransport(base);
    expect(await transport({ entity: 'product', op: 'empty' }, EMPTY_INVOCATION)).toBeNull();
  });

  it('a FougereError crosses typed — code, details, entity, operation intact', async () => {
    const transport = createHttpTransport(base);
    const failure = transport({ entity: 'product', op: 'boom' }, EMPTY_INVOCATION);
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      message: 'already exists',
      entity: 'product',
      operation: 'boom',
      details: { field: 'name' },
    });
  });

  it('a timed-out call fails GATEWAY_TIMEOUT and is not retried', async () => {
    const transport = createHttpTransport(base, { timeoutMs: 80 });
    const failure = transport({ entity: 'product', op: 'slow' }, EMPTY_INVOCATION);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.GATEWAY_TIMEOUT });
  });

  it('an unreachable receiver fails SERVICE_UNAVAILABLE after retrying', async () => {
    const transport = createHttpTransport('http://127.0.0.1:9', { retries: 1, timeoutMs: 500 });
    const failure = transport({ entity: 'product', op: 'list' }, EMPTY_INVOCATION);
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
  });

  it('answers 404 outside POST /_fougere/call', async () => {
    const res = await fetch(`${base}/anything`);
    expect(res.status).toBe(404);
  });

  it('answers PARSE_ERROR to a non-JSON body', async () => {
    const res = await fetch(`${base}/_fougere/call`, { method: 'POST', body: 'not json' });
    // `Response.json()` answers `unknown` — the wire carries no type. Naming the
    // envelope here is the test saying what it expects to have received.
    const body = await res.json() as { error: { code: number } };
    expect(body.error.code).toBe(PARSE_ERROR);
  });

  it('binds loopback when nobody says otherwise', async () => {
    await expect(serve(runner, { host: '0.0.0.0' })).rejects.toThrow(/add it to `hosts`/);
  });

  it('binds wider when `hosts` says so, and the message names what is allowed', async () => {
    // Stating the address is one of two guards now: a receiver reachable from outside
    // must also be able to establish its caller, or say that something in front did.
    // `identity.e2e.test.ts` pins that half; here it is granted so the address is tested alone.
    const open = await serve(runner, { hosts: ['0.0.0.0'], allowUnsigned: true });
    try {
      expect(open.port).toBeGreaterThan(0);
    } finally {
      await open.close();
    }
    // …and `host` still has to be one of them: a widened list is not a blank cheque.
    await expect(serve(runner, { hosts: ['0.0.0.0'], host: '10.0.0.1', allowUnsigned: true }))
      .rejects.toThrow(/binds one of \[0\.0\.0\.0\], got '10\.0\.0\.1'/);
    await expect(serve(runner, { hosts: [] })).rejects.toThrow(/`hosts` is empty/);
  });

  it('rejects a body larger than the configured limit', async () => {
    const limited = await serve(runner, { maxBodyBytes: 32 });
    try {
      const res = await fetch(`http://127.0.0.1:${limited.port}/_fougere/call`, {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'product.list', padding: 'x'.repeat(64) }),
      });
      expect(res.status).toBe(413);
    } finally {
      await limited.close();
    }
  });
});

describe('handleRpc (receiving half alone)', () => {
  it('rejects a non-JSON-RPC shape', async () => {
    const response = await handleRpc(runner, { hello: 'world' });
    expect('error' in response && response.error.code).toBe(INVALID_REQUEST);
  });

  it('rejects a method without entity.op form', async () => {
    const response = await handleRpc(runner, { jsonrpc: '2.0', id: 1, method: 'justanop' });
    expect('error' in response && response.error.code).toBe(INVALID_REQUEST);
  });

  it('frames an unexpected throw as INTERNAL_ERROR, FougereError in data', async () => {
    const bad: Transport = async () => { throw new Error('kaboom'); };
    const response = await handleRpc(bad, { jsonrpc: '2.0', id: 1, method: 'product.list' });
    if (!('error' in response)) throw new Error('expected error');
    const revived = FougereError.fromJSON(response.error.data);
    expect(revived.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(revived.message).toBe('Internal error');
  });
});

describe('an answer that is not a JSON-RPC response', () => {
  const call = { entity: 'product', op: 'list' } as const;

  // A 200 with someone else's JSON — a proxy, a CDN, a receiver that is not one.
  // This used to return `undefined` as if the op had answered nothing.
  it('is refused rather than read as an empty result', () => {
    expect(() => unframeResponse({ hello: 1 }, call)).toThrow(/neither a result nor an error/);
  });

  // `Cannot use 'in' operator` was what a null body raised — not this file's vocabulary.
  it.each([null, 'a string', 42])('is a FougereError, never a TypeError (%p)', (body) => {
    try {
      unframeResponse(body, call);
      throw new Error('should have refused');
    } catch (err) {
      expect(err).toBeInstanceOf(FougereError);
      expect((err as FougereError).code).toBe(ErrorCode.BAD_GATEWAY);
    }
  });

  it('refuses an error member that is not an error object', () => {
    expect(() => unframeResponse({ error: 'boom' }, call)).toThrow(/not a JSON-RPC error object/);
  });
});
