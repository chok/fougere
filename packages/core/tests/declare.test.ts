/**
 * A frond an app STATES — the path that needs no disk and no `typescript`.
 *
 * `createApp` consumes a `ScanResult`, never a scanner, and nothing had ever handed it one
 * built by hand: all twenty-four suites that boot an app call `scanProject`. So the shape
 * was reachable in principle and untested in fact, and the first attempt at it failed on a
 * field no signature mentions (`deps`), silently absent from every example.
 *
 * What these cases pin is the split measured on `demos/nuxt-blog`: 23 of 29 operations are
 * declared at RUNTIME by the prefab that built them, so a declaration states classes and
 * says nothing about them.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text, optional } from '@fougere/schema';
import { createApp, frond, Crud, Call, RouteAddress, EMPTY_INVOCATION } from '../src/index.js';

class Post extends entity({ id: primary(), title: text(), body: optional(text()) }) {}
class PostHandler extends Crud(Post) {}

const rows = [{ id: '1', title: 'hello', input: 'world' }];

const storageFactory = () => ({
  list: async () => ({ items: rows, total: rows.length }),
  findById: async (id: string) => rows.find((r) => r.id === id),
}) as never;

// `fronds:` and no `scan:` — the app states what it hosts and nothing reads a disk.
const appOf = () => createApp({
  createContainer,
  storageFactory,
  fronds: [frond('blog', { entities: [Post], handlers: [PostHandler] })],
});

describe('a frond the app states', () => {
  it('boots and answers, with no scan behind it', async () => {
    await using app = await appOf();

    const page = await app.dispatch(new Call(
      new RouteAddress({ entity: 'post', operation: 'list' }), EMPTY_INVOCATION));

    expect(page).toMatchObject({ items: [{ id: '1', title: 'hello' }] });
  });

  it('serves the five CRUD operations the prefab declares, none of them stated here', async () => {
    await using app = await appOf();

    // `Crud.__ops` is runtime, so it survives a scan that resolved nothing — and a
    // declaration that resolved nothing on purpose is the same case.
    const one = await app.dispatch(new Call(
      new RouteAddress({ entity: 'post', operation: 'findById' }),
      { params: { id: '1' }, query: {}, input: {}, state: {} }));

    expect(one).toMatchObject({ id: '1' });
  });

  it('derives every name the scan would have derived', () => {
    const d = frond('blog', { entities: [Post], handlers: [PostHandler] });

    // `Post` is stored as `post`, `PostHandler` answers at `post` — the suffix rule the
    // scanner applies to a file it found, applied to a class it was handed.
    expect(d.entities[0]).toMatchObject({ name: 'post', entityClass: Post });
    expect(d.handlers[0]).toMatchObject({ name: 'PostHandler', address: 'post', ctor: PostHandler });
    expect(d.source.package, 'the conventional import scope').toBe('@fronds/blog');
  });

  it('asks for `deps` only where a constructor names a frame or a port', () => {
    class Payment {}
    class Checkout { constructor(public payment: Payment) {} }

    const bare = frond('shop', { handlers: [Checkout] });
    const asking = frond('shop', { handlers: [{ ctor: Checkout, deps: ['Payment'] }] });

    // Erasure is the whole reason this is stated: nothing at runtime can read the type of
    // a constructor parameter, and `registerFrames` reads `deps` to know what to build.
    expect(bare.handlers[0]!.deps).toEqual([]);
    expect(asking.handlers[0]!.deps).toEqual(['Payment']);
  });
});
