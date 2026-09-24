/** A collector is local provenance: placing it in another frond is never an input fallback. */
import split, { identity } from './fixtures-collector-split/fronds.js';
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, resolveEffectiveOperations } from '../src/index.js';


describe('a collector declared in the wrong frond', () => {
  it('is a blocking resolution error for every affected operation', async () => {
    const model = resolveEffectiveOperations(split, { diagnostics: [] });
    const invalid = model.resolutionDiagnostics
      .filter((diagnostic) => diagnostic.code === 'collector-in-another-frond');

    expect(split.find((frond) => frond.name === 'blog')?.collectors).toHaveLength(0);
    expect(split.find((frond) => frond.name === 'identity')?.collectors).toHaveLength(1);
    expect(invalid.map((diagnostic) => diagnostic.subject).sort()).toEqual([
      'PostHandler.whoExplicit(user)',
      'PostHandler.whoOptional(user)',
    ]);
    expect(invalid.every((diagnostic) => diagnostic.severity === 'blocking')).toBe(true);
  });

  it('refuses boot before a caller can supply a forged input', async () => {
    await expect(createApp({ fronds: split, createContainer })).rejects.toThrow(
      /collector-in-another-frond.*PostHandler\.whoExplicit\(user\)/s,
    );
    await expect(createApp({ fronds: split, createContainer })).rejects.toThrow(
      /preliminary input interpretation is invalid/s,
    );
  });

  it('keeps a collector valid when it is declared in the consuming frond', async () => {
    const model = resolveEffectiveOperations([identity], { diagnostics: [] });

    expect(identity.collectors.map((collector) => collector.typeName)).toEqual(['user']);
    expect(model.resolutionDiagnostics).toEqual([]);
  });
});
