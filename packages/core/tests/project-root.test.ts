/**
 * An app finds the project it belongs to by itself — `root: '../..'` in every starter was a fact
 * the tree already states.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectRootOf } from '../src/node.js';

const tree = (...dirs: string[]) => {
  const root = mkdtempSync(join(tmpdir(), 'project-root-'));
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });

  return root;
};

describe('projectRootOf', () => {
  it('finds the workspace holding the fronds, from an app under apps/', () => {
    const root = tree('fronds/blog', 'apps/web/src');

    expect(projectRootOf(join(root, 'apps/web'))).toBe(root);
    expect(projectRootOf(join(root, 'apps/web/src'))).toBe(root);
  });

  it('is the app itself when the app keeps its own fronds', () => {
    const root = tree('demo/fronds/blog');

    expect(projectRootOf(join(root, 'demo'))).toBe(join(root, 'demo'));
  });

  it('falls back on the config file when no frond exists yet', () => {
    const root = tree('apps/web');
    writeFileSync(join(root, 'fougere.config.ts'), 'export default {};\n');

    expect(projectRootOf(join(root, 'apps/web'))).toBe(root);
  });
});
