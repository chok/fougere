/**
 * The demos, run rather than read.
 *
 * Nothing executed them, so `02-relations` kept handing `lines` to `validate()` long after a
 * collection stopped being a caller's to send: it printed `Read-only` and exited 0, which no
 * check here could see. A demo teaches by its OUTPUT, so what is pinned is how many refusals
 * it shows: zero where a demo only declares, and the exact count where refusing IS the lesson.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = join(import.meta.dirname, '..');

/**
 * A refusal as a demo prints it. `console.log` of an object goes through `util.inspect`, which
 * colours `false` even into a pipe, so the escapes come off before the count.
 */
const refusals = (output: string): number =>
  // eslint-disable-next-line no-control-regex
  (output.replace(/\u001b\[[0-9;]*m/g, '').match(/success: false/g) ?? []).length;

const shown: Record<string, number> = {
  '01-basic.ts': 1,              // « Validation (invalide) » — c'est le sujet de la démo
  '02-relations.ts': 0,
  '03-derivation.ts': 2,         // une vue qui exige, une autre qui refuse
  '04-ecommerce.ts': 0,
  '05-multifrond.ts': 0,
  '06-circular-relations.ts': 0,
};

describe('every demo', () => {
  it('is the list this test states — a new one cannot be added in silence', () => {
    expect(readdirSync(join(root, 'demo')).sort()).toEqual(Object.keys(shown).sort());
  });

  for (const [name, expected] of Object.entries(shown)) {
    it(`${name} runs, and shows ${expected} refusal(s)`, async () => {
      const { stdout, stderr } = await run('npx', ['tsx', join('demo', name)], { cwd: root });

      expect(stderr).toBe('');
      expect(refusals(stdout)).toBe(expected);
    }, 120_000);
  }
});
