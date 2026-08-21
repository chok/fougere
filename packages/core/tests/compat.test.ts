import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, optional, describe as describeSchema } from '@fougere/schema';
import { compare, breachMessage } from '../src/index.js';
import type { CardFrond } from '../src/index.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  views: number(),
  body: optional(text()),
}) {}

const shape = describeSchema(Post, 'Post');

/** A frond as a card carries it — the accepted side of every test below. */
const accepted = (): CardFrond => ({
  name: 'blog',
  doors: [
    {
      name: 'post',
      schema: structuredClone(shape),
      ops: [
        { name: 'list', kind: 'query', cardinality: 'page' },
        { name: 'findById', kind: 'query', cardinality: 'maybe' },
        { name: 'publish', kind: 'command', cardinality: 'one' },
      ],
    },
  ],
  facts: [{ name: 'postPublished', schema: structuredClone(shape) }],
});

/** The served side, built by editing a copy — a host is the same card, moved on. */
function served(edit: (card: CardFrond) => void): CardFrond {
  const card = accepted();
  edit(card);
  return card;
}

describe('compare — a card that did not move', () => {
  it('reports nothing at all', () => {
    const answer = compare(accepted(), accepted());
    expect(answer.breaking).toEqual([]);
    expect(answer.additive).toEqual([]);
    expect(answer.ambiguous).toEqual([]);
  });
});

describe('compare — what a consumer cannot absorb', () => {
  it('a frond the host does not carry is ONE breach, not one per door', () => {
    const answer = compare(accepted(), undefined);
    expect(answer.breaking).toEqual([{ kind: 'frond-gone', frond: 'blog' }]);
  });

  it('a door that is gone', () => {
    const answer = compare(accepted(), served((c) => { c.doors = []; }));
    expect(answer.breaking).toEqual([{ kind: 'door-gone', frond: 'blog', door: 'post' }]);
  });

  it('a field that is gone', () => {
    const answer = compare(accepted(), served((c) => { delete c.doors[0]!.schema!.properties.views; }));
    expect(answer.breaking).toHaveLength(1);
    expect(breachMessage(answer.breaking[0]!)).toBe('post: views is gone');
  });

  it('a field that changed type', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors[0]!.schema!.properties.views = { type: 'string' };
    }));
    expect(breachMessage(answer.breaking[0]!)).toBe('post: views is string, accepted as number');
  });

  it('a field that became required — the consumer never sends it', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors[0]!.schema!.required = [...(c.doors[0]!.schema!.required ?? []), 'body'];
    }));
    expect(breachMessage(answer.breaking[0]!)).toBe('post: body is now required');
  });

  it('an operation that is gone', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors[0]!.ops = c.doors[0]!.ops.filter((o) => o.name !== 'publish');
    }));
    expect(breachMessage(answer.breaking[0]!)).toBe('post.publish() is gone');
  });

  /**
   * The case a shape comparison alone cannot see: same name, same fields, and the answer
   * arrives as one row where the caller destructures a page.
   */
  it('an operation whose promise changed', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors[0]!.ops[0] = { name: 'list', kind: 'query', cardinality: 'one' };
    }));
    expect(breachMessage(answer.breaking[0]!)).toBe('post.list() now answers query/one, accepted as query/page');
  });

  it('a door that no longer describes its rows', () => {
    const answer = compare(accepted(), served((c) => { delete c.doors[0]!.schema; }));
    expect(answer.breaking).toEqual([{ kind: 'shape-gone', frond: 'blog', door: 'post' }]);
  });

  it('a fact that is no longer announced', () => {
    const answer = compare(accepted(), served((c) => { c.facts = []; }));
    expect(breachMessage(answer.breaking[0]!)).toBe('fact postPublished is no longer announced');
  });

  /** A fact is judged strictly on arrival, so its shape moving is a refusal, not a warning. */
  it('a fact whose shape moved', () => {
    const answer = compare(accepted(), served((c) => { delete c.facts[0]!.schema!.properties.title; }));
    expect(breachMessage(answer.breaking[0]!)).toBe('fact postPublished: title is gone');
  });
});

describe('compare — what the host gained never blocks', () => {
  it('an optional field is additive', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors[0]!.schema!.properties.slug = { type: 'string' };
    }));
    expect(answer.breaking).toEqual([]);
    expect(answer.additive).toEqual([{ kind: 'field-added', frond: 'blog', door: 'post', field: 'slug' }]);
  });

  it('a REQUIRED new field is not — the consumer does not send it', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors[0]!.schema!.properties.slug = { type: 'string' };
      c.doors[0]!.schema!.required = [...(c.doors[0]!.schema!.required ?? []), 'slug'];
    }));
    expect(answer.additive).toEqual([]);
    expect(breachMessage(answer.breaking[0]!)).toBe('post: slug was added and is required');
  });

  it('a new door, a new op and a new fact are all additive', () => {
    const answer = compare(accepted(), served((c) => {
      c.doors.push({ name: 'comment', ops: [{ name: 'list', kind: 'query' }] });
      c.doors[0]!.ops.push({ name: 'archive', kind: 'command', cardinality: 'one' });
      c.facts.push({ name: 'postArchived' });
    }));
    expect(answer.breaking).toEqual([]);
    expect(answer.additive.map((a) => a.kind).sort()).toEqual(['door-added', 'fact-added', 'op-added']);
  });
});

describe('compare — a rename it refuses to decide', () => {
  /**
   * `diff` reports the pair rather than guessing, and so does this: the removal is
   * already a breach, and `ambiguous` only says a re-sync may be all it takes.
   */
  it('reports the pair beside the breach, never instead of it', () => {
    const answer = compare(accepted(), served((c) => {
      const shape = c.doors[0]!.schema!;
      shape.properties.headline = shape.properties.title!;
      delete shape.properties.title;
      shape.required = (shape.required ?? []).map((f) => (f === 'title' ? 'headline' : f));
    }));
    expect(answer.ambiguous).toEqual([{ door: 'post', removed: 'title', added: 'headline' }]);
    expect(answer.breaking.some((b) => b.kind === 'field' && b.change.kind === 'removed')).toBe(true);
  });
});
