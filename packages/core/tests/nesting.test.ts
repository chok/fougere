/**
 * What nesting says, and what it does not.
 *
 * `shop` holds what its family shares and answers nothing; `cart` resolves its service and
 * `blog`, outside the family, must not. Nothing here says a frond may CALL another one — that
 * stays the façade's, at every placement.
 */
import nested from './fixtures-nesting/fronds.js';
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, declaredTopologyOf, verify } from '../src/index.js';
import { nestingOf, parentsFirst } from '../src/boot/nesting.js';
import { Fronds } from '../src/descriptor/Fronds.js';
import { Invocation } from '../src/wire/Invocation.js';
import type { FrondDescriptor } from '../src/descriptor/FrondDescriptor.js';

const family = { cart: { extends: 'shop' } };

const hosted = async (only?: string[]): Promise<Fronds> =>
  Fronds.hosting(only ? nested.filter((frond) => only.includes(frond.name)) : nested);

const codesOf = (refused: { code: string }[]): string[] => refused.map((one) => one.code);

describe('a child resolves what its parent declared', () => {
  it('answers when the tree puts it under the frond that holds the service', async () => {
    await using app = await createApp({
      fronds: await hosted(['shop', 'cart', 'blog']),
      under: family,
      createContainer,
    });

    const out = await createLocalRunner(app)({ entity: 'cart', op: 'quote' }, Invocation.empty);

    expect(out).toBe('12.50 EUR');
  });

  it('refuses the same dependency from outside the family', async () => {
    await using app = await createApp({
      fronds: await hosted(['shop', 'cart', 'blog']),
      under: family,
      createContainer,
    });

    await expect(createLocalRunner(app)({ entity: 'post', op: 'quote' }, Invocation.empty))
      .rejects.toThrow(/Money/);
  });
});

describe('verify', () => {
  it('exempts an ancestor and keeps refusing a stranger', async () => {
    const fronds = [...await hosted()].map((frond): FrondDescriptor =>
      (frond.name === 'cart' ? { ...frond, extends: 'shop' } : frond));

    const violations = verify({ fronds });

    expect(violations.map((one) => one.frond)).toEqual(['blog']);
    expect(violations[0]?.dependsOn).toEqual({ key: 'Money', frond: 'shop', kind: 'provider' });
  });
});

describe('nestingOf', () => {
  it('reads who inherits from whom, and nothing else', async () => {
    const { under, refused } = nestingOf(family, await hosted(), undefined);

    expect([...under]).toEqual([['cart', 'shop']]);
    expect(refused).toEqual([]);
  });

  it('refuses a parent that serves', async () => {
    const { refused } = nestingOf({ shop: { extends: 'cart' } }, await hosted(), undefined);

    expect(codesOf(refused)).toEqual(['frond-parent-serves']);
    expect(refused[0]?.message).toContain('answers at cart');
  });

  it('refuses a parent placed at an address', async () => {
    const { refused } = nestingOf(family, await hosted(), { shop: 'http://localhost:4100' });

    expect(codesOf(refused)).toEqual(['frond-parent-remote']);
  });

  it('refuses a parent that declares rows', async () => {
    const { refused } = nestingOf({ shop: { extends: 'catalog' } }, await hosted(), undefined);

    expect(codesOf(refused)).toEqual(['frond-parent-entities']);
    expect(refused[0]?.message).toContain('product');
  });

  it('names a frond the process does not hold', async () => {
    const { refused } = nestingOf({ basket: { extends: 'shop' } }, await hosted(), undefined);

    expect(codesOf(refused)).toEqual(['frond-unknown']);
    expect(refused[0]?.subject).toBe('shop.basket');
  });

  it('says nothing about a module key, which the host resolves', async () => {
    const { refused } = nestingOf({ '@fougere/log': './lines.jsonl' }, await hosted(), undefined);

    expect(refused).toEqual([]);
  });

  it('refuses a chain — inheriting goes one level', async () => {
    const { refused } = nestingOf(
      { cart: { extends: 'shop' }, shop: { extends: 'blog' } },
      await hosted(),
      undefined,
    );

    // `shop` also serves, so it is refused twice — both are true, and a boot names them together.
    expect(codesOf(refused)).toContain('frond-extends-chain');
    expect(refused[0]?.message).toContain("'cart' inherits from 'shop', which inherits from 'blog'");
  });

  it('answers nothing when the config states no tree', async () => {
    const { under, refused } = nestingOf(undefined, await hosted(), undefined);

    expect([...under]).toEqual([]);
    expect(refused).toEqual([]);
  });
});

describe('parentsFirst', () => {
  it('puts a parent before the child that inherits from it', async () => {
    const fronds = await hosted();
    const ordered = parentsFirst(fronds, new Map([['blog', 'cart']]));

    // Every frond that inherits goes last, the rest keep the order the scan gave them.
    expect(ordered.map((frond) => frond.name).at(-1)).toBe('blog');
  });

  it('leaves a flat app exactly as it was', async () => {
    const fronds = await hosted();

    expect(parentsFirst(fronds, new Map())).toBe(fronds);
  });
});

describe('the declared topology', () => {
  it('leaves out a frond its family inherits from — it answers at no address', async () => {
    const fronds = [...await hosted()];
    const declared = declaredTopologyOf({ fronds, remotes: {} });

    // `shop` holds what `cart` resolves and serves nothing, so it stands in every process
    // that carries one of its children — there is no one placement to report for it.
    expect(declared.fronds.map((one) => one.frond)).toEqual(['blog', 'cart']);
  });
});
