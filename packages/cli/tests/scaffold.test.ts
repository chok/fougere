import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ProjectWriter from '../fronds/scaffold/services/ProjectWriter.js';

describe('flat project scaffold', () => {
  it('emits a pnpm 11 project with native build permissions and accurate guidance', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-flat-'));
    const root = join(parent, 'fern');

    try {
      const writer = new ProjectWriter();
      writer.createFlat(root, 'fern');
      writer.addRootFrond(root, 'blog');

      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
        name: string;
        packageManager?: string;
        pnpm?: unknown;
      };
      const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
      const page = readFileSync(join(root, 'app', 'pages', 'index.vue'), 'utf8');

      expect(pkg).toMatchObject({ name: 'fern', packageManager: 'pnpm@11.20.0' });
      expect(pkg.pnpm).toBeUndefined();
      expect(workspace).toContain('better-sqlite3: true');
      expect(workspace).toContain('esbuild: true');
      expect(page).toContain('<code>entities/</code>');
      expect(page).not.toContain('<code>fronds/</code>');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
