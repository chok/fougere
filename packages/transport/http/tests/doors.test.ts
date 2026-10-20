/**
 * One wire, two trust boundaries. A peer's call is marked `crossed`: the sender's own boundary
 * judged it. A page's call never is — it used to be, so the receiver skipped judging the state
 * of a caller that sits outside the topology.
 */
import { describe, it, expect } from 'vitest';
import { answerAt, type InvocationContext, type Transport } from '@fougere/core';
import { pageDoor, peerDoor } from '../src/index.js';

const envelope = (params: Record<string, unknown>) => ({ jsonrpc: '2.0', id: 7, method: 'post.list', params });

function recording(): { runner: Transport; seen: InvocationContext[] } {
  const seen: InvocationContext[] = [];

  return { seen, runner: async (_call, invocation) => { seen.push(invocation); return 'ok'; } };
}

describe('the doors of the call envelope', () => {
  it('marks a peer\'s call crossed, and takes the state it sent when nothing verifies it', async () => {
    const { runner, seen } = recording();

    expect(await answerAt(peerDoor(runner), envelope({ state: { user: 'peer' } }))).toEqual({ jsonrpc: '2.0', id: 7, result: 'ok' });
    expect(seen[0]).toMatchObject({ crossed: true, state: { user: 'peer' } });
  });

  it('never marks a page\'s call crossed, and gives it the state the host resolved', async () => {
    const { runner, seen } = recording();

    await answerAt(pageDoor(runner, { state: { user: 'host' } }), envelope({ state: { user: 'admin' } }));

    expect(seen[0]!.crossed).toBeUndefined();
    expect(seen[0]!.state).toEqual({ user: 'host' });
  });

  it('refuses `args` from a page, which a peer may send', async () => {
    const { runner } = recording();

    const answered = await answerAt(pageDoor(runner, { state: {} }), envelope({ args: ['1'] })) as { error: { data: { code: string } } };
    expect(answered.error.data.code).toBe('BAD_REQUEST');
    expect(await answerAt(peerDoor(runner), envelope({ args: ['1'] }))).toMatchObject({ result: 'ok' });
  });

  it('refuses a page an op an announcement calls, which a peer delivering a fact reaches', async () => {
    const { runner, seen } = recording();
    const listens = (address: string, op: string) => `${address}.${op}` === 'post.list';

    const answered = await answerAt(pageDoor(runner, { state: {}, listens }), envelope({})) as { error: { data: { code: string } } };
    expect(answered.error.data.code).toBe('NOT_FOUND');
    expect(seen).toHaveLength(0);
    expect(await answerAt(peerDoor(runner), envelope({}))).toMatchObject({ result: 'ok' });
  });
});
