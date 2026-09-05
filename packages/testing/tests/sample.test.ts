/**
 * What a generated body must satisfy: the validator that will receive it.
 *
 * The assertion is deliberately NOT a list of expected values — that would pin this file
 * to `json-schema-faker`'s output rather than to the entity. `validate()` is the reader
 * that decides, and it is the same one the façade uses.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, bool, email, created, ref, readOnly, list, nullable } from '@fougere/schema';
import { sampleInput } from '../src/index.js';

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}

class Article extends entity({
  id: primary(),
  title: text({ min: 3, max: 40 }),
  body: text({ min: 1 }),
  status: oneOf('draft', 'published'),
  views: number({ integer: true, min: 0, max: 1000 }),
  featured: bool(),
  contact: email(),
  tags: list(text({ min: 1 })),
  slug: readOnly(text()),
  createdAt: created(),
}) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 3 }),
  authorId: ref(() => Author),
}) {}

describe('a body built from the declaration', () => {
  it('is accepted by the validator that will receive it', () => {
    const result = Article.validate(sampleInput(Article));

    expect(result.success, JSON.stringify((result as { errors?: unknown }).errors)).toBe(true);
  });

  it('carries only what a client may write', () => {
    const body = sampleInput(Article);

    // Not the primary key, not what the server stamps, not what the boundary closes.
    expect(Object.keys(body).sort()).toEqual(
      ['body', 'contact', 'featured', 'status', 'tags', 'title', 'views'],
    );
  });

  it('honours the shape rather than a type name', () => {
    const body = sampleInput(Article) as Record<string, string & number & string[]>;

    expect((body.title as unknown as string).length).toBeGreaterThanOrEqual(3);
    expect((body.title as unknown as string).length).toBeLessThanOrEqual(40);
    expect(['draft', 'published']).toContain(body.status);
    expect(body.contact as unknown as string).toMatch(/@/);
    expect(Array.isArray(body.tags)).toBe(true);
  });

  it('answers the same thing twice, so a failure can be replayed', () => {
    expect(sampleInput(Article)).toEqual(sampleInput(Article));
  });

  it('gives two fields of the same shape two different values', () => {
    const body = sampleInput(Article) as Record<string, unknown>;

    // `title` and `body` are both bounded strings. One seed for the whole entity made
    // them identical, and a test asserting on one while reading the other still passed.
    expect(body.title).not.toEqual(body.body);
  });

  it('varies when the seed does', () => {
    expect(sampleInput(Article, {}, { seed: 1 })).not.toEqual(sampleInput(Article, {}, { seed: 2 }));
  });

  it('takes what the caller imposes, verbatim', () => {
    expect(sampleInput(Article, { title: 'A stated title' }).title).toBe('A stated title');
  });
});

describe('a reference', () => {
  it('is refused by name rather than generated', () => {
    expect(() => sampleInput(Post)).toThrow(/authorId is a reference/);
  });

  it('is accepted once the caller names the row', () => {
    const body = sampleInput(Post, { authorId: 'a1' });

    expect(body.authorId).toBe('a1');
    expect(Post.validate(body).success).toBe(true);
  });
});

describe('a nullable field', () => {
  class Draft extends entity({
    id: primary(),
    title: text({ min: 3 }),
    subtitle: nullable(text({ min: 3 })),
  }) {}

  it('draws null sometimes, and the validator takes it either way', () => {
    const drawn = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => sampleInput(Draft, {}, { seed }));

    // Both branches of the declared type appear across seeds, and every draw is valid.
    expect(drawn.some((body) => body.subtitle === null)).toBe(true);
    expect(drawn.some((body) => typeof body.subtitle === 'string')).toBe(true);
    for (const body of drawn) expect(Draft.validate(body).success).toBe(true);
  });

  it('takes null when the caller states it', () => {
    expect(sampleInput(Draft, { subtitle: null }).subtitle).toBeNull();
    expect(Draft.validate(sampleInput(Draft, { subtitle: null })).success).toBe(true);
  });
});
