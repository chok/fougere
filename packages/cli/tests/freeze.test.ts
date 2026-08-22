/**
 * `fougere freeze` — the one place the repo asks a human a question, and what makes it
 * unnecessary. The handler is called directly: it writes, so the fixture is copied first.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

  it('a version steps from the chain tip, not from the last name in the directory', async () => {
    // A hotfix cut after v2: its own step says it follows v1, and sorting names would
    // have made the NEXT version step from it rather than from v2.
    await freeze().execute({ version: 'v2', root });
    const hotfix = join(root, 'fronds/blog/versions/v1.9');
    await mkdir(hotfix, { recursive: true });
    await cp(join(root, 'fronds/blog/versions/v2/shape.json'), join(hotfix, 'shape.json'));
    await writeFile(
      join(hotfix, 'from.json'),
      JSON.stringify({ previous: 'v2', entities: {}, entitiesAdded: [], entitiesRemoved: [] }),
    );

    expect((await freeze().execute({ version: 'v3', root })).previous).toBe('v1.9');
  });

  it('refuses a versions directory that is not one line', async () => {
    await mkdir(join(root, 'fronds/blog/versions/v9'), { recursive: true });

    // Two versions with no step: two starts, so nothing says which line to replay.
    await expect(freeze().execute({ version: 'v2', root })).rejects.toThrow(/ONE line/);
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
