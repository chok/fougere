/**
 * A caller may send `maxBodyBytes`, and a hop keeps room for what it adds around the call. Measured
 * against the caller's limit alone, a body just under it passed in process and was refused a hop
 * away, once the forwarding process had added its trace, its identity and its state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ENVELOPE_BYTES, ErrorCode, Invocation, maxBodyBytes, setMaxBodyBytes, type Transport } from '@fougere/core';
import { createHttpTransport, serve } from '../src/index.js';

const DEFAULT_LIMIT = maxBodyBytes();
const LIMIT = 10_000;

afterEach(() => setMaxBodyBytes(DEFAULT_LIMIT));

const echo: Transport = async (_call, invocation) => ({ size: String((invocation.input as { text: string }).text).length });

describe('the body limit across a hop', () => {
  it('lets a body just under the limit through, whatever the envelope added', async () => {
    setMaxBodyBytes(LIMIT);
    const receiver = await serve(echo);
    try {
      const forward = createHttpTransport(`http://127.0.0.1:${receiver.port}`);
      const answer = await forward({ entity: 'note', op: 'create' }, {
        ...Invocation.empty,
        input: { text: 'x'.repeat(LIMIT - 200) },
        state: { user: { id: 'u1', name: 'y'.repeat(3_000) } },
      });

      expect(answer).toEqual({ size: LIMIT - 200 });
    } finally {
      await receiver.close();
    }
  });

  it('refuses before sending what not even the envelope\'s room holds', async () => {
    setMaxBodyBytes(LIMIT);
    const forward = createHttpTransport('http://127.0.0.1:9');

    await expect(forward({ entity: 'note', op: 'create' }, { ...Invocation.empty, input: { text: 'x'.repeat(LIMIT + ENVELOPE_BYTES) } }))
      .rejects.toMatchObject({ code: ErrorCode.PAYLOAD_TOO_LARGE });
  });
});
