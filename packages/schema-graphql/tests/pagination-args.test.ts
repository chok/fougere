import { describe, it, expect } from 'vitest';
import SchemaBuilder from '@pothos/core';
import { entity, primary, text } from '@fougere/schema';
import { registerType, registerOperations } from '../src/pothos.js';

/**
 * `ListOptions` is classified twice, and the first classification wins.
 *
 * `SKIP_TYPES` (pothos.ts:123) holds 'ListOptions', and the skip branch runs
 * BEFORE the pagination branch — so `kind: 'pagination'` is never assigned,
 * `hasPagination` is never true, and the six arguments the code below builds are
 * never attached. A `list(options?: ListOptions)` op therefore paginates through
 * the façade and through REST, and cannot be paginated through GraphQL at all.
 */
describe('a list op that declares ListOptions', () => {
  it('exposes the pagination arguments GraphQL builds for it', () => {
    class Post extends entity({ id: primary(), title: text() }) {}
    const builder = new SchemaBuilder({});
    const PostType = registerType(builder, { name: 'Post', entity: Post });
    builder.queryType({});

    registerOperations(builder, {
      name: 'Post',
      type: PostType,
      facade: { list: () => [] },
      operations: new Map([
        ['list', {
          signature: {
            name: 'list',
            params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
            returnType: { raw: 'ListResult<Post>', name: 'ListResult', generics: [{ raw: 'Post', name: 'Post' }] },
          },
        }],
      ]) as any,
    });

    const args = builder.toSchema().getQueryType()!.getFields()['posts'].args.map((a) => a.name);
    expect(args).toEqual(expect.arrayContaining(['limit', 'offset', 'page', 'after', 'orderBy', 'order']));
  });
});
