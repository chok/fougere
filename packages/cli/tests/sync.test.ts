import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SyncHandler, { entityClassName } from '../fronds/scaffold/handlers/SyncHandler.js';

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllGlobals();
});

describe('remote frond sync', () => {
  it('derives a safe TypeScript identifier from the canonical entity name', () => {
    expect(entityClassName('blog-post')).toBe('BlogPost');
    expect(() => entityClassName('../../escape')).toThrow(/Invalid entity name/);
  });

  it('never uses a remote schema title as executable code', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        fronds: [{
          name: 'blog',
          doors: [{
            name: 'post',
            ops: [],
            schema: {
              title: "Post; await import('node:fs')",
              type: 'object',
              properties: {},
              'x-fougere-version': 1,
              'x-fougere-vendor': 'fougere',
            },
          }],
        }],
      },
    }), { status: 200 })));

    try {
      await new SyncHandler().execute({ name: 'blog', from: 'https://example.test/' });
      const generated = readFileSync(join(root, '.fougere', 'remotes', 'blog', 'entities', 'Post.ts'), 'utf8');
      // The host's `title` names NOTHING: the class takes the already-sanitized name.
      // The string stays present INSIDE the card, as inert data.
      expect(generated).toContain('export class Post extends reconstruct<');
      expect(generated).not.toContain("class Post; await import");

      // The card carries what it takes to type, and until now nobody read it: a synced
      // entity validated perfectly and taught the compiler nothing. One declaration now
      // carries the judge and the shape.
      expect(generated).not.toContain('export interface Post');
      expect(generated).toContain('export default Post;');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('mirrors a door that stores nothing instead of refusing the whole card', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        fronds: [{
          name: 'ops',
          doors: [
            // A health check owns no rows, so the card publishes ops and no schema. This
            // used to throw `has no valid schema descriptor` and take the card with it,
            // so ONE entity-less handler on the host made `sync` useless for the rest.
            { name: 'health', ops: [{ name: 'check', kind: 'query' }] },
            {
              name: 'ticket',
              ops: [{ name: 'list', kind: 'query' }],
              schema: {
                type: 'object',
                properties: { id: { type: 'string' } },
                'x-fougere-version': 1,
                'x-fougere-vendor': 'fougere',
              },
            },
          ],
        }],
      },
    }), { status: 200 })));

    try {
      await new SyncHandler().execute({ name: 'ops', from: 'https://example.test/' });
      const dir = join(root, '.fougere', 'remotes', 'ops');

      // The door travels; there is simply no row class to write beside it.
      expect(readFileSync(join(dir, 'handlers', 'HealthHandler.ts'), 'utf8'))
        .toContain('interface HealthHandler');
      expect(() => readFileSync(join(dir, 'entities', 'Health.ts'), 'utf8')).toThrow();

      // And the entity that DOES have a shape is untouched by its neighbour.
      expect(readFileSync(join(dir, 'entities', 'Ticket.ts'), 'utf8')).toContain('class Ticket');

      const barrel = readFileSync(join(dir, 'index.ts'), 'utf8');
      expect(barrel).toContain("export type { HealthHandler }");
      expect(barrel).not.toContain("export { default as Health }");
      expect(barrel).toContain("export { default as Ticket }");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a traversal name supplied by a remote', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        fronds: [{
          name: 'blog',
          doors: [{
            name: '../../escape',
            ops: [],
            schema: { type: 'object', properties: {}, 'x-fougere-version': 1, 'x-fougere-vendor': 'fougere' },
          }],
        }],
      },
    }), { status: 200 })));

    try {
      await expect(new SyncHandler().execute({ name: 'blog', from: 'https://example.test' }))
        // The message names the list it came from — the card has two now, and a bad
        // name in one says nothing about the other.
        .rejects.toThrow(/Invalid door name/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a malformed nested identity card before writing files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: { fronds: [{ name: 'blog', doors: {} }] },
    }), { status: 200 })));

    try {
      await expect(new SyncHandler().execute({ name: 'blog', from: 'https://example.test' }))
        .rejects.toThrow(/valid doors array/);
      expect(() => readFileSync(join(root, '.fougere', 'remotes.json'), 'utf8')).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /**
   * The card a real host answers, copied from `demos/multi-frond/remote-blog`.
   *
   * Every other test here sends `ops: []`, which is why none of them noticed that sync
   * had started refusing every Fougere server: an op stopped being a bare name the day
   * the card began saying what an op DOES, and a private copy of the card's type in this
   * handler still said `string[]`. An empty array satisfies both readings.
   */
  it('accepts the card a real host answers, ops and all', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        fronds: [{
          name: 'blog',
          doors: [{
            name: 'post',
            ops: [
              { name: 'list', kind: 'query' },
              { name: 'findById', kind: 'query' },
              { name: 'create', kind: 'command', input: { type: 'object', properties: {} } },
              { name: 'publish', kind: 'command', description: 'Make the post public.' },
            ],
            schema: {
              title: 'Post',
              type: 'object',
              properties: {},
              'x-fougere-version': 1,
              'x-fougere-vendor': 'fougere',
            },
          }],
        }],
      },
    }), { status: 200 })));

    try {
      const out = await new SyncHandler().execute({ name: 'blog', from: 'https://example.test' });
      expect(out.entities).toEqual(['Post']);
      expect(readFileSync(join(root, '.fougere', 'remotes', 'blog', 'entities', 'Post.ts'), 'utf8'))
        .toContain('class Post extends reconstruct<');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /**
   * What the host stops serving stops being importable.
   *
   * The barrel is rewritten each run, so a dropped entity loses its export by itself — but
   * the FILE stayed, and the generated `package.json` exports `'./entities/*'` as a
   * wildcard. So `@frond/blog/entities/Ticket.js` kept resolving to a class that validates
   * perfectly and that nothing behind it answers for.
   */
  it('removes what the host no longer serves, and only what it wrote itself', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    const shape = { type: 'object', properties: { id: { type: 'string' } }, 'x-fougere-version': 1, 'x-fougere-vendor': 'fougere' };
    const cardWith = (names: string[]) => JSON.stringify({
      result: {
        fronds: [{
          name: 'blog',
          doors: names.map((name) => ({ name, ops: [{ name: 'list', kind: 'query' }], schema: shape })),
          facts: [],
        }],
      },
    });

    try {
      const dir = join(root, '.fougere', 'remotes', 'blog');

      vi.stubGlobal('fetch', vi.fn(async () => new Response(cardWith(['post', 'ticket']), { status: 200 })));
      await new SyncHandler().execute({ name: 'blog', from: 'https://example.test' });
      expect(readFileSync(join(dir, 'entities', 'Ticket.ts'), 'utf8')).toContain('class Ticket');

      // A file the operator put there by hand — sync owns the folder, not its contents.
      writeFileSync(join(dir, 'entities', 'Notes.ts'), 'export const mine = 1;\n');

      vi.unstubAllGlobals();
      vi.stubGlobal('fetch', vi.fn(async () => new Response(cardWith(['post']), { status: 200 })));
      const out = await new SyncHandler().execute({ name: 'blog', from: 'https://example.test' });

      expect(out.removed.sort()).toEqual(['Ticket.ts', 'TicketHandler.ts']);
      expect(() => readFileSync(join(dir, 'entities', 'Ticket.ts'), 'utf8')).toThrow();
      expect(() => readFileSync(join(dir, 'handlers', 'TicketHandler.ts'), 'utf8')).toThrow();
      // Still there, and still ours to leave alone.
      expect(readFileSync(join(dir, 'entities', 'Notes.ts'), 'utf8')).toContain('export const mine');
      expect(readFileSync(join(dir, 'entities', 'Post.ts'), 'utf8')).toContain('class Post');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /**
   * The reason a subscriber runs this command at all.
   *
   * A fact has no operation, so it never appeared among the doors and never crossed a
   * repository boundary: the listener kept a hand-written copy of the emitter's
   * declaration, and the two drifted with nothing to say so.
   *
   * Every other test here sends no `facts` key, which is deliberate — a host older than
   * the list must still sync.
   */
  it('writes a fact as a row class with no door beside it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    const shape = (properties: Record<string, unknown>) => ({
      type: 'object',
      properties,
      'x-fougere-version': 1,
      'x-fougere-vendor': 'fougere',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        fronds: [{
          name: 'blog',
          doors: [{ name: 'post', ops: [{ name: 'list', kind: 'query' }], schema: shape({ id: { type: 'string' } }) }],
          facts: [
            { name: 'postPublished', schema: shape({ id: { type: 'string' }, title: { type: 'string' } }) },
            // Announced without a declared shape: legal, and nothing to write. A class
            // built from the bare name would validate everything.
            { name: 'cacheWarmed' },
          ],
        }],
      },
    }), { status: 200 })));

    try {
      const out = await new SyncHandler().execute({ name: 'blog', from: 'https://example.test' });
      const dir = join(root, '.fougere', 'remotes', 'blog');

      expect(out.entities).toEqual(['Post', 'PostPublished']);
      expect(readFileSync(join(dir, 'entities', 'PostPublished.ts'), 'utf8'))
        .toContain('class PostPublished extends reconstruct<');

      // No façade type: nobody calls a fact, it arrives.
      expect(() => readFileSync(join(dir, 'handlers', 'PostPublishedHandler.ts'), 'utf8')).toThrow();
      expect(() => readFileSync(join(dir, 'entities', 'CacheWarmed.ts'), 'utf8')).toThrow();

      const barrel = readFileSync(join(dir, 'index.ts'), 'utf8');
      expect(barrel).toContain("export { default as PostPublished }");
      expect(barrel).not.toContain('PostPublishedHandler');
      expect(barrel).not.toContain('CacheWarmed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
