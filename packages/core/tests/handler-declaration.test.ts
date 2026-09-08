/**
 * What a handler file declares besides its handler.
 *
 * The model has four natures and one question separates them: what a gesture uses arrives
 * INJECTED or IMPORTED. Nothing names the second — a threshold, a formula, a word list — so
 * nothing keeps it, and it settles in the file that calls it first. This rule reads source
 * for the same reason `cross-frond-import` does: a `const` at the top of a handler leaves no
 * trace in the model, which is exactly what makes it accumulate.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { handlerDeclarations } from '../src/node.js';

function frondOf(root: string, ...files: string[]) {
  mkdirSync(join(root, 'handlers'), { recursive: true });

  return {
    name: 'catalog',
    handlers: files.map((name) => ({ name, filePath: join(root, 'handlers', `${name}.ts`) })),
  };
}

describe('what a handler declares besides itself', () => {
  it('names the constant, the helper and the shape, and says where each goes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-declares-'));
    try {
      const frond = frondOf(root, 'QuietHandler');
      writeFileSync(frond.handlers[0].filePath, [
        `import { ldenOf } from '../Quiet.js';`,
        `const AGREED_WITHIN = 3;`,
        `export default class QuietHandler {`,
        `  assess(metres: number): Assessment {`,
        `    return { lden: round(ldenOf('rail', metres)), agreed: AGREED_WITHIN };`,
        `  }`,
        `}`,
        `export interface Assessment { lden: number; agreed: number }`,
        `const round = (n: number): number => Math.round(n * 10) / 10;`,
        ``,
      ].join('\n'));

      const found = await handlerDeclarations([frond]);

      expect(found.map((one) => one.subject)).toEqual(['AGREED_WITHIN', 'Assessment', 'round']);
      expect(found.map((one) => one.kind)).toEqual(['value', 'shape', 'value']);
      expect(found[0].handler).toBe('QuietHandler');
      expect(found[0].frond).toBe('catalog');
      expect(found[0].message).toContain('a word of');
      expect(found[1].message).toContain('belongs');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('says nothing about a handler that declares only its class', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-declares-'));
    try {
      const frond = frondOf(root, 'ListingHandler');
      writeFileSync(frond.handlers[0].filePath, [
        `import { Crud } from '@fougere/core';`,
        `import Listing from '../entities/Listing.js';`,
        ``,
        `export default class ListingHandler extends Crud(Listing) {}`,
        ``,
      ].join('\n'));

      expect(await handlerDeclarations([frond])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads the file as TypeScript, so a method and a local stay the handler’s own', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-declares-'));
    try {
      const frond = frondOf(root, 'SearchHandler');
      writeFileSync(frond.handlers[0].filePath, [
        `// const SEEN = 3;`,
        `/** A word list would go in the frond's module: const SAYS = []; */`,
        `export default class SearchHandler {`,
        `  find(term: string) {`,
        `    const cleaned = term.trim();`,
        `    return cleaned;`,
        `  }`,
        `}`,
        ``,
      ].join('\n'));

      expect(await handlerDeclarations([frond])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a file it cannot read as nothing, the way an absent handler is nothing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-declares-'));
    try {
      expect(await handlerDeclarations([frondOf(root, 'GoneHandler')])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
