import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';
import { resolveEffectiveOperations } from '@fougere/core';

const fixture = join(import.meta.dirname, 'fixtures-output-data');

/**
 * An operation answers data — what JSON keeps.
 *
 * The three ops of the fixture are the three cases: a declared entity, whose `created()` field
 * is encoded on the way out; a shape that is already data; and a `Date` nothing converts, which
 * reaches a local caller as a `Date` and a remote one as a string.
 */
describe('an operation answers data', () => {
  it('refuses an undeclared output that carries methods, and nothing else', async () => {
    const scan = await scanProject(fixture);
    const model = resolveEffectiveOperations(scan.fronds, { diagnostics: scan.diagnostics });

    expect(model.resolutionDiagnostics.map((one) => ({ code: one.code, subject: one.subject })))
      .toEqual([{ code: 'operation-output-not-data', subject: 'RunHandler.findLast' }]);
    expect(model.resolutionDiagnostics[0]!.message).toContain('at: Date');
  });

  it('leaves a declared entity alone, whatever its fields convert', async () => {
    const scan = await scanProject(fixture);
    const handler = scan.fronds[0]!.handlers[0]!;
    const model = resolveEffectiveOperations(scan.fronds, { diagnostics: scan.diagnostics });

    expect([...model.forHandler(handler).keys()].sort()).toEqual(['findCount', 'findFirst', 'list']);
  });

  it('reads an unwritten return type off the checker, so an op that annotates nothing still has a contract', async () => {
    const scan = await scanProject(fixture);
    const operations = scan.fronds[0]!.handlers[0]!.operations!;

    // 18 of the 42 unannotated ops in this repo answer a declared entity. Without this they
    // carried no output, so nothing put their `created()` field back for the caller.
    expect((operations.get('findFirst')?.output as { name?: string } | undefined)?.name).toBe('Run');
    expect(operations.get('findFirst')?.cardinality).toBe('one');
  });

  it('leaves an entity alone wherever it was declared, and says where the refusal sits', async () => {
    const scan = await scanProject(fixture);
    const operations = scan.fronds[0]!.handlers[0]!.operations!;

    // `list` answers a `Date` too, and nothing is written: `Run` states `extends entity({…})`,
    // so its fields convert it. Read from the HERITAGE rather than from a resolved output,
    // because a frond answering with its neighbour's entity resolves none — which is how
    // `RedactHandler.set(): Promise<PostPublished>` was refused for a shape it declares.
    expect(operations.get('list')?.signature?.notData).toBeUndefined();
    expect(operations.get('findCount')?.signature?.notData).toBeUndefined();
    expect(operations.get('findLast')?.signature?.notData).toBe('findLast.at: Date');
  });
});
