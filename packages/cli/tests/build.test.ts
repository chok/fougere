/**
 * `fougere build` — the scan, written down as the statement an author would write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import BuildHandler from '../fronds/analysis/handlers/BuildHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

const fixture = join(import.meta.dirname, 'fixtures-check');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fougere-build-'));
  await cp(fixture, root, { recursive: true });
});

const build = () => new BuildHandler(new ProjectScan());

describe('build', () => {
  it('writes what the scan found, where nothing has to be told', async () => {
    const built = await build().execute({ root, out: null });

    expect(built.path).toBe('.fougere/fronds.generated.ts');
    expect(built.fronds).toEqual(['press']);
    expect(built.entities).toBe(1);
    expect(built.handlers).toBe(1);
  });

  it('imports the source files rather than describing them', async () => {
    const built = await build().execute({ root, out: null });
    const source = await readFile(built.out, 'utf8');

    // Relative and `.js` — a bundler has to be able to trace it from where it sits.
    expect(source).toContain("from '../fronds/press/entities/Article.js'");
    expect(source).toContain("from '../fronds/press/handlers/ArticleHandler.js'");
    expect(source).toContain("frond(\"press\", {");
  });

  it('says what the scan could not settle', async () => {
    // The fixture's handler extends a base exported by NAME — which the checker resolves,
    // so there is nothing to report.
    const built = await build().execute({ root, out: null });

    expect(built.diagnostics).toEqual([]);
  });

  it('a chosen destination moves the imports with it', async () => {
    // Every import is written relative to where the module will SIT, so a different
    // directory is a different set of specifiers, not the same ones somewhere else.
    const built = await build().execute({ root, out: 'generated/fronds.ts' });

    expect(built.path).toBe('generated/fronds.ts');
    expect(await readFile(built.out, 'utf8')).toContain("from '../fronds/press/entities/Article.js'");
  });
});
