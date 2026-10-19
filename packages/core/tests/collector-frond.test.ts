/** A collector is local: in another frond it is not used, and the boot says so without refusing. */
import split, { identity } from './fixtures-collector-split/fronds.js';
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, resolveEffectiveOperations } from '../src/index.js';


describe('a collector declared in the wrong frond', () => {
  it('is a warning for every affected operation', async () => {
    const model = resolveEffectiveOperations(split, { diagnostics: [] });
    const invalid = model.resolutionDiagnostics
      .filter((diagnostic) => diagnostic.code === 'collector-in-another-frond');

    expect(split.find((frond) => frond.name === 'blog')?.collectors).toHaveLength(0);
    expect(split.find((frond) => frond.name === 'identity')?.collectors).toHaveLength(1);
    expect(invalid.map((diagnostic) => diagnostic.subject).sort()).toEqual([
      'PostHandler.whoExplicit(user)',
      'PostHandler.whoOptional(user)',
    ]);
    expect(invalid.every((diagnostic) => diagnostic.severity === 'warning')).toBe(true);
  });

  it('boots, since reading the parameter from the request may be meant', async () => {
    await using app = await createApp({ fronds: split, createContainer });

    expect(app).toBeDefined();
  });

  it('says nothing once the request is declared, and the declaration names only that parameter', () => {
    const [blog, ...rest] = split;
    const declared = [{ ...blog!, operationsOverrides: { 'post.whoExplicit': { binding: [{ name: 'user', source: { kind: 'input' as const }, optional: true }] } } }, ...rest];
    const model = resolveEffectiveOperations(declared, { diagnostics: [] });

    expect(model.resolutionDiagnostics.map((one) => one.subject)).toEqual(['PostHandler.whoOptional(user)']);
  });

  it('keeps a collector valid when it is declared in the consuming frond', async () => {
    const model = resolveEffectiveOperations([identity], { diagnostics: [] });

    expect(identity.collectors.map((collector) => collector.typeName)).toEqual(['user']);
    expect(model.resolutionDiagnostics).toEqual([]);
  });
});
