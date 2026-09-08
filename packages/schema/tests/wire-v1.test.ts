import { describe, it, expect } from 'vitest';
import {
  bool,
  Bundle,
  Card,
  created,
  entity,
  immutable,
  indexed,
  many,
  number,
  optional,
  primary,
  readOnly,
  ref,
  text,
  unique,
  updated,
  writeOnly,
} from '../src/index.js';

class Author extends entity({
  id: primary(),
  email: unique(text({ format: 'email' })),
  name: text({ min: 1, max: 120 }),
}) {}

class Post extends entity({
  id: primary(),
  slug: indexed(text()),
  title: text({ min: 1, max: 200 }),
  views: number({ min: 0 }),
  draft: bool({ default: false }),
  summary: optional(text()),
  secret: writeOnly(text()),
  computed: readOnly(text()),
  authorId: ref(Author),
  posts: many(Author),
  createdAt: immutable(created()),
  updatedAt: updated(),
}) {}

class ListEntry extends entity(
  {
    id: primary(),
    listId: text(),
    docId: text(),
    addedAt: created(),
  },
  { unique: [['listId', 'docId']] },
) {}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe('wire v1 · what a foreign reader receives', () => {
  it('describes the four axes', async () => {
    await expect(json(Card.fromSchema(Post, 'post').descriptor))
      .toMatchFileSnapshot('./fixtures/wire-v1/four-axes.json');
  });

  it('describes a derivation that renamed and dropped', async () => {
    const view = Post.omit('secret', 'computed').rename({ title: 'headline' });

    await expect(json(Card.fromSchema(view, 'postCard').descriptor))
      .toMatchFileSnapshot('./fixtures/wire-v1/derivation.json');
  });

  it('describes a simple unique as the field carries it', async () => {
    await expect(json(Card.fromSchema(Author, 'author').descriptor))
      .toMatchFileSnapshot('./fixtures/wire-v1/unique-simple.json');
  });

  it('describes a composite unique across its members', async () => {
    await expect(json(Card.fromSchema(ListEntry, 'listEntry').descriptor))
      .toMatchFileSnapshot('./fixtures/wire-v1/unique-composite.json');
  });

  it('describes a bundle carrying relations', async () => {
    await expect(json(Bundle.fromSchemas({ author: Author, post: Post }).descriptor))
      .toMatchFileSnapshot('./fixtures/wire-v1/bundle-relations.json');
  });
});

describe('wire v1 · what survives the round trip', () => {
  it('rebuilds a schema whose card is the one it came from', () => {
    const card = json(Card.fromSchema(Post, 'post').descriptor);
    const rebuilt = Card.fromDescriptor(JSON.parse(card)).toSchema();

    expect(json(Card.fromSchema(rebuilt, 'post').descriptor)).toBe(card);
  });

  it('rebuilds a bundle whose descriptor is the one it came from', () => {
    const bundle = json(Bundle.fromSchemas({ author: Author, post: Post, listEntry: ListEntry }).descriptor);
    const rebuilt = Bundle.fromDescriptor(JSON.parse(bundle)).toSchemas();

    expect(json(Bundle.fromSchemas(rebuilt).descriptor)).toBe(bundle);
  });
});
