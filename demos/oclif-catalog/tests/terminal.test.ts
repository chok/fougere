/**
 * What the terminal answers, from a declaration that never mentions one.
 *
 * A CLI demo is the only one in this tree whose result is TEXT, so it is the only one a test
 * can hold whole: `--help` is a rendering of the entity's axes, and a refused flag is the
 * closed set saying no. A page's equivalent needs a browser.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const run = promisify(execFile);

/** Both streams: a command answers on stdout, and oclif refuses on stderr. */
async function fougere(...argv: string[]): Promise<string> {
  const both = (r: { stdout?: string; stderr?: string }) => `${r.stdout ?? ''}\n${r.stderr ?? ''}`;

  return run('npx', ['tsx', 'src/main.ts', ...argv], { cwd: root }).then(both, both);
}

describe('a frond as a terminal', () => {
  it('groups a handler under its address, with no table saying so', async () => {
    expect(await fougere('--help')).toContain('product');
  }, 60_000);

  it('lists the five operations Crud gives, as commands', async () => {
    const help = await fougere('product', '--help');

    for (const op of ['create', 'list', 'find-by-id', 'update', 'delete']) {
      expect(help).toContain(`product:${op}`);
    }
  }, 60_000);

  /** Every word below was read off `Product`: nothing about the terminal is declared. */
  it('reads the flags off the entity — required, described, and a closed set', async () => {
    const help = await fougere('product:create', '--help');

    expect(help).toContain('Warehouse reference');
    expect(help).toContain('(required) Price, in cents');
    expect(help).toContain('<options: draft|listed|archived>');
  }, 60_000);

  it('refuses a value the shape does not admit, and names the ones it does', async () => {
    const refused = await fougere('product:create', 'A-1', '--name', 'Chair', '--cents', '1', '--state', 'retired');

    expect(refused).toContain('Expected --state=retired to be one of: draft, listed, archived');
  }, 60_000);

  it('names a row for an op whose parameter is a bare string', async () => {
    expect(await fougere('product:find-by-id', '--help')).toContain('product:find-by-id ID');
  }, 60_000);

  it('writes a row, and reads it back in another process', async () => {
    rmSync(join(root, '.fougere'), { recursive: true, force: true });
    await fougere('product:create', 'SKU-9', '--name', 'Lamp', '--cents', '2500');

    expect(await fougere('product:list')).toContain('SKU-9');
  }, 90_000);
});
