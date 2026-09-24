/**
 * `fougere check` — ce qui ne tient pas dans une app, dérivé de ses déclarations.
 *
 * Le handler ne boote pas la cible : il la scanne (`ProjectScan`). Un boot lancerait
 * ses migrations et ses seeds, donc un « contrôle » qui écrirait dans la base qu'il
 * inspecte. Ce test appelle le handler directement, sans CLI et sans processus.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import CheckHandler from '../fronds/analysis/handlers/CheckHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

/**
 * The repo root, found rather than counted. This used to be three `..` from the
 * test file, which encoded how deep the package sat — so moving `cli/` into a
 * family made it resolve to `packages/demos/…`, and the test failed on an absent
 * directory instead of on the thing it checks.
 */
const repoRoot = ((d: string): string => {
  while (!existsSync(join(d, 'pnpm-workspace.yaml'))) d = dirname(d);

  return d;
})(import.meta.dirname);

const fixture = join(import.meta.dirname, 'fixtures-check');
const ambiguousInputFixture = join(repoRoot, 'packages', 'compiler', 'tests', 'fixtures-input-contract');
const check = () => new CheckHandler(new ProjectScan());

describe('check', () => {
  /**
   * A page imports its facade, so an ABSENT module fails to resolve and needs no finding. The
   * silent case is a module that is present and OLDER than the handlers it was read off: the
   * import resolves, and a renamed op compiles against a name nothing serves any more.
   */
  it('says nothing when no facade module was ever generated', async () => {
    const result = await check().execute({ root: fixture });

    expect(result.findings.find((f) => f.code === 'facade-stale')).toBeUndefined();
  });

  // On a COPY: the fixture is versioned, and `build.test.ts` copies it while this runs —
  // writing here made that copy fail on a `.fougere` that existed for some twenty milliseconds.
  it('names a facade module older than the handlers it was read off', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fougere-check-'));
    await cp(fixture, root, { recursive: true });
    const generated = join(root, '.fougere', 'facade.generated.ts');
    mkdirSync(dirname(generated), { recursive: true });
    writeFileSync(generated, '// stale\n');
    utimesSync(generated, new Date(0), new Date(0));

    const result = await check().execute({ root });

    expect(result.findings.find((f) => f.code === 'facade-stale')?.message)
      .toContain('older than the handlers');
  });

  it('suit un extends vers une classe exportée par son nom, et compte ce qu\'il a vu', async () => {
    const result = await check().execute({ root: fixture });

    expect(result.fronds).toBe(1);
    expect(result.handlers).toBe(1);

    // `BaseReporting` est exportée par son nom, pas en `default`. Le checker résout le
    // symbole quel que soit son mode d'export, donc il n'y a plus d'extends à signaler.
    expect(result.findings.find((f) => f.code === 'heritage-unresolved')).toBeUndefined();
  });

  it('reports an adapter name no dependency answers to, and names what it does answer to', async () => {
    const root = join(import.meta.dirname, 'fixtures-adapter-name');
    const result = await check().execute({ root });

    const found = result.findings.filter((f) => f.code === 'unknown-adapter');
    expect(found.map((f) => f.message)).toEqual([
      expect.stringContaining('adapters: { sqll }'),
      expect.stringContaining('adapters: { mongo }'),
    ]);
    expect(found[0]?.message).toContain('It depends on sql.');
    expect(found[0]?.severity).toBe('warning');
    expect(found[0]?.subject).toBe('article');
  });

  it('reports a pattern that backtracks, finds it under an object, and leaves a plain one alone', async () => {
    const root = join(import.meta.dirname, 'fixtures-super-linear');
    const result = await check().execute({ root });

    const found = result.findings.filter((f) => f.code === 'super-linear-pattern');
    expect(found.map((f) => f.subject)).toEqual(['firm.code', 'firm.filing']);
    expect(found[0]?.severity).toBe('warning');
    expect(found[0]?.message).toContain('pattern: "^(a+)+$"');
  });

  it('ne signale rien sur une app du dépôt', async () => {
    // Le zéro ici ne dit pas « tout va bien » — il dit « aucun faux positif sur du
    // vrai code ». Un vérificateur qui crie au loup cesse d'être lu.
    const root = join(repoRoot, 'demos', 'multi-frond', 'remote-blog');
    const result = await check().execute({ root });

    expect(result.fronds).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('bloque sur chaque contrat d’entrée ambigu, quel que soit l’ordre', async () => {
    const result = await check().execute({ root: ambiguousInputFixture });
    const found = result.findings.filter((f) => f.code === 'input-contract-ambiguous');

    expect(found.map((f) => f.subject).sort()).toEqual([
      'TransferHandler.transfer',
      'TransferHandler.transferReversed',
    ]);
    expect(found.every((f) => f.severity === 'blocking')).toBe(true);
    expect(found[0].message).toMatch(/source: Account|destination: Ledger/);
  });
});
