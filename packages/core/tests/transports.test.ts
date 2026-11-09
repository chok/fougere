/**
 * The scheme of `remote:` names what carries a call there, and one table answers every reader.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createAppRunner, Transports, type Transport } from '../src/index.js';
import { Invocation } from '../src/wire/Invocation.js';

const card = { fronds: [{ name: 'catalog', facades: [{ name: 'product', ops: [{ name: 'list' }] }], entities: [] }] };

const answering: Transport = async (call) => (call.op === 'discover' ? card : ['p1']);

const opened: string[] = [];
Transports.register('probe', {
  open: (address) => {
    opened.push(address.href);

    return answering;
  },
});

describe('the scheme of `remote:` names its transport', () => {
  it('opens the transport registered under it, once per address', async () => {
    opened.length = 0;
    await using app = await createApp({ fronds: [], createContainer, remotes: { catalog: 'probe://catalog' } });
    const run = createAppRunner(app);

    expect(await run({ address: 'product', op: 'list' }, Invocation.empty)).toEqual(['p1']);
    expect(await run({ address: 'product', op: 'list' }, Invocation.empty)).toEqual(['p1']);
    expect(opened).toEqual(['probe://catalog']);
  });

  it('refuses the boot naming the entry and the schemes it knows', async () => {
    await expect(createApp({ fronds: [], createContainer, remotes: { catalog: 'tcp://127.0.0.1:4700' } }))
      .rejects.toThrow(/fronds\.catalog\.remote: Unknown transport 'tcp'\. Known: probe\./);
  });

  it('refuses an address written without its scheme', async () => {
    await expect(createApp({ fronds: [], createContainer, remotes: { catalog: 'catalog:4100' } }))
      .rejects.toThrow(/fronds\.catalog\.remote: Unknown transport 'catalog'/);
    await expect(createApp({ fronds: [], createContainer, remotes: { catalog: '127.0.0.1' } }))
      .rejects.toThrow(/fronds\.catalog\.remote: '127\.0\.0\.1' is not an address/);
  });

  it('leaves the registry unread when the host hands its own transport', async () => {
    opened.length = 0;
    await using app = await createApp({
      fronds: [], createContainer, remotes: { catalog: 'nowhere://catalog' }, remoteTransport: () => answering,
    });

    expect(await createAppRunner(app)({ address: 'product', op: 'list' }, Invocation.empty)).toEqual(['p1']);
    expect(opened).toEqual([]);
  });
});
