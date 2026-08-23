import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const templatesRoot = join(import.meta.dirname, '..', 'templates');
const agentTemplates = readdirSync(templatesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => ['CLAUDE.md', 'AGENTS.md'].map((file) => join(templatesRoot, entry.name, file)))
  .filter(existsSync);
const claudeTemplates = agentTemplates.filter((file) => file.endsWith('/CLAUDE.md'));
const agentsTemplates = agentTemplates.filter((file) => file.endsWith('/AGENTS.md'));

describe('agent templates describe the storage boundary', () => {
  it('covers every shipped CLAUDE/AGENTS template', () => {
    expect(agentTemplates.map((file) => file.slice(templatesRoot.length + 1)).sort()).toEqual([
      'flat/AGENTS.md',
      'flat/CLAUDE.md',
      'frond/AGENTS.md',
      'frond/CLAUDE.md',
      'workspace/AGENTS.md',
      'workspace/CLAUDE.md',
    ]);
  });

  for (const file of claudeTemplates) {
    it(`${file.slice(templatesRoot.length + 1)} points agents at Repository`, () => {
      const contents = readFileSync(file, 'utf8');

      expect(contents).not.toContain('`EntityOrm`, injected by type, is the only data access');
      expect(contents).toContain('Never inject `EntityOrm` directly');
      expect(contents).toContain('RepositoryOf<Product>');
      expect(contents).toContain('extends Repository(Product)');
    });
  }

  for (const file of agentsTemplates) {
    it(`${file.slice(templatesRoot.length + 1)} delegates model guidance to CLAUDE.md`, () => {
      const contents = readFileSync(file, 'utf8');

      expect(contents).not.toContain('`EntityOrm`, injected by type, is the only data access');
      expect(contents).toContain('Read `CLAUDE.md`');
    });
  }
});
