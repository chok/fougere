import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isFougerePackage } from '../src/FougerePackage.js';

const tree = mkdtempSync(join(tmpdir(), 'fougere-package-'));
const packageAt = (path: string, manifest: object): string => {
  mkdirSync(join(tree, path), { recursive: true });
  writeFileSync(join(tree, path, 'package.json'), JSON.stringify(manifest));

  return join(tree, path);
};

describe('a file Nitro must keep for what it runs at load', () => {
  it('belongs to a @fougere package, installed under node_modules', () => {
    const installed = packageAt('node_modules/@fougere/adapter-sql', { name: '@fougere/adapter-sql' });

    expect(isFougerePackage(join(installed, 'dist/sqlite/index.js'))).toBe(true);
  });

  it('belongs to a @fougere package linked from a workspace, where no path says @fougere', () => {
    const linked = packageAt('packages/adapter/sql', { name: '@fougere/adapter-sql' });
    packageAt('packages/adapter/sql/dist', { type: 'module' });

    expect(isFougerePackage(join(linked, 'dist/sqlite/index.js'))).toBe(true);
  });

  it('is not any other package, nor a virtual module', () => {
    const other = packageAt('node_modules/h3', { name: 'h3' });

    expect(isFougerePackage(join(other, 'dist/index.mjs'))).toBe(false);
    expect(isFougerePackage('\0virtual:nitro')).toBe(false);
  });
});
