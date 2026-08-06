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

});
