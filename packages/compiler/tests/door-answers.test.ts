/**
 * What a door middleware bound to a handler may answer in an op's place, read off its return types:
 * every member whose `status` is a literal, with its headers' keys — behind an alias too. The scan
 * fills the field a `frond()` states by hand; it never makes it exist.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { emitStatement, scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-door-answers');

describe('a door middleware\'s declared answers', () => {
  it('are read off each method, a literal status at a time, and the answer next() hands back is not one', async () => {
    const scan = await scanProject(root);
    const gate = scan.fronds.find((frond) => frond.name === 'desk')?.middlewares.find((one) => one.name === 'NoteGate');

    expect(gate?.answers).toEqual({
      findById: [{ status: 301, headers: ['location'] }, { status: 308, headers: ['location'] }],
      delete: [{ status: 423, headers: [] }],
    });
  });

  it('are written into the statement, the field a hand-written fronds.ts states', async () => {
    const written = emitStatement(await scanProject(root));

    expect(written).toContain('answers: {"findById":[{"status":301,"headers":["location"]},{"status":308,"headers":["location"]}],"delete":[{"status":423,"headers":[]}]}');
  });
});
