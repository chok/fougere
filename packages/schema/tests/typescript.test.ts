/**
 * The card carries what it takes to type, and nobody read it.
 *
 * An entity synced from a remote host validated perfectly at runtime and taught the
 * compiler nothing. This test states what the third reading produces: ONE class, the
 * one you would have written by hand.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, date, oneOf, list, optional, nullable, ref, many } from '../src/index.js';
import { describe as describeSchema } from '../src/index.js';
import { shapeTypeOf, entitySourceOf, facadeTypeSourceOf } from '../src/projections/typescript.js';

class Author extends entity({ id: primary(), name: text() }) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  views: number(),
  draft: bool(),
  status: oneOf('draft', 'published', { default: 'draft' }),
  publishedAt: optional(date()),
  editedAt: nullable(date()),
  tags: list(text()),
  authorId: ref(Author),
  comments: many(Author),
}) {}

const source = shapeTypeOf(describeSchema(Post, 'post'));

describe('card → TypeScript type', () => {
  it('renders every field in the form the consumer receives', () => {
    expect(source).toBe([
      '{',
      '  id: string;',
      '  title: string;',
      '  views: number;',
      '  draft: boolean;',
      // A bounded value set IS a type: the enum travels, so the union does too.
      "  status: \"draft\" | \"published\";",
      // `date-time` is the wire form; the boundary decodes it, so the type says Date.
      '  publishedAt: Date | null;',
      '  editedAt: Date | null;',
      '  tags: string[];',
      '  authorId: string;',
      // A `many` relation has no items — those are the ids on the other side.
      '  comments: string[];',
      '}',
    ].join('\n'));
  });

  it('types the READ, not the creation', () => {
    // `required` on a card answers "what must a caller supply at creation". `id` is
    // absent from it (it is generated) and is always there on a row. Typing the read
    // shape from the create rule would make `post.id` possibly-undefined.
    const card = describeSchema(Post, 'post');
    expect(card.required).not.toContain('id');
    expect(source).toContain('  id: string;');
  });

  it('renders ONE class: the judge and the shape under a single name', () => {
    const entitySource = entitySourceOf(describeSchema(Author, 'author'));

    // No interface beside a const: `class` is the language's own answer to
    // "a name that is both a value and a type".
    expect(entitySource).toMatch(/^export class Author extends reconstruct<\{/);
    expect(entitySource).toContain('  name: string;');
    // The card travels inline — the rebuilt judge is exact, and the shape above it
    // is read off that same card.
    expect(entitySource).toContain('"x-fougere-vendor": "fougere"');
    expect(entitySource.trimEnd()).toMatch(/\}\) \{\}$/);
  });

  it('names the class after the card, or after what it is told', () => {
    expect(entitySourceOf(describeSchema(Author, 'author'), { name: 'AuthorCard' })).toContain('class AuthorCard ');
    expect(entitySourceOf(describeSchema(Author, 'author'), { exported: false })).toMatch(/^class /);
  });

  it('refuses a name that is not an identifier', () => {
    // Everything else emits DATA — a string lands inside `JSON.stringify`. A name lands
    // in a declaration: it is the one value that could stop being data, and it sometimes
    // comes from a stranger.
    expect(() => entitySourceOf({ ...describeSchema(Author, 'author'), title: "Author; await import('node:fs')" }))
      .toThrow(/not a TypeScript identifier/);
  });
});

describe('card → façade type', () => {
  const ops = [
    { name: 'list', cardinality: 'page' as const, description: 'Every post.' },
    { name: 'findById', cardinality: 'maybe' as const },
    { name: 'create', cardinality: 'one' as const },
    { name: 'delete', cardinality: 'none' as const },
    { name: 'search', cardinality: 'many' as const },
  ];

  it('says how much comes back, not only what shape', () => {
    const source = facadeTypeSourceOf(ops, { name: 'PostFacade', rowType: 'Post' });

    // The trap this field exists to avoid: `list` does NOT return `Post[]`.
    // `ListResult<T> extends Array<T>` — an array carrying its own totals.
    expect(source).toContain('list(invocation?: Invocation): Promise<Post[] & { total?: number; endCursor?: string; hasMore?: boolean }>;');
    expect(source).toContain('findById(invocation?: Invocation): Promise<Post | undefined>;');
    expect(source).toContain('create(invocation?: Invocation): Promise<Post>;');
    expect(source).toContain('search(invocation?: Invocation): Promise<Post[]>;');
    // `none` = no published shape. `unknown` says so; `void` would forbid reading a
    // boolean that does come back.
    expect(source).toContain('delete(invocation?: Invocation): Promise<unknown>;');
  });

  it('carries the operation\'s own doc sentence', () => {
    expect(facadeTypeSourceOf(ops, { rowType: 'Post' })).toContain('/** Every post. */');
  });

  it('does not guess when the card gives no cardinality', () => {
    // A silent card must produce `unknown`, not a guess that compiles.
    expect(facadeTypeSourceOf([{ name: 'weekly' }], { rowType: 'Post' }))
      .toContain('weekly(invocation?: Invocation): Promise<unknown>;');
  });
});

/**
 * A card can come from a stranger, and `fougere sync` writes what it says into a file
 * the consumer imports. Two values reach that file: the name, refused when it is not an
 * identifier, and the descriptions — which used to land raw inside a `/**` comment.
 *
 * Measured before the fix: a description closing the comment compiled with ZERO
 * diagnostics and emitted `console.log(…)` as a top-level statement. So this is not a
 * broken-output test, it is the injection test.
 */
describe('a description cannot stop being a comment', () => {
  // Closes the comment, closes the declaration, emits a statement, reopens a comment
  // so the generated tail still parses. The shape of a real payload, not a stray `*/`.
  const payload = '*/ } console.log("pwned"); interface X {';

  it('escapes the terminator in a field description', () => {
    const source = shapeTypeOf({
      type: 'object',
      title: 'post',
      properties: { title: { type: 'string', description: payload } },
    } as never);

    expect(source).toContain('/** *\\/ } console.log("pwned"); interface X { */');
    // The real invariant: one opening, one terminator. A payload that escaped would
    // add a second, and that second one is where the injected source begins.
    expect(source.split('*/').length - 1).toBe(1);
  });

  it('escapes the terminator in an operation description', () => {
    const source = facadeTypeSourceOf([{ name: 'list', cardinality: 'many', description: payload }], {
      rowType: 'Post',
    });

    expect(source).toContain('/** *\\/ } console.log("pwned"); interface X { */');
    expect(source.split('*/').length - 1).toBe(1);
  });

  it('leaves the whole generated entity with no way out of its comments', () => {
    const source = entitySourceOf({
      type: 'object',
      title: 'post',
      properties: {
        id: { type: 'string', description: payload },
        title: { type: 'string', description: payload },
      },
    } as never);

    // The type literal, where a description is SOURCE: both are escaped.
    const shape = source.slice(source.indexOf('<'), source.indexOf('>('));
    expect(shape.split('*/').length - 1).toBe(2);
    expect(shape).not.toContain('*/ }');

    // The card below it, where the same string is DATA: `JSON.stringify` put it in a
    // string literal, so its `*/` is inert and must stay verbatim — escaping it there
    // would corrupt the description the rebuilt judge hands back.
    const card = source.slice(source.indexOf('>('));
    expect(card).toContain(JSON.stringify(payload));
  });
});
