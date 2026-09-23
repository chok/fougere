/**
 * The Web-standard facade, and the decision it refuses to make for you.
 *
 * `serve()` reads it off the address it binds. This one binds nothing — its host mounts
 * it wherever it likes — so the same decision has to be stated, and refusing at
 * construction is what stops a facade from starting and then believing whatever `state`
 * arrives on it.
 */
import { describe, it, expect } from 'vitest';
import { ENVELOPE_BYTES, maxBodyBytes, setMaxBodyBytes } from '@fougere/core';
import { receive } from '../src/receive.js';

const runner = async () => ({ ok: true });
const post = (body: unknown, path = '/_fougere/call') =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('the envelope facade', () => {
  it('refuses to be built when nobody said who may call', () => {
    expect(() => receive(runner)).toThrow(/who is calling/);
  });

  it('names both ways out, because only one of them is a decision', () => {
    // A message that says "wire verify" alone pushes a developer on a laptop toward
    // key material they do not need; one that says "allowUnsigned" alone reads as the
    // default. Both, or the refusal teaches the wrong thing.
    expect(() => receive(runner)).toThrow(/allowUnsigned/);
    expect(() => receive(runner)).toThrow(/verify/);
  });

  it('is built when the decision is stated, either way', () => {
    expect(typeof receive(runner, { allowUnsigned: true })).toBe('function');
    expect(typeof receive(runner, { verify: async () => ({ caller: 'x', state: {} }) })).toBe('function');
  });

  it('answers a call once it is allowed to exist', async () => {
    const facade = receive(runner, { allowUnsigned: true });
    const answer = await facade(post({ jsonrpc: '2.0', id: 1, method: 'thing.list', params: {} }));

    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({ jsonrpc: '2.0', id: 1, result: { ok: true } });
  });

  it('ignores anything that is not its own path', async () => {
    const facade = receive(runner, { allowUnsigned: true });

    expect((await facade(post({}, '/elsewhere'))).status).toBe(404);
  });

  it('refuses a body over the cap rather than parsing it', async () => {
    const before = maxBodyBytes();
    setMaxBodyBytes(1);
    try {
      const facade = receive(runner, { allowUnsigned: true });
      const answer = await facade(post({ jsonrpc: '2.0', id: 1, method: 'a.b', params: { pad: 'x'.repeat(ENVELOPE_BYTES + 64) } }));

      expect(answer.status).toBe(413);
    } finally {
      setMaxBodyBytes(before);
    }
  });

  it('marks what it hands on as crossed, and refuses a caller claiming it', async () => {
    let handed: unknown;
    const facade = receive(async (_call, invocation) => { handed = invocation; return null; }, { allowUnsigned: true });

    await facade(post({ jsonrpc: '2.0', id: 1, method: 'thing.list', params: {} }));
    expect(handed).toMatchObject({ crossed: true });

    const claimed = await facade(post({ jsonrpc: '2.0', id: 2, method: 'thing.list', params: { crossed: true } }));
    expect(await claimed.json()).toMatchObject({ error: { message: expect.stringContaining('crossed') } });
  });
});
