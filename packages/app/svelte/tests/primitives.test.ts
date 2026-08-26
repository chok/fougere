/**
 * The primitives, in Svelte — testable without a DOM, which is exactly why the
 * package is written with stores rather than runes.
 *
 * What is pinned here is the CONTRACT the three clients share: a read designates by
 * class and verb, a command on an entity revalidates the reads mounted on that same
 * entity, a form's fields come from the entity's own axes, and a refusal lands per
 * field whoever judged. The Vue and React versions state the same things against
 * their own state primitives; if one of them drifts, this is the shape it drifted from.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { entity, primary, text, oneOf, readOnly, created } from '@fougere/schema';
import { ErrorCode } from '@fougere/core/contract';
import { useQuery, useCommand } from '../src/useFougereData.js';
import { useFormFor } from '../src/useFormFor.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  createdAt: created(),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
}) {}

/** The wire, stubbed: one JSON-RPC answer per call, and the calls recorded. */
function wire(answer: (method: string, params: unknown) => unknown) {
  const calls: { method: string; params: any }[] = [];
  globalThis.fetch = vi.fn(async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    calls.push({ method: body.method, params: body.params });
    const result = answer(body.method, body.params);
    return {
      json: async () =>
        result instanceof Error
          ? { jsonrpc: '2.0', id: body.id, error: { code: -32000, message: result.message, data: (result as any).data } }
          : { jsonrpc: '2.0', id: body.id, result },
    } as any;
  }) as any;
  return calls;
}

/** Let the store's own fetch settle. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/**
 * The link's registry is module-global by design — a command has to find reads it
 * never met. So a test leaving a query mounted pollutes the next one, and that is
 * not hypothetical: it happened here, and the symptom looked like a double fetch in
 * the framework. Disposal belongs in teardown, not after an assertion that can fail.
 */
const mounted: { dispose(): void }[] = [];
const track = <T extends { dispose(): void }>(store: T): T => (mounted.push(store), store);

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const store of mounted.splice(0)) store.dispose();
});

describe('useQuery', () => {
  it('designates by class and verb, and reads on mount', async () => {
    const calls = wire(() => [{ id: 'a', title: 'first' }]);
    const posts = track(useQuery<any>(Post, 'list'));

    expect(get(posts).loading).toBe(true);
    await settle();

    expect(calls[0]!.method).toBe('post.list');
    expect(get(posts).items).toEqual([{ id: 'a', title: 'first' }]);
    expect(get(posts).loading).toBe(false);
  });

  it('reads the page facts out of an envelope', async () => {
    wire(() => ({ items: [{ id: 'a' }], total: 7, hasMore: true }));
    const posts = track(useQuery<any>(Post, 'list'));
    await settle();

    expect(get(posts).items).toEqual([{ id: 'a' }]);
    expect(get(posts).total).toBe(7);
    expect(get(posts).hasMore).toBe(true);
  });

  it('does not read when told not to', async () => {
    const calls = wire(() => []);
    const posts = track(useQuery<any>(Post, 'list', undefined, { immediate: false }));
    await settle();

    expect(calls).toHaveLength(0);
    expect(get(posts).loading).toBe(false);
  });

  it('carries a refusal instead of throwing at the subscriber', async () => {
    wire(() => Object.assign(new Error('nope'), {}));
    const posts = track(useQuery<any>(Post, 'list'));
    await settle();

    expect(get(posts).error?.message).toContain('nope');
    expect(get(posts).items).toEqual([]);
  });
});

describe('the link — a command revalidates the reads on its entity', () => {
  it('re-reads a mounted query after a successful command', async () => {
    let round = 0;
    const calls = wire((method) => (method === 'post.list' ? [{ id: String(++round) }] : { ok: true }));

    const posts = track(useQuery<any>(Post, 'list'));
    await settle();
    expect(get(posts).items).toEqual([{ id: '1' }]);

    await useCommand(Post, 'publish').execute({ params: { id: '1' } });
    await settle();

    expect(get(posts).items).toEqual([{ id: '2' }]);
    expect(calls.map((c) => c.method)).toEqual(['post.list', 'post.publish', 'post.list']);
  });

  it('forgets a read once disposed — a stale key would refetch nothing', async () => {
    const calls = wire(() => []);
    const posts = track(useQuery<any>(Post, 'list'));
    await settle();
    posts.dispose();

    await useCommand(Post, 'publish').execute();
    await settle();

    expect(calls.filter((c) => c.method === 'post.list')).toHaveLength(1);
  });

  it('leaves another entity\'s reads alone', async () => {
    class Author extends entity({ id: primary(), name: text() }) {}
    const calls = wire(() => []);

    const authors = track(useQuery<any>(Author, 'list'));
    await settle();
    await useCommand(Post, 'publish').execute();
    await settle();

    expect(calls.filter((c) => c.method === 'author.list')).toHaveLength(1);
  });
});

