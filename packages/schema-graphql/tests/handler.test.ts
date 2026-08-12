import { describe, it, expect, vi } from 'vitest';
import SchemaBuilder from '@pothos/core';
import { entity, primary, text, number, created, ref, many, type EntityConstructor } from '@fougere/schema';
import { registerAll } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
}) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ integer: true }),
  createdAt: created(),
}) {}

function fakeCrud(data: Record<string, unknown>[] = []) {
  return {
    list: vi.fn(async () => data),
    findById: vi.fn(async (id: string) => data.find((d) => d.id === id)),
    create: vi.fn(async (input: any) => ({ id: '1', ...input })),
    update: vi.fn(async (id: string, input: any) => ({ id, ...input })),
    delete: vi.fn(async () => true),
  };
}

/** Build a standard CRUD OperationsMap with proper parsed signatures. */
function crudOps(entityName: string, entityClass?: any): Map<string, any> {
  return new Map([
    ['list', {
      signature: {
        name: 'list',
        params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
        returnType: { raw: `ListResult<${entityName}>`, name: 'ListResult', generics: [{ raw: entityName, name: entityName }] },
      },
    }],
    ['findById', {
      signature: {
        name: 'findById',
        params: [{ name: 'id', type: { raw: 'string', name: 'string' } }],
        returnType: { raw: `${entityName} | undefined`, name: entityName, nullable: true },
      },
    }],
    ['create', {
      input: entityClass,
      output: entityClass,
      signature: {
        name: 'create',
        params: [{ name: 'input', type: { raw: entityName, name: entityName } }],
        returnType: { raw: entityName, name: entityName },
      },
    }],
    ['update', {
      input: entityClass,
      output: entityClass,
      signature: {
        name: 'update',
        params: [
          { name: 'id', type: { raw: 'string', name: 'string' } },
          { name: 'input', type: { raw: `Partial<${entityName}>`, name: 'Partial', generics: [{ raw: entityName, name: entityName }] } },
        ],
        returnType: { raw: entityName, name: entityName },
      },
    }],
    ['delete', {
      signature: {
        name: 'delete',
        params: [{ name: 'id', type: { raw: 'string', name: 'string' } }],
        returnType: { raw: 'boolean', name: 'boolean' },
      },
    }],
  ]);
}

/** Pick specific ops from a full CRUD ops map. */
function pickOps(ops: Map<string, any>, names: string[]): Map<string, any> {
  const result = new Map<string, any>();
  for (const name of names) {
    const entry = ops.get(name);
    if (entry) result.set(name, entry);
  }
  return result;
}

/** Add custom ops to an existing map. */
function withCustomOps(
  base: Map<string, any>,
  custom: Record<string, { input?: any; output?: any; signature: any }>,
): Map<string, any> {
  const result = new Map(base);
  for (const [name, meta] of Object.entries(custom)) {
    result.set(name, meta);
  }
  return result;
}

function fakeApp(
  entities: { name: string; entityClass: any }[],
  facades: Record<string, any>,
  handlers?: { address: string; operations: Map<string, any> }[],
  surfaces?: Record<string, string[]>,
) {
  const effectiveHandlers = handlers !== undefined ? handlers : entities
    .filter((e) => facades[`${e.name}Handler`])
    .map((e) => ({
      address: e.name,
      operations: crudOps(e.entityClass.name, e.entityClass),
    }));
  return {
    fronds: [{ name: 'test', entities, handlers: effectiveHandlers, presenters: [], surfaces }],
    resolve: <T>(name: string) => facades[name] as unknown as T,
    // Mirrors App.facadeFor (bootstrap.ts): naming an audience closes it —
    // the `surfaces:` list when it exists, else a façade under the surface key.
    facadeFor: (entity: string, surface?: string) => {
      if (!surface) return facades[`${entity}Handler`];
      const own = facades[`${surface}:${entity}Handler`];
      const declared = surfaces?.[surface];
      if (!declared) return own;
      return declared.some((n) => n.toLowerCase() === entity.toLowerCase())
        ? (own ?? facades[`${entity}Handler`])
        : undefined;
    },
    // The dual of `facadeFor` (added to AppLike in c8e4c32). These fixtures declare no
    // presenters, so the honest answer is that there is none — not that the method is
    // missing, which is what left this file red while its three siblings were updated.
    presenterFor: () => undefined,
  };
}

