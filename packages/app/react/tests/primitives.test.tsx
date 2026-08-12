/**
 * The primitives, in React.
 *
 * The same contract the Svelte package pins in `tests/primitives.test.ts` — a read
 * designates by class and verb, a command on an entity revalidates the reads mounted
 * on that entity, a form's fields come from the entity's own axes. Written twice
 * against two state models on purpose: if the two files stop agreeing, one of the
 * clients has drifted from the shared rules in `@fougere/app/client`.
 *
 * This one needs jsdom and a renderer; the Svelte one needs neither. That is the
 * cost of hooks, not of the design.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
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
  const calls: Array<{ method: string; params: any }> = [];
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

beforeEach(() => {
  vi.restoreAllMocks();
});

/**
 * Testing Library only registers its own cleanup when the test globals are exposed,
 * and this package does not expose them. Without this, every hook rendered stays
 * mounted for the rest of the file — and since the link's registry is module-global
 * by design, a later command revalidates them all. The symptom read as a double
 * fetch in the framework; it was leftover components.
 */
afterEach(cleanup);

describe('useQuery', () => {
  it('designates by class and verb, and reads on mount', async () => {
    const calls = wire(() => [{ id: 'a', title: 'first' }]);
    const { result } = renderHook(() => useQuery<any>(Post, 'list'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls[0]!.method).toBe('post.list');
    expect(result.current.items).toEqual([{ id: 'a', title: 'first' }]);
  });

  it('reads the page facts out of an envelope', async () => {
    wire(() => ({ items: [{ id: 'a' }], total: 7, hasMore: true }));
    const { result } = renderHook(() => useQuery<any>(Post, 'list'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([{ id: 'a' }]);
    expect(result.current.total).toBe(7);
    expect(result.current.hasMore).toBe(true);
  });

  it('does not read when told not to', async () => {
    const calls = wire(() => []);
    const { result } = renderHook(() => useQuery<any>(Post, 'list', undefined, { immediate: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toHaveLength(0);
  });

  it('reads once for one designation, not once per render', async () => {
    const calls = wire(() => []);
    const { rerender, result } = renderHook(() => useQuery<any>(Post, 'list', { query: { page: '1' } }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // A fresh input literal on every render — the key is what the effect depends on,
    // and if it were the object this would fetch forever.
    rerender();
    rerender();

    expect(calls.filter((c) => c.method === 'post.list')).toHaveLength(1);
  });

  it('carries a refusal instead of throwing at the component', async () => {
    wire(() => new Error('nope'));
    const { result } = renderHook(() => useQuery<any>(Post, 'list'));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error!.message).toContain('nope');
    expect(result.current.items).toEqual([]);
  });
});

describe('the link — a command revalidates the reads on its entity', () => {
  it('re-reads a mounted query after a successful command', async () => {
    let round = 0;
    const calls = wire((method) => (method === 'post.list' ? [{ id: String(++round) }] : { ok: true }));

    const query = renderHook(() => useQuery<any>(Post, 'list'));
    await waitFor(() => expect(query.result.current.items).toEqual([{ id: '1' }]));

    const command = renderHook(() => useCommand(Post, 'publish'));
    await act(async () => { await command.result.current.execute({ params: { id: '1' } }); });

    await waitFor(() => expect(query.result.current.items).toEqual([{ id: '2' }]));
    expect(calls.map((c) => c.method)).toEqual(['post.list', 'post.publish', 'post.list']);
  });

  it('forgets a read once its component unmounts', async () => {
    const calls = wire(() => []);
    const query = renderHook(() => useQuery<any>(Post, 'list'));
    await waitFor(() => expect(query.result.current.loading).toBe(false));
    query.unmount();

    const command = renderHook(() => useCommand(Post, 'publish'));
    await act(async () => { await command.result.current.execute(); });

    expect(calls.filter((c) => c.method === 'post.list')).toHaveLength(1);
  });

  it("leaves another entity's reads alone", async () => {
    class Author extends entity({ id: primary(), name: text() }) {}
    const calls = wire(() => []);

    const query = renderHook(() => useQuery<any>(Author, 'list'));
    await waitFor(() => expect(query.result.current.loading).toBe(false));

    const command = renderHook(() => useCommand(Post, 'publish'));
    await act(async () => { await command.result.current.execute(); });

    expect(calls.filter((c) => c.method === 'author.list')).toHaveLength(1);
    query.unmount();
  });
});

describe('useCommand', () => {
  it('reports a refusal and rethrows it', async () => {
    wire(() => new Error('Only the author can publish'));
    const { result } = renderHook(() => useCommand(Post, 'publish'));

    await act(async () => {
      await expect(result.current.execute()).rejects.toThrow('Only the author can publish');
    });
    expect(result.current.error!.message).toContain('Only the author can publish');
    expect(result.current.loading).toBe(false);
  });
});

describe('useFormFor', () => {
  it('offers only the fields a client may supply', () => {
    const { result } = renderHook(() => useFormFor(Post as never));
    // `id` and `createdAt` are filled by the lifecycle axis, `status` is readOnly.
    expect(result.current.fields.map((f) => f.name)).toEqual(['title', 'body']);
  });

  it("carries the shape's bounds under the names a browser enforces", () => {
    const { result } = renderHook(() => useFormFor(Post as never));
    expect(result.current.fieldsByName.title!.attrs).toMatchObject({
      minlength: 1,
      maxlength: 200,
      required: true,
    });
  });

  it('judges locally with the same rules the handler runs', async () => {
    const calls = wire(() => ({ id: 'new' }));
    const { result } = renderHook(() => useFormFor(Post as never));

    act(() => { result.current.setValue('body', 'b'); });
    await act(async () => { expect(await result.current.submit()).toBeNull(); });

    // 'Required', not a length complaint: an absent value is judged by the lifecycle
    // axis, and `payloadOf` drops an empty control before the shape ever sees it.
    expect(result.current.errors.title).toBe('Required');
    expect(calls).toHaveLength(0);
  });

  it('sends what the form holds once it passes', async () => {
    const calls = wire(() => ({ id: 'new' }));
    const { result } = renderHook(() => useFormFor(Post as never));

    act(() => {
      result.current.setValue('title', 'ok');
      result.current.setValue('body', 'b');
    });
    await act(async () => { expect(await result.current.submit()).toEqual({ id: 'new' }); });

    expect(calls[0]!.method).toBe('post.create');
    expect(calls[0]!.params.body).toEqual({ title: 'ok', body: 'b' });
  });

  it('lands a remote refusal per field, so the form never knows who judged', async () => {
    wire(() =>
      Object.assign(new Error('title: too short'), {
        data: { code: ErrorCode.VALIDATION_FAILED, details: [{ path: 'title', message: 'too short' }] },
      }),
    );
    const { result } = renderHook(() => useFormFor(Post as never));

    act(() => {
      result.current.setValue('title', 'fine');
      result.current.setValue('body', 'b');
    });
    await act(async () => { expect(await result.current.submit()).toBeNull(); });

    expect(result.current.errors.title).toBe('too short');
  });

  it('opens on the row it is editing, and rides the op it is told to', async () => {
    const calls = wire(() => ({ id: 'a' }));
    const { result } = renderHook(() =>
      useFormFor(Post as never, { op: 'update', params: { id: 'a' }, initial: { title: 'was', body: 'b' } }),
    );

    expect(result.current.values.title).toBe('was');
    await act(async () => { await result.current.submit(); });

    expect(calls[0]!.method).toBe('post.update');
    expect(calls[0]!.params.params).toEqual({ id: 'a' });
  });
});
