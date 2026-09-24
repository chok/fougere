/**
 * What a caller receives, at both placements.
 *
 * `date-time` means a `Date` on both sides (`Boundary.forShape`), and only the outgoing half was
 * applied: the facade encoded `new Date(0)` into an ISO string and nobody put it back, so
 * `Facade<EntryHandler>` promised `at: Date` and handed over a string — here as well as across a
 * wire. These two tests are the same call, twice; if the second fails, a placement decides what a
 * caller holds.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, createAppRunner, type Transport } from '../src/index.js';
import { Invocation } from '../src/wire/Invocation.js';
import fronds, { journal, reader } from './fixtures-received/fronds.js';

async function journalOnAnotherProcess(): Promise<Transport> {
  const host = await createApp({ fronds: [journal], createContainer });

  return createLocalRunner(host);
}

describe('a caller receives what its type promises', () => {
  it('hands over a Date when both fronds live in one process', async () => {
    await using app = await createApp({ fronds, createContainer });

    const out = await createLocalRunner(app)({ entity: 'reader', op: 'findStamp' }, Invocation.empty);

    expect(out).toEqual({ date: true, text: '[object Date]' });
  });

  it('hands over the same Date when the journal frond moved out', async () => {
    const remote = await journalOnAnotherProcess();
    await using app = await createApp({
      fronds: [reader],
      createContainer,
      remotes: { journal: 'stub://journal' },
      remoteTransport: () => remote,
    });

    const out = await createAppRunner(app)({ entity: 'reader', op: 'findStamp' }, Invocation.empty);

    expect(out).toEqual({ date: true, text: '[object Date]' });
  });

  it('still puts data on the wire — the row leaves encoded, and this side puts it back', async () => {
    await using app = await createApp({ fronds: [journal], createContainer });

    const onTheWire = await createLocalRunner(app)({ entity: 'entry', op: 'findLast' }, Invocation.empty);

    expect((onTheWire as { at: unknown }).at).toBe('1970-01-01T00:00:00.000Z');
  });
});