// ─── Tests ─────────────────────────────────────

describe('registerAll', () => {
  it('generates types, inputs, queries and mutations for all entities', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud(), postHandler: fakeCrud() },
    );

    registerAll(builder, app);
    const schema = builder.toSchema();
    const typeMap = schema.getTypeMap();

    expect(typeMap['Author']).toBeDefined();
    expect(typeMap['Post']).toBeDefined();
    expect(typeMap['CreateAuthorInput']).toBeDefined();
    expect(typeMap['UpdateAuthorInput']).toBeDefined();
    expect(typeMap['CreatePostInput']).toBeDefined();
    expect(typeMap['UpdatePostInput']).toBeDefined();

    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields['authors']).toBeDefined();
    expect(queryFields['author']).toBeDefined();
    expect(queryFields['posts']).toBeDefined();
    expect(queryFields['post']).toBeDefined();

    const mutationFields = schema.getMutationType()!.getFields();
    expect(mutationFields['createAuthor']).toBeDefined();
    expect(mutationFields['updateAuthor']).toBeDefined();
    expect(mutationFields['deleteAuthor']).toBeDefined();
    expect(mutationFields['createPost']).toBeDefined();
    expect(mutationFields['deletePost']).toBeDefined();
  });

  it('excludes primary and auto fields from create input', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: fakeCrud() },
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const createInput = schema.getTypeMap()['CreatePostInput'] as any;
    const fields = createInput.getFields();

    expect(fields['id']).toBeUndefined();
    expect(fields['createdAt']).toBeUndefined();
    expect(fields['title']).toBeDefined();
    expect(fields['views']).toBeDefined();
  });

  it('makes all update input fields nullable', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [{ name: 'author', entityClass: Author }],
      { authorHandler: fakeCrud() },
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const updateInput = schema.getTypeMap()['UpdateAuthorInput'] as any;
    const fields = updateInput.getFields();

    expect(fields['name'].type.toString()).toBe('String');
    expect(fields['email'].type.toString()).toBe('String');
  });

  it('skips entities without a handler facade', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud() },
    );

    registerAll(builder, app);
    const schema = builder.toSchema();
    const typeMap = schema.getTypeMap();

    expect(typeMap['Author']).toBeDefined();
    expect(typeMap['Post']).toBeUndefined();
  });

  it('respects filter option', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud(), postHandler: fakeCrud() },
    );

    registerAll(builder, app, {
      filter: (entity) => entity.name === 'author',
    });

    const schema = builder.toSchema();
    const typeMap = schema.getTypeMap();

    expect(typeMap['Author']).toBeDefined();
    expect(typeMap['Post']).toBeUndefined();
  });

  it('restricts operations via handler', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const crud = fakeCrud();
    const readOps = pickOps(crudOps('Post', Post), ['list', 'findById']);
    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: { list: crud.list, findById: crud.findById } },
      [{ address: 'post', operations: readOps }],
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields['posts']).toBeDefined();
    expect(queryFields['post']).toBeDefined();

    const mutationFields = schema.getMutationType()!.getFields();
    expect(mutationFields['createPost']).toBeUndefined();
    expect(mutationFields['updatePost']).toBeUndefined();
    expect(mutationFields['deletePost']).toBeUndefined();

    const typeMap = schema.getTypeMap();
    expect(typeMap['CreatePostInput']).toBeUndefined();
    expect(typeMap['UpdatePostInput']).toBeUndefined();
  });

  it('handler with only create exposes create mutation but no list/findById', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const crud = fakeCrud();
    const createOps = pickOps(crudOps('Author', Author), ['create']);
    const app = fakeApp(
      [{ name: 'author', entityClass: Author }],
      { authorHandler: { create: crud.create } },
      [{ address: 'author', operations: createOps }],
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields['authors']).toBeUndefined();
    expect(queryFields['author']).toBeUndefined();

    const mutationFields = schema.getMutationType()!.getFields();
    expect(mutationFields['createAuthor']).toBeDefined();
    expect(mutationFields['deleteAuthor']).toBeUndefined();
  });

  it('no handler means read-only operations only (secure default)', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const crud = fakeCrud();
    const readOps = pickOps(crudOps('Author', Author), ['list', 'findById']);
    const app = fakeApp(
      [{ name: 'author', entityClass: Author }],
      { authorHandler: { list: crud.list, findById: crud.findById } },
      [{ address: 'author', operations: readOps }],
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields['authors']).toBeDefined();
    expect(queryFields['author']).toBeDefined();

    const mutationFields = schema.getMutationType()?.getFields() ?? {};
    expect(mutationFields['createAuthor']).toBeUndefined();
    expect(mutationFields['updateAuthor']).toBeUndefined();
    expect(mutationFields['deleteAuthor']).toBeUndefined();
  });

  it('registers custom query operations', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const searchFn = vi.fn(async () => []);
    const ops = withCustomOps(
      crudOps('Post', Post),
      {
        searchByTitle: {
          input: Post.pick('title'),
          output: Post.pick('id', 'title'),
          signature: {
            name: 'searchByTitle',
            params: [{ name: 'input', type: { raw: 'SearchByTitleInput', name: 'SearchByTitleInput' } }],
            returnType: { raw: 'SearchByTitleOutput[]', name: 'SearchByTitleOutput', array: true },
          },
        },
      },
    );

    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: { ...fakeCrud(), searchByTitle: searchFn } },
      [{ address: 'post', operations: ops }],
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields['searchByTitle']).toBeDefined();

    const typeMap = schema.getTypeMap();
    expect(typeMap['SearchByTitlePostInput']).toBeDefined();
    // Output is the entity type itself (Post) — no separate *Output type
    expect(typeMap['Post']).toBeDefined();
  });

  it('registers custom mutation operations', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const publishFn = vi.fn(async () => ({ id: '1' }));
    const ops = withCustomOps(
      crudOps('Post', Post),
      {
        publish: {
          input: Post.pick('id'),
          output: Post.pick('id', 'title'),
          signature: {
            name: 'publish',
            params: [{ name: 'input', type: { raw: 'PublishInput', name: 'PublishInput' } }],
            returnType: { raw: 'PublishOutput', name: 'PublishOutput' },
          },
        },
      },
    );

    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: { ...fakeCrud(), publish: publishFn } },
      [{ address: 'post', operations: ops }],
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const mutationFields = schema.getMutationType()!.getFields();
    expect(mutationFields['publish']).toBeDefined();

    const typeMap = schema.getTypeMap();
    expect(typeMap['PublishPostInput']).toBeDefined();
  });

  it('operation without input generates no input arg', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const ops = withCustomOps(
      pickOps(crudOps('Post', Post), ['list', 'findById']),
      {
        listFeatured: {
          output: Post.pick('id', 'title'),
          signature: {
            name: 'listFeatured',
            params: [],
            returnType: { raw: 'Post[]', name: 'Post', array: true },
          },
        },
      },
    );

    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: { ...fakeCrud(), listFeatured: vi.fn(async () => []) } },
      [{ address: 'post', operations: ops }],
    );

    registerAll(builder, app);
    const schema = builder.toSchema();

    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields['listFeatured']).toBeDefined();
    expect(queryFields['listFeatured'].args).toHaveLength(0);
  });

  it('surface config filters entities for this surface', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud(), postHandler: fakeCrud() },
      undefined,
      { graphql: ['Post'] },
    );

    registerAll(builder, app, { surface: 'graphql' });
    const schema = builder.toSchema();
    const typeMap = schema.getTypeMap();

    expect(typeMap['Post']).toBeDefined();
    expect(typeMap['Author']).toBeUndefined();
  });

  it('without surface option, surfaces config is ignored (default: all exposed)', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud(), postHandler: fakeCrud() },
      undefined,
      { graphql: ['Post'] },
    );

    registerAll(builder, app);
    const schema = builder.toSchema();
    const typeMap = schema.getTypeMap();

    expect(typeMap['Post']).toBeDefined();
    expect(typeMap['Author']).toBeDefined();
  });

  it('a surface nothing declares serves nothing — it does not fall back to the full façade', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud(), postHandler: fakeCrud() },
      undefined,
      { rest: ['Post'] },
    );

    // surface='graphql', but nothing names an entity into it: no handler under
    // handlers/graphql/, no `graphql` list. This used to widen — both entities
    // got mounted whole on a door nobody declared.
    registerAll(builder, app, { surface: 'graphql' });
    const typeMap = builder.toSchema().getTypeMap();

    expect(typeMap['Post']).toBeUndefined();
    expect(typeMap['Author']).toBeUndefined();
  });

  it('a surface handler names its entity in, and the rest stays out', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    // The nuxt-blog shape: `handlers/public/PostHandler.ts` exists, Author has no
    // public handler and no config naming it. Author must not ride along.
    const app = fakeApp(
      [
        { name: 'author', entityClass: Author },
        { name: 'post', entityClass: Post },
      ],
      { authorHandler: fakeCrud(), postHandler: fakeCrud(), 'public:postHandler': fakeCrud() },
    );

    registerAll(builder, app, { surface: 'public' });
    const typeMap = builder.toSchema().getTypeMap();

    expect(typeMap['Post']).toBeDefined();
    expect(typeMap['Author']).toBeUndefined();
  });

  describe('auto-wired relations', () => {
    class BlogAuthor extends entity({
      id: primary(),
      name: text({ min: 1 }),
      posts: many((): EntityConstructor => BlogPost),
    }) {}

    class BlogPost extends entity({
      id: primary(),
      title: text({ min: 1 }),
      authorId: ref(BlogAuthor),
    }) {}

    it('adds ref relation (N:1) as object field', () => {
      const builder = new SchemaBuilder({});
      builder.queryType({});
      builder.mutationType({});

      const app = fakeApp(
        [
          { name: 'blogAuthor', entityClass: BlogAuthor },
          { name: 'blogPost', entityClass: BlogPost },
        ],
        { blogAuthorHandler: fakeCrud(), blogPostHandler: fakeCrud() },
      );

      registerAll(builder, app);
      const schema = builder.toSchema();

      // BlogPost should have an 'author' relation field (derived from authorId)
      const postType = schema.getTypeMap()['BlogPost'] as any;
      const postFields = postType.getFields();
      expect(postFields['author']).toBeDefined();
      expect(postFields['authorId']).toBeDefined();
    });

    it('adds many relation (1:N) as list field', () => {
      const builder = new SchemaBuilder({});
      builder.queryType({});
      builder.mutationType({});

      const app = fakeApp(
        [
          { name: 'blogAuthor', entityClass: BlogAuthor },
          { name: 'blogPost', entityClass: BlogPost },
        ],
        { blogAuthorHandler: fakeCrud(), blogPostHandler: fakeCrud() },
      );

      registerAll(builder, app);
      const schema = builder.toSchema();

      // BlogAuthor should have a 'posts' relation field
      const authorType = schema.getTypeMap()['BlogAuthor'] as any;
      const authorFields = authorType.getFields();
      expect(authorFields['posts']).toBeDefined();
    });

    it('ref resolver calls target facade.findById with the FK value', async () => {
      const builder = new SchemaBuilder({});
      builder.queryType({});
      builder.mutationType({});

      const authorData = [{ id: 'a1', name: 'Alice' }];
      const postData = [{ id: 'p1', title: 'Hello', authorId: 'a1' }];

      // Facade functions receive InvocationContext (not raw args)
      const authorCrud = {
        ...fakeCrud(authorData),
        findById: vi.fn(async (ctx: any) => authorData.find((d) => d.id === ctx.params.id)),
      };
      const postCrud = fakeCrud(postData);

      const app = fakeApp(
        [
          { name: 'blogAuthor', entityClass: BlogAuthor },
          { name: 'blogPost', entityClass: BlogPost },
        ],
        { blogAuthorHandler: authorCrud, blogPostHandler: postCrud },
      );

      registerAll(builder, app);
      const schema = builder.toSchema();

      // Resolve the author field on a post
      const postType = schema.getTypeMap()['BlogPost'] as any;
      const authorField = postType.getFields()['author'];
      const result = await authorField.resolve({ id: 'p1', authorId: 'a1' }, {}, {});
      expect(authorCrud.findById).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: 'a1' } }),
      );
      expect(result).toEqual({ id: 'a1', name: 'Alice' });
    });
  });
});

