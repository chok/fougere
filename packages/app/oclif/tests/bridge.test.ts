/**
 * What a terminal offers, derived from what an entity states.
 *
 * The same four axes `@fougere/cli` reads for citty, against oclif's args and flags. Written
 * as a unit rather than through a command line: what is at stake is the READING — that a
 * closed set becomes an `enum`, that a primary is the server's until it is all the op takes.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, optional, created } from '@fougere/schema';
import { inputToShape, paramsToShape } from '../src/bridge.js';

class Product extends entity({
  id: primary(),
  sku: text({ min: 3, description: 'Warehouse reference' }),
  cents: number(),
  state: optional(oneOf('draft', 'listed', 'archived', { default: 'draft' })),
  createdAt: created(),
}) {}

class Identified extends entity({ id: primary() }) {}

describe('an entity, as flags', () => {
  it('makes the first required string positional, and names the rest', () => {
    const { args, flags } = inputToShape(Product.getFields());

    expect(Object.keys(args)).toEqual(['sku']);
    expect(Object.keys(flags)).toEqual(['cents', 'state']);
  });

  it('carries the field description, so `--help` restates nothing', () => {
    expect(inputToShape(Product.getFields()).args.sku).toMatchObject({ description: 'Warehouse reference' });
  });

  /** The shape names the legal values, so the refusal and the listing both come from it. */
  it('turns a closed set into an enum, with the default it was given', () => {
    expect(inputToShape(Product.getFields()).flags.state).toMatchObject({
      options: ['draft', 'listed', 'archived'],
      default: 'draft',
    });
  });

  it('leaves out what the server writes', () => {
    const { args, flags } = inputToShape(Product.getFields());

    expect({ ...args, ...flags }).not.toHaveProperty('createdAt');
    expect({ ...args, ...flags }).not.toHaveProperty('id');
  });

  /**
   * An operation whose whole input is `Product.pick('id')` asks the caller to NAME a row. The
   * axes answer who may WRITE a field, so they left it with no argument at all.
   */
  it('takes the primary when the contract admits nothing else', () => {
    expect(inputToShape(Identified.getFields()).args.id).toMatchObject({ required: true });
  });
});

describe('a bare parameter, as flags', () => {
  /** `Crud(Product).findById(id: string)` names no view; the signature is what remains. */
  it('reads a signature when the operation declares no input', () => {
    const { args } = paramsToShape([{ name: 'id', type: { name: 'string' } }]);

    expect(args.id).toMatchObject({ required: true });
  });

  it('skips what the framework fills, and what a flag cannot carry', () => {
    const { args, flags } = paramsToShape([
      { name: 'id', type: { name: 'string' } },
      { name: 'user', type: { name: 'User' }, optional: true },
      { name: 'page', type: { name: 'ListOptions' }, optional: true },
    ]);

    expect(Object.keys({ ...args, ...flags })).toEqual(['id']);
  });
});
