import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import {
  EFFECTIVE_OPERATION_SEMANTICS,
  createApp,
  createAppRunner,
  resolveEffectiveOperations,
  type FrondDescriptor,
  type HandlerEntry,
  type OperationContract,
} from '../src/index.js';
import { identityCardOf } from '../src/boot/card.js';
import { scanProject } from '../src/node.js';

const fixture = join(import.meta.dirname, 'fixtures-collector-input');
const overrideFixture = join(import.meta.dirname, 'fixtures-operation-override');

describe('EffectiveOperation as the shared runtime contract', () => {
  it('carries the resolved handler, kind, provenance, placement, exposure and absence semantics', async () => {
    const scan = await scanProject(fixture);
    const model = resolveEffectiveOperations(scan.fronds, {
      diagnostics: scan.diagnostics,
      adapters: { rest: true, graphql: false },
    });
    const handler = scan.fronds[0]!.handlers[0]!;
    const operation = model.forHandler(handler).get('collectorFirst')!;

    expect(model.resolutionDiagnostics).toEqual([]);
    expect(operation).toMatchObject({
      id: 'blog/default/Post.collectorFirst',
      operation: 'Post.collectorFirst',
      name: 'collectorFirst',
      kind: 'command',
      kindSource: 'explicit',
      handler: { className: 'PostHandler', address: 'post' },
      implementation: { className: 'PostHandler', method: 'collectorFirst' },
      placement: { frond: 'blog', runtime: 'local' },
      exposure: { surfaces: ['default'], adapters: ['rest'] },
      contexts: [],
      semantics: EFFECTIVE_OPERATION_SEMANTICS,
    });
    expect(operation.parameters.map((parameter) => ({
      position: parameter.position,
      name: parameter.name,
      source: parameter.binding.source,
      optional: parameter.optional,
      undefinable: parameter.undefinable,
    }))).toEqual([
      {
        position: 0,
        name: 'user',
        source: { kind: 'collector', typeName: 'user' },
        optional: true,
        undefinable: true,
      },
      {
        position: 1,
        name: 'input',
        source: { kind: 'body' },
        optional: false,
        undefinable: false,
      },
    ]);
    expect(operation.collectors).toEqual([
      expect.objectContaining({
        parameter: 'user',
        typeName: 'user',
        className: 'CurrentUserCollector',
        frond: 'blog',
      }),
    ]);
    expect(operation.input?.getFields()).toHaveProperty('title');
  });

  it('feeds the same resolved kind and contract to boot and discovery', async () => {
    const scan = await scanProject(fixture);
    await using app = await createApp({
      scan,
      createContainer,
      adapters: { rest: true },
    });

    const operation = app.operationsFor('post')?.get('bodyFirst');
    const cardOperation = identityCardOf(app).fronds[0]!.doors
      .find((door) => door.name === 'post')!.ops
      .find((op) => op.name === 'bodyFirst');

    expect(operation?.kind).toBe('command');
    expect(operation?.binding.map((binding) => binding.source.kind)).toEqual(['body', 'collector']);
    expect(cardOperation?.kind).toBe(operation?.kind);
    expect(Object.keys(app.facadeFor('post')!)).toEqual(['bodyFirst', 'collectorFirst']);
  });

  it('executes a resolved handler/method override identically through the facade and runner', async () => {
    const scan = await scanProject(overrideFixture);
    await using app = await createApp({ scan, createContainer });
    const operation = app.operationsFor('post')!.get('publish')!;
    const invocation = {
      params: {}, query: {}, state: {},
      body: { id: 'p1', title: 'Canonical', handledBy: 'caller' },
    };

    expect(operation.implementation).toMatchObject({
      className: 'ArchiveHandler',
      address: 'archive',
      method: 'execute',
    });
    await expect(app.facadeFor('post')!.publish(invocation))
      .resolves.toMatchObject({ handledBy: 'delegate' });
    await expect(createAppRunner(app)({ entity: 'post', op: 'publish' }, invocation))
      .resolves.toMatchObject({ handledBy: 'delegate' });
  });
});

describe('deterministic operation resolution', () => {
  class Post extends entity({ id: primary(), title: text() }) {}
  class PostHandler {
    publish(_input: unknown, _id: string) {}
    execute(_token: unknown) {}
    computeReport() {}
    findAndArchive() {}
  }

  const signature = (
    name: string,
    params: { name: string; raw: string; typeName: string }[] = [],
  ): OperationContract => ({
    signature: {
      name,
      params: params.map((parameter) => ({
        name: parameter.name,
        type: { raw: parameter.raw, name: parameter.typeName },
        optional: false,
      })),
    },
  });

  const handler: HandlerEntry = {
    name: 'postHandler',
    address: 'post',
    ctor: PostHandler,
    operations: new Map([
      ['publish', {
        ...signature('publish', [
          { name: 'input', raw: 'Post', typeName: 'Post' },
          { name: 'id', raw: 'string', typeName: 'string' },
        ]),
        input: Post,
        output: Post,
        cardinality: 'one',
      }],
      ['execute', signature('execute', [{ name: 'token', raw: 'OpaqueToken', typeName: 'OpaqueToken' }])],
      ['computeReport', signature('computeReport')],
      ['findAndArchive', signature('findAndArchive')],
    ]),
    deps: [],
    filePath: '/app/fronds/blog/handlers/PostHandler.ts',
    exposed: true,
  };

  const frond: FrondDescriptor = {
    name: 'blog',
    source: { path: '/app/fronds/blog', package: '@fronds/blog' },
    providers: [],
    entities: [{
      name: 'post',
      entityClass: Post,
      filePath: '/app/fronds/blog/entities/Post.ts',
      exposed: true,
    }],
    handlers: [handler],
    presenters: [],
    collectors: [],
    seeds: [],
    surfaces: { public: ['post'] },
    operationsOverrides: {
      publish: {
        kind: 'command',
        // Deliberately reversed: array order is not semantic authority.
        binding: [
          { name: 'id', source: { kind: 'param', name: 'id' }, optional: false },
          { name: 'input', source: { kind: 'body' }, optional: false },
        ],
      },
      execute: { kind: 'command' },
    },
  };

  it('accepts one interpretation and normalizes an explicit binding by parameter name', () => {
    const model = resolveEffectiveOperations([frond], {
      remotes: { blog: 'https://blog.internal' },
      adapters: { graphql: true, rest: true },
    });
    const operation = model.forHandler(handler).get('publish')!;

    expect(operation.binding.map((binding) => binding.name)).toEqual(['input', 'id']);
    expect(operation.binding.map((binding) => binding.source.kind)).toEqual(['body', 'param']);
    expect(operation.placement).toEqual({
      frond: 'blog',
      runtime: 'remote',
      remote: 'https://blog.internal',
    });
    expect(operation.exposure).toEqual({
      surfaces: ['default', 'public'],
      adapters: ['graphql', 'rest'],
    });
  });

  it('reports zero and multiple interpretations instead of using a fallback or order', () => {
    const model = resolveEffectiveOperations([frond]);

    expect(model.forHandler(handler).has('execute')).toBe(false);
    expect(model.forHandler(handler).has('computeReport')).toBe(false);
    expect(model.forHandler(handler).has('findAndArchive')).toBe(false);
    expect(model.resolutionDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'parameter-binding-unknown', subject: 'PostHandler.execute(token)' }),
      expect.objectContaining({ code: 'operation-kind-unknown', subject: 'PostHandler.computeReport' }),
      expect.objectContaining({ code: 'operation-kind-ambiguous', subject: 'PostHandler.findAndArchive' }),
    ]));
  });
});
