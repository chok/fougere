import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProject, scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-frond-name');

describe('the project as JavaScript', () => {
  it('writes what its statement reaches, beside the table `@fronds/<name>` resolves by', async () => {
    const out = mkdtempSync(join(tmpdir(), 'fougere-compiled-'));
    try {
      const compiled = await compileProject(root, await scanProject(root), out);

      expect(compiled.files).toEqual(['fronds.js', 'fronds/blog-v2/entities/Note.js', 'fronds/plain/entities/Tag.js']);
      expect(readFileSync(join(out, 'fronds.js'), 'utf8')).toContain("from './fronds/blog-v2/entities/Note.js'");
      expect(readFileSync(join(out, 'fronds/blog-v2/entities/Note.js'), 'utf8')).not.toContain(': string');
      expect(JSON.parse(readFileSync(join(out, 'aliases.json'), 'utf8'))).toEqual({
        '@fronds/blog': 'fronds/blog-v2',
        '@fronds/plain': 'fronds/plain',
      });
      expect(readFileSync(join(out, 'modules.js'), 'utf8')).toBe('export default {\n};\n');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('follows the scope and the directory `conventions:` name', async () => {
    const renamed = join(import.meta.dirname, 'fixtures-conventions');
    const out = mkdtempSync(join(tmpdir(), 'fougere-compiled-'));
    try {
      await compileProject(renamed, await scanProject(renamed, undefined, { scope: '@shop', fronds: 'domains' }), out);

      expect(JSON.parse(readFileSync(join(out, 'aliases.json'), 'utf8'))).toEqual({ '@shop/orders': 'domains/orders' });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
