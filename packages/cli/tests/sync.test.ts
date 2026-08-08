import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
          entities: [{
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
          entities: [
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
          entities: [{
            name: '../../escape',
            ops: [],
            schema: { type: 'object', properties: {}, 'x-fougere-version': 1, 'x-fougere-vendor': 'fougere' },
          }],
        }],
      },
    }), { status: 200 })));

    try {
      await expect(new SyncHandler().execute({ name: 'blog', from: 'https://example.test' }))
        .rejects.toThrow(/Invalid entity name/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a malformed nested identity card before writing files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-sync-'));
    process.chdir(root);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: { fronds: [{ name: 'blog', entities: {} }] },
    }), { status: 200 })));

    try {
      await expect(new SyncHandler().execute({ name: 'blog', from: 'https://example.test' }))
        .rejects.toThrow(/valid entities array/);
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
          entities: [{
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

});
