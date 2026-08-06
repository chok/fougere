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
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner, createAppRunner } from '../src/index.js';
import type { Transport } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';

const root = join(import.meta.dirname, 'fixtures-cross-frond');

/**
 * Stands in for the wire. A real split would frame this over HTTP; what is under test
 * is the RESOLUTION — does the commande frond find a stock façade at all — so the
 * transport is the other app's own runner, called in memory.
 */
async function stockOnAnotherProcess(): Promise<Transport> {
  const host = await createApp({ root, createContainer, fronds: ['stock'] });
  return createLocalRunner(host);
}

/**
 * Both are `it.fails` — they record a gap, and they are the alarm for closing it.
 *
 * The DI derives its key from the constructor parameter's TYPE NAME, verbatim:
 * `depKeyOf` returns `ArticleHandler`. The façade is registered under
 * `facadeKeyOf('article')` → `articleHandler`. The two keys never meet, so frond→frond
 * has never worked, in any topology — the absence of any such call in this repo was not
 * discipline.
 *
 * `it.fails` passes while the call throws. Fix the key and these turn red: that is the
 * point. Flip them to `it` then, and the second one will say whether the remote half
 * needs its own answer (the fallback lives on `app.resolve`, not on the container).
 */
describe('frond → frond, through the façade', () => {
  it.fails('answers when both fronds live in one process', async () => {
    const app = await createApp({ root, createContainer });

    const out = await createLocalRunner(app)({ entity: 'commande', op: 'servable' }, EMPTY_INVOCATION);

    expect(out).toBe(true);
  });

  it.fails('answers the same when the stock frond moved out', async () => {
    const remote = await stockOnAnotherProcess();
    const app = await createApp({
      root,
      createContainer,
      fronds: ['commande'],
      remotes: { stock: 'stub://stock' },
      remoteTransport: () => remote,
    });

    const out = await createAppRunner(app)({ entity: 'commande', op: 'servable' }, EMPTY_INVOCATION);

    expect(out).toBe(true);
  });
});