/**
 * What an operation says it returns is what GraphQL must announce.
 *
 * `async stats(): Promise<StatsOutput[]>` is a declaration, and the scan already resolves
 * it. GraphQL used to throw it away and announce the entity's type instead — so a client
 * could not ask for the op's own fields, and the entity's came back null. Measured on
 * demos/nuxt-blog, where `stats` was announced as `[Category]`.
 */
describe('an operation that declares its return type', () => {
  const declaredOp = (output: any) => withCustomOps(crudOps('Post', Post), {
    digest: {
      output,
      signature: { name: 'digest', params: [], returnType: { raw: 'X[]', name: 'X', array: true } },
    },
  });

  it('gets its own GraphQL type, named after the entity and the op', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({}); builder.mutationType({});

    class PostDigest extends Post.pick('id', 'title') {}
    const app = fakeApp([{ name: 'post', entityClass: Post }],
      { postHandler: { ...fakeCrud(), digest: vi.fn(async () => []) } },
      [{ address: 'post', operations: declaredOp(PostDigest) }]);

    registerAll(builder, app);
    const typeMap = builder.toSchema().getTypeMap();

    expect(typeMap['PostDigest']).toBeDefined();
    expect(Object.keys((typeMap['PostDigest'] as any).getFields()).sort()).toEqual(['id', 'title']);
  });

  it('reuses the entity type when what it declares IS the entity', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({}); builder.mutationType({});

    const app = fakeApp([{ name: 'post', entityClass: Post }],
      { postHandler: { ...fakeCrud(), digest: vi.fn(async () => []) } },
      [{ address: 'post', operations: declaredOp(Post) }]);

    registerAll(builder, app);
    const typeMap = builder.toSchema().getTypeMap();

    // No second Post type minted under another name.
    expect(typeMap['PostDigest']).toBeUndefined();
    expect(typeMap['Post']).toBeDefined();
  });
});

describe('the operation in words', () => {
  it('publishes the method\'s doc sentence on its GraphQL field', () => {
    // The sentence reached this projection already — `handler.operations` is core's
    // Map<string, OperationContract>. It was dropped here, so an explorer showed every
    // field undocumented while the sentence sat one property away.
    const ops = crudOps('Post', Post);
    ops.set('list', { ...ops.get('list'), description: 'Every post, newest first.' });

    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});

    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: fakeCrud() },
      [{ address: 'post', operations: ops }],
    );

    registerAll(builder, app as never);
    const queryFields = builder.toSchema().getQueryType()!.getFields();

    expect(queryFields['posts']?.description).toBe('Every post, newest first.');
    // An op with no sentence publishes none rather than an empty string.
    expect(queryFields['post']?.description ?? null).toBeNull();
  });
});
