import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { registerAll } from '../src/auto-register.js';

/**
 * A GraphQL root is FLAT, and two handlers can name a method the same thing.
 *
 * The five CRUD names weave the entity in (`createBook`), so they never meet this; a
 * custom op keeps its method name, which is the author's and says nothing about its
 * subject. Measured on an eight-frond app: `ofBook` on four handlers, `ofUser` on three.
 * Pothos answers `Duplicate field ofBook on Mutation` — no file, no handler, no remedy —
 * and takes the WHOLE schema down, every other type with it.
 *
 * Nothing is renamed automatically: a derived name would be this package choosing the
 * app's public vocabulary, and it would MOVE the day a distant frond gained an entity.
 */
class Note extends entity({ id: primary(), body: text() }) {}
class Chapter extends entity({ id: primary(), title: text() }) {}

const ofBook = {
  name: 'ofBook',
  params: [{ name: 'bookId', type: { raw: 'string', name: 'string' } }],
  returnType: { raw: 'Promise<Note[]>', name: 'Note', array: true },
};

function build(fronds: { name: string; handler: string; overrides?: Record<string, unknown> }[]) {
  const app = {
    fronds: fronds.map(({ name, handler, overrides }) => ({
      name,
      entities: [{ name: name === 'annotation' ? 'note' : 'chapter', entityClass: name === 'annotation' ? Note : Chapter }],
      handlers: [{
        address: name === 'annotation' ? 'note' : 'chapter',
        ctor: { name: handler },
        operations: new Map([['ofBook', { signature: ofBook }]]),
      }],
      presenters: [],
      operationsOverrides: overrides,
    })),
    presenterFor: () => undefined,
    resolve: () => { throw new Error('no such registration'); },
    facadeFor: () => ({ ofBook: async () => [] }),
  } as never;

  const builder = new SchemaBuilder({});
  builder.queryType({});
  builder.mutationType({});
  registerAll(builder, app);
  return builder.toSchema();
}

describe('two operations claiming one root field', () => {
  it('is refused, naming both — where Pothos names neither', () => {
    expect(() => build([
      { name: 'annotation', handler: 'NoteHandler' },
      { name: 'catalog', handler: 'ChapterHandler' },
    ])).toThrow(/annotation\/NoteHandler\.ofBook[\s\S]*catalog\/ChapterHandler\.ofBook/);
  });

  it('offers the config only when the two are in DIFFERENT fronds', () => {
    expect(() => build([
      { name: 'annotation', handler: 'NoteHandler' },
      { name: 'catalog', handler: 'ChapterHandler' },
    ])).toThrow(/operations: \{ ofBook: \{ graphql/);
  });

  /**
   * `operations:` is keyed by op name PER FROND, so it cannot tell two handlers of one
   * frond apart. Proposing it there would send the author to a fix that cannot work.
   */
  it('says to rename instead when they share a frond, because config cannot separate them', () => {
    const twoInOne = {
      fronds: [{
        name: 'annotation',
        entities: [{ name: 'note', entityClass: Note }, { name: 'chapter', entityClass: Chapter }],
        handlers: [
          { address: 'note', ctor: { name: 'NoteHandler' }, operations: new Map([['ofBook', { signature: ofBook }]]) },
          { address: 'chapter', ctor: { name: 'HighlightHandler' }, operations: new Map([['ofBook', { signature: ofBook }]]) },
        ],
        presenters: [],
      }],
      presenterFor: () => undefined,
      resolve: () => { throw new Error('no such registration'); },
      facadeFor: () => ({ ofBook: async () => [] }),
    } as never;

    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});
    expect(() => registerAll(builder, twoInOne)).toThrow(/same frond[\s\S]*rename one of the methods/);
  });

  it('lets the named field through — the frond that yields says so in its config', () => {
    const schema = build([
      { name: 'annotation', handler: 'NoteHandler' },
      { name: 'catalog', handler: 'ChapterHandler', overrides: { ofBook: { graphql: 'chaptersOfBook' } } },
    ]);
    // Whichever root they land on — `ofBook` matches no read prefix, so both are
    // mutations here. What this pins is the NAME, not the kind.
    const roots = ['Query', 'Mutation'].flatMap(
      (t) => Object.keys((schema.getTypeMap()[t] as any).getFields()),
    );

    expect(roots).toContain('ofBook');
    expect(roots).toContain('chaptersOfBook');
  });
});
