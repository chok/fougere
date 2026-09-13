/**
 * The facades as types — the third projection of one scan.
 *
 * TypeScript records nothing about what a function throws, so a client cannot narrow a refusal
 * without being told. The runtime scan cannot tell it: its operations travel in a `Map`, and a
 * `Map` literal widens its key to `string`, which is exactly the association that matters.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';
import { emitFacade } from '../src/scan/facade.js';

const at = (fixture: string) => join(import.meta.dirname, fixture);

describe('the facades file', () => {
  /**
   * Every name the file uses, it imports.
   *
   * A rename swept `FacadeName` in the body and left `Facade` in the import string, and every
   * assertion here still passed: they read substrings, and a substring cannot see that the
   * file names something nothing gave it.
   */
  it('imports exactly the names its body uses', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facade.ts') });
    const imported = new Set(
      /^import type \{ ([^}]+) \}/m.exec(written)?.[1]?.split(',').map((one) => one.trim()) ?? [],
    );
    // Only what a TYPE position names: `OrderHandler.js` is a path, not a name in scope.
    const used = new Set([...written.matchAll(/(?<![\w'/.])([A-Z][A-Za-z]*)[<.]/g)].map((one) => one[1]!));

    for (const name of imported) expect([...used]).toContain(name);
    for (const name of used) expect([...imported]).toContain(name);
  }, 30_000);

  /**
   * It AUGMENTS rather than declares, which is what puts the keys in reach of a page: a
   * composable narrows `useQuery('order', 'ship')` against the interface it already imports,
   * and nothing in the project has to name this file.
   */
  it('fills the interface the packages declare, instead of standing up its own', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facades.ts') });

    expect(written).toContain("declare module '@fougere/core/contract' {");
    expect(written).toContain('  interface FougereOperations {');
    expect(written).not.toContain('export interface FougereOperations');
  }, 30_000);

  /**
   * An op that declares nothing still answers `SERVICE_UNAVAILABLE`: every call can meet a
   * draining facade. Writing only what the frond declares would tell a page it refuses nothing.
   */
  it('carries the framework half for an op that declares none of its own', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facades.ts') });

    expect(written).toContain("'order.quote': { errors: ErrorCode.SERVICE_UNAVAILABLE };");
  }, 30_000);

  it('names what an op can refuse, walked through the helpers beside it', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facades.ts') });

    expect(written).toContain(
      "'order.ship': { errors: ErrorCode.CONFLICT | ErrorCode.GONE | ErrorCode.PRECONDITION_FAILED"
      + ' | ErrorCode.SERVICE_UNAVAILABLE };',
    );
  }, 30_000);

  /**
   * A surface is a second facade in front of the same handler. What an op refuses does not change
   * with it — the code that throws is the same — but a client pointed at one must be offered its
   * own key, and `frond.config.ts` declares a surface just as a directory does.
   */
  /**
   * `ErrorCode` is a string ENUM, so `'CONFLICT'` is not assignable to it — a literal would
   * read as the right thing and then refuse to narrow `FougereError<Code>`.
   */
  it('writes enum members, not the literals that look like them', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facades.ts') });

    expect(written).toContain("import type { ErrorCode, FacadeName } from '@fougere/core/contract';");
  }, 30_000);

  /**
   * The second interface: what a page reads its operations and their answers from, carried as
   * a type-only import so nothing is printed into the file and nothing can drift.
   */
  it('names the handler that answers at each address', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facades.ts') });

    expect(written).toContain('  interface FougereHandlers {');
        // Without `typeof`: that names the CONSTRUCTOR, whose `keyof` is `'prototype'`.
    expect(written).toContain("'order': import('../fronds/shop/handlers/OrderHandler.js').default;");
  }, 30_000);

  it('gives a named surface a facade of its own', async () => {
    const written = emitFacade(await scanProject(at('../../cli/tests/fixtures-explain')), { outFile: at('../../cli/tests/fixtures-explain/.fougere/facades.ts') });

    expect(written).toContain("'post.publish':");
    expect(written).toContain("'public:post.publish':");
  }, 30_000);

  /**
   * A page IMPORTS its facade, so a project that never generated this file fails to resolve
   * rather than falling back to `string` in silence. The value is the address alone — the
   * handler is reached as a TYPE, so no server code travels into a bundle.
   */
  it('exports one facade per address, named after the address and never after the class', async () => {
    const written = emitFacade(await scanProject(at('fixtures-refusals')), { outFile: at('fixtures-refusals/.fougere/facades.ts') });

    expect(written).toContain(
      "export const order: FacadeName<import('../fronds/shop/handlers/OrderHandler.js').default, 'order'> = { address: 'order' };",
    );
  }, 30_000);

  /** Two surfaces share one class name, so only the default one is exported as a facade. */
  it('exports one facade for a handler served on two surfaces', async () => {
    const written = emitFacade(await scanProject(at('../../cli/tests/fixtures-explain')), { outFile: at('../../cli/tests/fixtures-explain/.fougere/facades.ts') });

    expect(written.match(/export const post:/g)).toHaveLength(1);
    expect(written).not.toContain("'public:post'> = ");
  }, 30_000);
});
