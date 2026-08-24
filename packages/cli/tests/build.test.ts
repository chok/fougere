/**
 * `fougere build` — the scan, written down.
 *
 * The claim under test is not "a file appeared": it is that the module holds the SAME
 * objects the scan decided on. An emitter that re-resolved would build a second `Article`
 * class, and the three sites comparing by identity would silently take the other branch.
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

    expect(built.path).toBe('.fougere/scan.generated.ts');
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
    // `Fronds` is an Array subclass, and a bare literal does not rebuild it — measured
    // when a worker booted from a plain object and answered NOT_FOUND on everything.
    expect(source).toContain('Fronds.scanned(');
  });

  it('carries the diagnostics it has, and the written module says the same', async () => {
    // The fixture's handler extends a base exported by NAME — which the checker resolves,
    // so there is nothing to report. What matters is that the written module carries
    // exactly what the scan found, whatever that is.
    const built = await build().execute({ root, out: null });

    expect(built.diagnostics).toEqual([]);
    expect(await readFile(built.out, 'utf8')).toContain('diagnostics: []');
  });

  it('a chosen destination moves the imports with it', async () => {
    // Every import is written relative to where the module will SIT, so a different
    // directory is a different set of specifiers, not the same ones somewhere else.
    const built = await build().execute({ root, out: 'generated/scan.ts' });

    expect(built.path).toBe('generated/scan.ts');
    expect(await readFile(built.out, 'utf8')).toContain("from '../fronds/press/entities/Article.js'");
  });
});
