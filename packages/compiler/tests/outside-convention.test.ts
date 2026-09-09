/**
 * What sits in a frond and belongs to no convention.
 *
 * The eight names were closed for READING and open for writing: a scan steps over a
 * directory it does not know, in silence, so an invented one is not refused — it is
 * unseen. Every placement drift this repository has met begins there.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { outsideConventions } from '@fougere/compiler';
import { DEFAULT_CONVENTIONS } from '@fougere/core';

const frondAt = (path: string) => ({ name: 'catalog', source: { path, package: '@fronds/catalog' } });

describe('a frond holding what no convention names', () => {
  it('names the invented directory and the root module, with the addresses', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-placement-'));
    try {
      mkdirSync(join(root, 'entities'), { recursive: true });
      mkdirSync(join(root, 'portals'), { recursive: true });
      writeFileSync(join(root, 'portals', 'pages.ts'), 'export const x = 1;\n');
      writeFileSync(join(root, 'Quiet.ts'), 'export const bandOf = () => 1;\n');
      writeFileSync(join(root, 'frond.config.ts'), 'export default {};\n');

      const found = await outsideConventions([frondAt(root)], DEFAULT_CONVENTIONS);

      expect(found.map((one) => [one.kind, one.filePath.slice(root.length + 1)])).toEqual([
        ['file', 'Quiet.ts'],
        ['directory', 'portals'],
      ]);
      expect(found[0].message).toContain('rules/');
      expect(found[0].message).toContain('services/');
      expect(found[1].message).toContain('rules/');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('says nothing about the eight, `rules/` included', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-placement-'));
    try {
      for (const dir of ['entities', 'handlers', 'services', 'repositories', 'presenters',
        'collectors', 'seeds', 'rules', 'versions']) mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, 'rules', 'Quiet.ts'), 'export const bandOf = () => 1;\n');
      writeFileSync(join(root, 'frond.config.ts'), 'export default {};\n');

      expect(await outsideConventions([frondAt(root)], DEFAULT_CONVENTIONS)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves alone what is not the project’s source, and the frond’s own tests', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-placement-'));
    try {
      // `tests/` is a supported shape — @fougere/testing reads the level from where a
      // case sits. `dist/` and `node_modules/` are outputs and installs.
      for (const dir of ['tests', 'dist', 'node_modules', '.turbo'])
        mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, 'package.json'), '{}\n');
      writeFileSync(join(root, 'README.md'), '#\n');

      expect(await outsideConventions([frondAt(root)], DEFAULT_CONVENTIONS)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads the names a project restated, not the default ones', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-placement-'));
    try {
      mkdirSync(join(root, 'lois'), { recursive: true });
      mkdirSync(join(root, 'rules'), { recursive: true });

      const conventions = { ...DEFAULT_CONVENTIONS, dirs: { ...DEFAULT_CONVENTIONS.dirs, rules: 'lois' } };
      const found = await outsideConventions([frondAt(root)], conventions);

      expect(found.map((one) => one.filePath.slice(root.length + 1))).toEqual(['rules']);
      expect(found[0].message).toContain('`lois/`');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
