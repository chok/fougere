/**
 * `fougere freeze` — the one place the repo asks a human a question, and what makes it
 * unnecessary. The handler is called directly: it writes, so the fixture is copied first.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import FreezeHandler from '../fronds/analysis/handlers/FreezeHandler.js';
import ProjectScan from '../fronds/analysis/services/ProjectScan.js';

const fixture = join(import.meta.dirname, 'fixtures-freeze');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fougere-freeze-'));
  await cp(fixture, root, { recursive: true });
});

const freeze = () => new FreezeHandler(new ProjectScan());

describe('freeze', () => {
  it('a field that says what it was leaves nothing to ask', async () => {
    // v1 held `email`, the entity now declares `mail` with `previous: { mail: 'email' }`.
    // Without it the pair is ambiguous and nothing reaches the disk.
    const seen = await freeze().execute({ version: 'v2', root });

    expect(seen.ambiguous).toEqual({});
    expect(seen.written).toBe(true);
    expect(seen.previous).toBe('v1');
  });

  it('the answer is recorded, so a later run needs no one present', async () => {
    await freeze().execute({ version: 'v2', root });

    const step = JSON.parse(await readFile(join(root, 'fronds/blog/versions/v2/from.json'), 'utf8'));

    expect(step.renamed).toEqual({ post: { email: 'mail' } });
    expect(step.entities.post.changes).toContainEqual(
      expect.objectContaining({ kind: 'renamed', from: 'email', to: 'mail' }),
    );
  });
});
