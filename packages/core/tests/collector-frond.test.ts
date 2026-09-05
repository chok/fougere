/** A collector is local provenance: placing it in another frond is never an input fallback. */
import { scanProject } from '../src/node.js';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, resolveEffectiveOperations } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-collector-split');

describe('a collector declared in the wrong frond', () => {
  it('is a blocking resolution error for every affected operation', async () => {
    const scan = await scanProject(root);
    const model = resolveEffectiveOperations(scan.fronds, { diagnostics: scan.diagnostics });
    const invalid = model.resolutionDiagnostics
      .filter((diagnostic) => diagnostic.code === 'collector-in-another-frond');

    expect(scan.fronds.find((frond) => frond.name === 'blog')?.collectors).toHaveLength(0);
    expect(scan.fronds.find((frond) => frond.name === 'identity')?.collectors).toHaveLength(1);
    expect(invalid.map((diagnostic) => diagnostic.subject).sort()).toEqual([
      'PostHandler.whoExplicit(user)',
      'PostHandler.whoOptional(user)',
    ]);
    expect(invalid.every((diagnostic) => diagnostic.severity === 'blocking')).toBe(true);
  });

  it('refuses boot before a caller can supply a forged input', async () => {
    const scan = await scanProject(root);

    await expect(createApp({ scan, createContainer })).rejects.toThrow(
      /collector-in-another-frond.*PostHandler\.whoExplicit\(user\)/s,
    );
    await expect(createApp({ scan, createContainer })).rejects.toThrow(
      /preliminary input interpretation is invalid/s,
    );
  });

  it('keeps a collector valid when it is declared in the consuming frond', async () => {
    const scan = await scanProject(root, ['identity']);
    const model = resolveEffectiveOperations(scan.fronds, { diagnostics: scan.diagnostics });

    expect(scan.fronds[0]?.collectors.map((collector) => collector.typeName)).toEqual(['user']);
    expect(model.resolutionDiagnostics).toEqual([]);
  });
});
