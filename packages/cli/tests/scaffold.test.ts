import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ProjectWriter from '../fronds/scaffold/services/ProjectWriter.js';

function expectFougereCheckWorkflow(root: string, typecheck: string): void {
  for (const file of ['CLAUDE.md', 'AGENTS.md']) {
    const guidance = readFileSync(join(root, file), 'utf8');
    expect(guidance).toContain('After every change to handlers, entities, Fronds, configuration, or topology:');
    expect(guidance).toContain('1. Run `fougere check`.');
    expect(guidance).toContain('2. Fix every deterministic error it reports before continuing.');
    expect(guidance).toContain('3. Run the relevant tests, then run');
    expect(guidance).toContain(typecheck);
  }
}

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
      expectFougereCheckWorkflow(root, 'pnpm typecheck');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('workspace project scaffold', () => {
  it('emits the Fougere check workflow for Claude and other coding agents', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-workspace-'));
    const root = join(parent, 'forest');

    try {
      new ProjectWriter().createWorkspace(root, 'forest');
      expectFougereCheckWorkflow(root, 'pnpm typecheck');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
