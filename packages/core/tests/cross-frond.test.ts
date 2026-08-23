/**
 * A frond reaching another frond — the same code, in-process and split.
 *
 * The façade is the only public thing a frond has: the handler stays private in the
 * frond's scope (`_handler:…`), the façade goes to the root container under
 * `facadeKeyOf(entity)`. So `constructor(private articleHandler: ArticleHandler)` is the
 * sanctioned way for one frond to reach another, and the gradient's promise says it must
 * keep working when that frond moves to its own process.
 *
 * These two tests are the same call, twice. If the second fails, the promise does not
 * hold for frond→frond — only for consumer→frond.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, createAppRunner } from '../src/index.js';
import type { Transport } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/wire/invocation.js';

const root = join(import.meta.dirname, 'fixtures-cross-frond');

/**
 * Stands in for the wire. A real split would frame this over HTTP; what is under test
 * is the RESOLUTION — does the commande frond find a stock façade at all — so the
 * transport is the other app's own runner, called in memory.
 */
async function stockOnAnotherProcess(): Promise<Transport> {
  // Plain `const`, not `await using`: this app must OUTLIVE the function that builds
  // it — the transport returned below still calls into it. A scope-bound disposal here
  // closes the host before the first call, which is exactly what this test then reports.
  const host = await createApp({ scan: await scanProject(root, ['stock']), createContainer,});
  return createLocalRunner(host);
}

describe('frond → frond, through the façade', () => {
  it('answers when both fronds live in one process', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    const out = await createLocalRunner(app)({ entity: 'commande', op: 'servable' }, EMPTY_INVOCATION);

    expect(out).toBe(true);
  });

  it('answers the same when the stock frond moved out', async () => {
    const remote = await stockOnAnotherProcess();
    await using app = await createApp({
      scan: await scanProject(root, ['commande']),
      createContainer,
      remotes: { stock: 'stub://stock' },
      remoteTransport: () => remote,
    });

    const out = await createAppRunner(app)({ entity: 'commande', op: 'servable' }, EMPTY_INVOCATION);

    expect(out).toBe(true);
  });
});
