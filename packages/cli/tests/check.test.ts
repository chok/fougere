/**
 * `fougere check` — ce qui ne tient pas dans une app, dérivé de ses déclarations.
 *
 * Le handler ne boote pas la cible : il la scanne (`ProjectScan`). Un boot lancerait
 * ses migrations et ses seeds, donc un « contrôle » qui écrirait dans la base qu'il
 * inspecte. Ce test appelle le handler directement, sans CLI et sans processus.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
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
const ambiguousInputFixture = join(repoRoot, 'packages', 'core', 'tests', 'fixtures-input-contract');
const check = () => new CheckHandler(new ProjectScan());

describe('check', () => {
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
