/**
 * The names as types — the fourth projection of one scan.
 *
 * A config designates classes, entities and fronds by string, and a string is the one thing here
 * that nothing reads back. What this pins is that the scan can hand TypeScript the list it
 * already holds, and that a port is written as a relation rather than one more flat union.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';
import { emitNames } from '../src/scan/names.js';

const at = (fixture: string) => join(import.meta.dirname, fixture);

describe('the names file', () => {
  it('writes every kind the config can name', async () => {
    const written = emitNames(await scanProject(at('fixtures-refusals')));

    for (const kind of ['frond', 'entity', 'handler', 'provider', 'middleware', 'source']) {
      expect(written).toMatch(new RegExp(`^\\s+${kind}: `, 'm'));
    }
  });

  /** A kind with nothing in it says `never`, so a config naming one is refused rather than free. */
  it('says never for a kind the project declares nothing of', async () => {
    const written = emitNames(await scanProject(at('fixtures-refusals')));

    expect(written).toMatch(/source: never;/);
  });

  /** The keys of `sources:` come from the config — no scan can find them. */
  it('takes the source names it cannot scan', async () => {
    const written = emitNames(await scanProject(at('fixtures-refusals')), { sources: ['analytics', 'archive'] });

    expect(written).toMatch(/source: 'analytics' \| 'archive';/);
  });

  /**
   * A port maps to what extends it, not to every class in the project.
   *
   * `ports-swap` declares one port answered by three classes; a flat union would let a config
   * answer `Payment` with any of the others, which is what the boot refuses at its own level.
   */
  it('maps a port to the classes that extend it', async () => {
    const written = emitNames(await scanProject(at('../../../demos/ports-swap')));

    expect(written).toMatch(/Payment: 'OgonePayment' \| 'RetryingPayment' \| 'StripePayment';/);
    expect(written).not.toMatch(/Payment: .*'ProductHandler'/);
  });

  /** `RepositoryBase` is returned by a call and declared in no file — the boot skips it too. */
  it('leaves out a base no file declares', async () => {
    const written = emitNames(await scanProject(at('../../../demos/ports-swap')));

    expect(written).not.toMatch(/RepositoryBase/);
  });
});
