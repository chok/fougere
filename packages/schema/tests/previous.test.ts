import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity(
  { id: primary(), title: text(), mail: text() },
  { previous: { mail: 'email' } },
) {}

describe('a field can say what it was called', () => {
  it('carries the pair on the class, where the freeze reads it', () => {
    expect(Post.previous).toEqual({ mail: 'email' });
  });

  it('an entity that declares nothing carries nothing', () => {
    class Plain extends entity({ id: primary(), title: text() }) {}

    expect(Plain.previous).toBeUndefined();
  });

  it('a derivation does not carry it — a projection is not what gets frozen', () => {
    expect(Post.pick('id', 'mail').previous).toBeUndefined();
  });

  it('says nothing about the shape — it is read by the freeze and by nobody else', () => {
    expect(Object.keys(Post.getFields())).toEqual(['id', 'title', 'mail']);
  });

  it('only names a field of this entity, and says so at runtime too', () => {
    expect(() =>
      // @ts-expect-error — 'nope' is not a field of this entity
      entity({ id: primary() }, { previous: { nope: 'old' } }),
    ).toThrow(/unknown field `nope`/);
  });
});
