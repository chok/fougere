import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vitest';
import { NAMES } from '../src/node.js';

const base = join(import.meta.dirname, '..', 'tsconfig', 'fronds.json');

const filesOf = (root: string): string[] => {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(String(diagnostic.messageText)); },
  });

  return (parsed?.fileNames ?? []).map((file) => file.slice(root.length + 1));
};

describe('what @fougere/core/tsconfig checks', () => {
  it('reads the names beside the config, so the config is judged by them', () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-tsconfig-'));
    try {
      mkdirSync(join(root, '.fougere'));
      writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ extends: base }));
      writeFileSync(join(root, 'fougere.config.ts'), 'export default {};\n');
      writeFileSync(join(root, NAMES), 'export {};\n');

      expect(filesOf(root).sort()).toEqual([NAMES, 'fougere.config.ts'].sort());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
