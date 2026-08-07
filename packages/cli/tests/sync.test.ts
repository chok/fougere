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
      expect(generated).toContain('const Post = reconstruct(');
      expect(generated).not.toContain("const Post; await import");

      // La carte porte de quoi typer, et jusqu'ici personne ne le lisait :
      // `reconstruct` rend un générique, donc l'entité synchronisée validait
      // parfaitement et n'apprenait rien au compilateur.
      expect(generated).toContain('export interface Post {');
      // Le nom est partagé entre l'interface et la const — comme une classe, pour
      // qu'un seul import donne la valeur et le type.
      expect(generated).toContain('export const Post = reconstruct(');
      // Et le `title` de l'hôte ne nomme RIEN : l'interface prend le nom déjà
      // assaini, sinon la charge de ce test entrerait par cette deuxième porte.
      // (La chaîne reste présente DANS la carte, en donnée inerte — c'est ce que
      // la sonde d'origine ci-dessus vérifie déjà.)
      expect(generated).not.toContain("interface Post; await import");
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
        .toContain('const Post = reconstruct(');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
