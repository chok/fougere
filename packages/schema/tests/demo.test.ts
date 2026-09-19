/**
 * The demos, run rather than read.
 *
 * Nothing executed them, so `02-relations` kept handing `lines` to `validate()` long after a
 * collection stopped being a caller's to send: it printed `Read-only` and exited 0, which no
 * check here could see. A demo teaches by its OUTPUT, so what is pinned is how many refusals
 * it shows — zero where it only declares, and the exact count where refusing IS the lesson.
 *
 * Imported rather than spawned: a demo is a module whose body runs on import, and vitest
 * already compiles TypeScript. Running `npx tsx` instead needed a binary this package does
 * not declare — green here, `tsx: not found` in CI.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** A refusal as a demo prints it: `validate()` answers the object, `console.log` takes it whole. */
const refusals = (said: unknown[][]): number =>
  said.flat().filter((one) => typeof one === 'object' && one !== null && 'success' in one
    && (one as { success: unknown }).success === false).length;

const shown: Record<string, number> = {
  '01-basic.ts': 1,              // « Validation (invalide) » — c'est le sujet de la démo
  '02-relations.ts': 0,
  '03-derivation.ts': 2,         // une vue qui exige, une autre qui refuse
  '04-ecommerce.ts': 0,
  '05-multifrond.ts': 0,
  '06-circular-relations.ts': 0,
};

afterEach(() => { vi.restoreAllMocks(); });

describe('every demo', () => {
  it('is the list this test states — a new one cannot be added in silence', () => {
    expect(readdirSync(join(import.meta.dirname, '..', 'demo')).sort()).toEqual(Object.keys(shown).sort());
  });

  for (const [name, expected] of Object.entries(shown)) {
    it(`${name} runs, and shows ${expected} refusal(s)`, async () => {
      const said: unknown[][] = [];
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { said.push(args); });

      await import(`../demo/${name}`);

      expect(said.length).toBeGreaterThan(0);
      expect(refusals(said)).toBe(expected);
    });
  }
});
