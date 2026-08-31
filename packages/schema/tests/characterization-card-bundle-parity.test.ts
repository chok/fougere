import { describe as group, expect, it } from 'vitest';
import { Bundle } from '../src/projection/card/Bundle.js';
import { Card } from '../src/projection/card/Card.js';
import { entity } from '../src/entity.js';
import { optional } from '../src/vocabulary/optional.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity({
  id: primary(),
  title: text(),
  body: text(),
}) {}

class NextPost extends entity({
  id: primary(),
  title: text(),
  body: optional(text()),
}) {}

group('single-card and bundle parity', () => {
  it('describes a schema identically by itself and in a set', () => {
    expect(Bundle.fromSchemas({ post: Post }).descriptor.$defs.post)
      .toEqual(Card.fromSchema(Post, 'post').descriptor);
  });

  it('reconstructs a schema identically by itself and from a set', () => {
    const card = JSON.parse(JSON.stringify(Card.fromSchema(Post, 'post').descriptor));
    const bundle = JSON.parse(JSON.stringify(Bundle.fromSchemas({ post: Post }).descriptor));
    const single = Card.fromDescriptor(card).toSchema();
    const fromSet = Bundle.fromDescriptor(bundle).toSchemas().post;

    expect(Card.fromSchema(fromSet, 'post').descriptor).toEqual(Card.fromSchema(single, 'post').descriptor);
  });

  it('diffs a schema identically by itself and in a set', () => {
    const before = Card.fromSchema(Post, 'post');
    const after = Card.fromSchema(NextPost, 'post');
    const setDiff = Bundle.fromSchemas({ post: Post }).diff(Bundle.fromSchemas({ post: NextPost }));

    expect(setDiff.entities.post).toEqual(before.diff(after));
  });
});
