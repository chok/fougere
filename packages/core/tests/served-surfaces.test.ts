/** One rule, two readers: the routes the boot registers and the model's `exposure`. */
import { describe, expect, it } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { resolveEffectiveOperations, type FrondDescriptor, type HandlerEntry } from '../src/index.js';
import { servedSurfaces } from '../src/descriptor/surface.js';

class Post extends entity({ id: primary(), title: text() }) {}

class PostHandler {
  list(): Post[] {
    return [];
  }
}

function handlerFor(address: string, surface?: string): HandlerEntry {
  return {
    name: `${address}Handler`,
    address,
    ctor: PostHandler,
    operations: new Map([['list', {
      name: 'list',
      params: [],
      returns: { raw: 'Post[]', typeName: 'Post', isArray: true },
    }]]) as HandlerEntry['operations'],
    deps: [],
    filePath: `/app/fronds/blog/handlers/${surface ? `${surface}/` : ''}PostHandler.ts`,
    exposed: true,
    ...(surface ? { surface } : {}),
  };
}

function frondWith(
  handlers: HandlerEntry[],
  surfaces?: Record<string, string[]>,
): FrondDescriptor {
  return {
    name: 'blog',
    source: { path: '/app/fronds/blog', package: '@fronds/blog' },
    providers: [],
    entities: [{ name: 'post', entityClass: Post, filePath: '/app/fronds/blog/entities/Post.ts', exposed: true }],
    handlers,
    presenters: [],
    collectors: [],
    seeds: [],
    middlewares: [],
    ...(surfaces ? { surfaces } : {}),
  };
}

describe('the surfaces a handler answers on', () => {
  it('gives a handler with a door of its own that door alone', () => {
    const dedicated = handlerFor('post', 'public');
    const frond = frondWith([handlerFor('post'), dedicated], { public: ['post'] });

    expect(servedSurfaces(frond, dedicated)).toEqual(['public']);
  });

  it('gives a handler with no door of its own the default alone when nothing names it', () => {
    const handler = handlerFor('post');

    expect(servedSurfaces(frondWith([handler]), handler)).toEqual([undefined]);
  });

  it('adds every declared surface that names the address, sorted', () => {
    const handler = handlerFor('post');
    const frond = frondWith([handler], { public: ['post'], admin: ['post'], mobile: ['author'] });

    expect(servedSurfaces(frond, handler)).toEqual([undefined, 'admin', 'public']);
  });

  it('reads a declared address whatever its case — a config states `Post`, a handler answers to `post`', () => {
    const handler = handlerFor('post');

    expect(servedSurfaces(frondWith([handler], { public: ['Post'] }), handler)).toEqual([undefined, 'public']);
  });

  it('steps aside where the surface opened a door of its own', () => {
    const handler = handlerFor('post');
    const frond = frondWith([handler, handlerFor('post', 'public')], { public: ['post'], admin: ['post'] });

    expect(servedSurfaces(frond, handler)).toEqual([undefined, 'admin']);
  });

  /**
   * `surfaces:` admits any key, `'default'` included, and the effective model spells the
   * absence with that same word — so the audience is named twice. Pinned as it stands: the
   * rule now has one owner, and what to do with the collision is a separate decision.
   */
  it('meets itself when a surface is named `default`', () => {
    const handler = handlerFor('post');
    const frond = frondWith([handler], { default: ['post'] });

    expect(servedSurfaces(frond, handler)).toEqual([undefined, 'default']);

    const model = resolveEffectiveOperations([frond]);
    expect(model.forHandler(handler).get('list')!.exposure.surfaces).toEqual(['default', 'default']);
  });

  it('is what the effective model exposes, with the absence spelled `default`', () => {
    const handler = handlerFor('post');
    const frond = frondWith([handler], { public: ['post'] });
    const model = resolveEffectiveOperations([frond]);

    expect(model.forHandler(handler).get('list')!.exposure.surfaces).toEqual(['default', 'public']);
  });
});
