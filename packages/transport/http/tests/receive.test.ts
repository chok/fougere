/**
 * The Web-standard door, and the decision it refuses to make for you.
 *
 * `serve()` reads it off the address it binds. This one binds nothing — its host mounts
 * it wherever it likes — so the same decision has to be stated, and refusing at
 * construction is what stops a door from starting and then believing whatever `state`
 * arrives on it.
 */
import { describe, it, expect } from 'vitest';
import { receive } from '../src/receive.js';

const runner = async () => ({ ok: true });
const post = (body: unknown, path = '/_fougere/call') =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('the envelope door', () => {
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
    const door = receive(runner, { allowUnsigned: true });
    const answer = await door(post({ jsonrpc: '2.0', id: 1, method: 'thing.list', params: {} }));

    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({ jsonrpc: '2.0', id: 1, result: { ok: true } });
  });

  it('ignores anything that is not its own path', async () => {
    const door = receive(runner, { allowUnsigned: true });

    expect((await door(post({}, '/elsewhere'))).status).toBe(404);
  });

  it('refuses a body over the cap rather than parsing it', async () => {
    const door = receive(runner, { allowUnsigned: true, maxBodyBytes: 64 });
    const answer = await door(post({ jsonrpc: '2.0', id: 1, method: 'a.b', params: { pad: 'x'.repeat(200) } }));

    expect(answer.status).toBe(413);
  });
});