describe('useCommand', () => {
  it('reports a refusal on the store and rethrows it', async () => {
    wire(() => new Error('Only the author can publish'));
    const publish = useCommand(Post, 'publish');

    await expect(publish.execute()).rejects.toThrow('Only the author can publish');
    expect(get(publish).error?.message).toContain('Only the author can publish');
    expect(get(publish).loading).toBe(false);
  });
});

describe('useFormFor', () => {
  it('offers only the fields a client may supply', () => {
    const form = useFormFor(Post as never);
    const names = form.fields.map((f) => f.name);

    // `id` and `createdAt` are filled by the lifecycle axis, `status` is readOnly.
    expect(names).toEqual(['title', 'body']);
  });

  it('carries the shape\'s bounds under the names a browser enforces', () => {
    const form = useFormFor(Post as never);
    expect(form.fieldsByName.title!.attrs).toMatchObject({ minlength: 1, maxlength: 200, required: true });
  });

  it('judges locally with the same rules the handler runs', async () => {
    const calls = wire(() => ({ id: 'new' }));
    const form = useFormFor(Post as never);

    form.values.set({ title: '', body: 'b' });
    expect(await form.submit()).toBeNull();
    // 'Required', not 'too short': an empty control is an ABSENT value at the create
    // boundary (`payloadOf` drops it), so the lifecycle axis judges it, not the shape.
    expect(get(form.errors).title).toBe('Required');
    // Refused before the wire — the round-trip is saved, not just reported.
    expect(calls).toHaveLength(0);
  });

  it('sends what the form holds once it passes', async () => {
    const calls = wire(() => ({ id: 'new' }));
    const form = useFormFor(Post as never);

    form.values.set({ title: 'ok', body: 'b' });
    expect(await form.submit()).toEqual({ id: 'new' });
    expect(calls[0]!.method).toBe('post.create');
    expect(calls[0]!.params.body).toEqual({ title: 'ok', body: 'b' });
  });

  it('lands a remote refusal per field, so the form never knows who judged', async () => {
    wire(() =>
      Object.assign(new Error('title: too short'), {
        data: { code: ErrorCode.VALIDATION_FAILED, details: [{ path: 'title', message: 'too short' }] },
      }),
    );
    const form = useFormFor(Post as never);

    // Passes the local judge, so only the server can refuse it.
    form.values.set({ title: 'fine', body: 'b' });
    expect(await form.submit()).toBeNull();
    expect(get(form.errors).title).toBe('too short');
  });

  it('rides the op it is told to, on the target it names', async () => {
    const calls = wire(() => ({ id: 'a' }));
    const form = useFormFor(Post as never, { op: 'update', params: { id: 'a' }, initial: { title: 'was', body: 'b' } });

    expect(get(form.values).title).toBe('was');
    await form.submit();
    expect(calls[0]!.method).toBe('post.update');
    expect(calls[0]!.params.params).toEqual({ id: 'a' });
  });
});

describe('the packaging decision', () => {
  it('uses no runes, so the package compiles with tsc alone', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    // A `.svelte.ts` file needs the Svelte compiler, so a library written with runes
    // ships SOURCE and forces every consumer's bundler to compile it. Stores are
    // plain TypeScript — which is why the 14 tests above run with no compiler and no
    // DOM at all. That is the decision, and this is what would catch its reversal.
    const sources = readdirSync('src').filter((f) => f.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(0);

    for (const file of sources) {
      expect(file).not.toMatch(/\.svelte\.ts$/);
      const code = readFileSync(join('src', file), 'utf8');
      expect(code).not.toMatch(/\$state\(|\$derived\(|\$effect\(/);
    }
  });
});
