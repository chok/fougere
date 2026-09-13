/**
 * What an operation can refuse, walked from every `throw` up to whoever reaches it.
 *
 * Reading a handler's own body answers "at least these", which is not a contract — a guard moved
 * into a helper would silently shrink what an app promises. These fixtures put the guards beside
 * the handler on purpose, and the walk has to cross two of them.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseRefusals } from '../src/scan/handler-parser.js';

const handler = join(import.meta.dirname, 'fixtures-refusals/fronds/shop/handlers/OrderHandler.ts');
const walked = () => parseRefusals(handler, (name) => name.startsWith('OrderHandler.'));

describe('the walk', () => {
  it('crosses the helpers a body only calls', async () => {
    const found = await walked();

    // `ship` throws CONFLICT itself; the other two live two calls away.
    expect(found.get('OrderHandler.ship')).toEqual(['CONFLICT', 'GONE', 'PRECONDITION_FAILED']);
  }, 30_000);

  /**
   * A guard reached through an IMPORT, which is what `fougere check` asks a frond to do.
   *
   * The callee resolved to its import specifier, callable in no sense the walk admitted, so the
   * edge was dropped: moving three guards out of `site/fronds/blog` cut what `publish` promises
   * from five codes to two, with no change of behaviour — exactly what walking upward exists to
   * prevent.
   */
  it('crosses a helper that lives in another module', async () => {
    const found = await walked();

    expect(found.get('OrderHandler.reserve')).toEqual(['UNPROCESSABLE_ENTITY']);
  }, 30_000);

  it('says nothing of an operation that reaches no refusal', async () => {
    expect((await walked()).get('OrderHandler.quote')).toBeUndefined();
  }, 30_000);

  /** `toPublicError` replaces its message, so a caller learns nothing it can act on. */
  it('leaves out the one whose message never travels', async () => {
    expect((await walked()).get('OrderHandler.audit')).toBeUndefined();
  }, 30_000);
});
