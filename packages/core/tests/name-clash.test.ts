/**
 * Two fronds, one handler name — and the boot used to pick a winner in silence.
 *
 * A door is registered on the ROOT container under `facadeKeyOf(address)`
 * (`bootstrap.ts`), and that key carries no frond. `registerValue` is a `Map.set`, so
 * `inventory`'s `ProductHandler` simply replaced `catalog`'s: every call meant for one
 * landed on the other, with nothing said at boot or at call time.
 *
 * The split half disagreed on top of that. `createRemoteRouter` indexes by entity name
 * and guards with `if (!byEntity.has(...))`, so there the FIRST frond discovered wins
 * while in-process the LAST one loaded did — the same application answering differently
 * depending on how it was deployed, which is exactly what the gradient must not do.
 *
 * Refusing is the honest answer while a door's name cannot say which frond it belongs
 * to. It is not the final one: the day a key is qualified, this boot can accept both.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-name-clash');

describe('two fronds claiming one name', () => {
  it('refuses to boot instead of letting one shadow the other', async () => {
    await expect(createApp({ root, createContainer })).rejects.toThrow(/productHandler/);
  });

  it('names both fronds and what to do about it', async () => {
    let message = '';
    try {
      await createApp({ root, createContainer });
    } catch (error) {
      message = (error as Error).message;
    }

    // A boot that refuses without saying who collided leaves the reader to grep.
    expect(message).toMatch(/catalog/);
    expect(message).toMatch(/inventory/);
    expect(message).toMatch(/rename/i);
  });
});
