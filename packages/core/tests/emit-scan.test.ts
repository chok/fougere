import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { scanProject, emitScan } from '../src/node.js';

const root = join(import.meta.dirname, 'fixtures');

/**
 * A scan written down is the SAME scan — not a lookalike.
 *
 * The emitter re-resolves nothing: what `resolveSchema` decided is already in the
 * descriptor, so an operation's `output` is the entity's own class and the module says
 * so by naming the same import. Three call sites compare those by identity
 * (`adapter/graphql`'s `view === entity.entityClass` and its WeakMap, `bootstrap`'s
 * `outputSchema !== entity.entityClass`), and an emitter that rebuilt them instead would
 * send all three down the other branch without a word.
 */
describe('a scan written down', () => {
  it('imports every class the descriptor names, and nothing twice', async () => {
    const scan = await scanProject(root);
    const source = emitScan(scan, { outFile: join(root, 'scan.generated.ts') });

    const aliases = [...source.matchAll(/^import (?:(\w+)|\{ \w+ as (\w+) \}) from '(.+)';$/gm)]
      .map((m) => ({ alias: m[1] ?? m[2], from: m[3] }));
    expect(aliases.length).toBeGreaterThan(0);
    expect(new Set(aliases.map((a) => a.alias)).size).toBe(aliases.length);
    // A specifier a bundler can trace: relative, and `.js` — never a `.ts` a Worker
    // has no loader for.
    for (const { from } of aliases) {
      expect(from.startsWith('.')).toBe(true);
      expect(from.endsWith('.js')).toBe(true);
    }
  });

  it('names ONE import for a class two slots hold — that is what identity means here', async () => {
    const scan = await scanProject(root);
    const source = emitScan(scan, { outFile: join(root, 'scan.generated.ts') });

    for (const frond of scan.fronds) {
      for (const entity of frond.entities) {
        const declared = source.match(
          new RegExp(`^import (\\w+) from '.*${entity.filePath.split('/').pop()!.replace('.ts', '.js')}';$`, 'm'),
        );
        expect(declared, `no import for ${entity.name}`).not.toBeNull();
        const alias = declared![1];
        // Every op whose output IS this entity must be written as that same alias.
        for (const handler of frond.handlers) {
          for (const [op, contract] of handler.operations) {
            if (contract.output !== entity.entityClass) continue;
            expect(source, `${handler.name}.${op}.output`).toContain(`output: ${alias}`);
          }
        }
      }
    }
  });

  it('writes a derivation as a derivation — `Partial<X>` has no module to import from', async () => {
    const crud = join(import.meta.dirname, 'fixtures-crud');
    const scan = await scanProject(crud);
    const source = emitScan(scan, { outFile: join(crud, 'scan.generated.ts') });

    const anonymous = [...scan.fronds]
      .flatMap((f) => f.handlers)
      .flatMap((h) => [...h.operations].map(([, c]) => c.input))
      .filter((input) => input && (input as { name?: string }).name === 'Schema');
    expect(anonymous.length, 'the fixture declares no Partial<X>').toBeGreaterThan(0);
    expect(source).toMatch(/input: _\d+\.partial\(\)/);
  });

  it('is valid TypeScript that a compiler accepts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'emit-scan-'));
    const outFile = join(dir, 'scan.generated.ts');
    const scan = await scanProject(root);
    writeFileSync(outFile, emitScan(scan, { outFile }));

    const ts = await import('typescript');
    const parsed = ts.createSourceFile(outFile, emitScan(scan, { outFile }), ts.ScriptTarget.ESNext, true);
    // A syntax error surfaces as a parse diagnostic; nothing else is asked of it here.
    expect((parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics).toHaveLength(0);
  });
});
