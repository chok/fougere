import { describe, it, expect } from 'vitest';
import {
  entity, primary, text, number, bool, date, oneOf, optional, ref, many, created,
} from '@fougere/schema';
import { entityToArgs } from '../src/bridge.js';

class Other extends entity({ id: primary() }) {}

/**
 * One entity covering every branch the bridge has: a default, a closed set, a date, a
 * generated stamp, an optional, the `force` key it special-cases, a kebab name, and both
 * sides of a relation.
 */
class Wide extends entity({
  id: primary(),
  title: text(),
  slug: text({ default: 'x' }),
  count: number(),
  size: number({ default: 3 }),
  active: bool(),
  flagged: bool({ default: true }),
  status: oneOf('draft', 'published', { default: 'draft' }),
  at: date(),
  createdAt: created(),
  note: optional(text()),
  force: bool(),
  longName: text(),
  owner: ref(() => Other),
  posts: many(() => Other),
}) {}

const args = entityToArgs(Wide.getFields());

describe('entityToArgs', () => {
  it('states every arg with its type, and nothing the axes exclude', () => {
    expect(args).toEqual({
      title: { required: true, type: 'positional' },
      slug: { required: false, default: 'x', type: 'string' },
      count: { required: true, type: 'string' },
      size: { required: false, default: '3', type: 'string' },
      active: { required: true, type: 'boolean' },
      flagged: { required: false, type: 'boolean', default: true },
      status: {
        required: false, default: 'draft', type: 'enum', options: ['draft', 'published'],
      },
      at: { required: true, type: 'string' },
      note: { required: false, type: 'string' },
      force: { required: true, type: 'boolean' },
      'long-name': { required: true, type: 'string' },
    });
  });

  it('leaves out what the server writes and what a flag cannot carry', () => {
    // `id` and `createdAt` are the storage's; `owner`/`posts` are relations, which the CLI
    // skips even though the axes admit a `ref` at ingress.
    expect(Object.keys(args)).not.toContain('id');
    expect(Object.keys(args)).not.toContain('createdAt');
    expect(Object.keys(args)).not.toContain('owner');
    expect(Object.keys(args)).not.toContain('posts');
  });

  it('makes the first required field positional, and only the first', () => {
    // `force` is required and named on purpose — it is the one key the rule excludes.
    expect(args.title?.type).toBe('positional');
    expect(args.count?.type).toBe('string');
  });
});
