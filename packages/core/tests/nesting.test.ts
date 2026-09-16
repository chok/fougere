/**
 * What nesting says, and what it does not.
 *
 * `shop` holds what its family shares and answers nothing; `cart` resolves its service and
 * `blog`, outside the family, must not. Nothing here says a frond may CALL another one — that
 * stays the façade's, at every placement.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, declaredTopologyOf, verify } from '../src/index.js';
import { nestingOf, parentsFirst } from '../src/boot/nesting.js';
import { Fronds } from '../src/descriptor/Fronds.js';
import { Invocation } from '../src/wire/Invocation.js';
import type { FrondDescriptor } from '../src/descriptor/FrondDescriptor.js';

const root = join(import.meta.dirname, 'fixtures-nesting');

const family = { shop: { fronds: ['cart'] } };

const scanned = async (only?: string[]): Promise<Fronds> =>
  Fronds.hosting((await scanProject(root, only)).fronds);

const codesOf = (refused: { code: string }[]): string[] => refused.map((one) => one.code);

describe('a child resolves what its parent declared', () => {
  it('answers when the tree puts it under the frond that holds the service', async () => {
    await using app = await createApp({
      scan: await scanProject(root, ['shop', 'cart', 'blog']),
      under: family,
      createContainer,
    });

    const out = await createLocalRunner(app)({ entity: 'cart', op: 'quote' }, Invocation.empty);

    expect(out).toBe('12.50 EUR');
  });

  it('refuses the same dependency from outside the family', async () => {
    await using app = await createApp({
      scan: await scanProject(root, ['shop', 'cart', 'blog']),
      under: family,
      createContainer,
    });

    await expect(createLocalRunner(app)({ entity: 'post', op: 'quote' }, Invocation.empty))
      .rejects.toThrow(/Money/);
  });
});

describe('verify', () => {
  it('exempts an ancestor and keeps refusing a stranger', async () => {
    const fronds = [...await scanned()].map((frond): FrondDescriptor =>
      (frond.name === 'cart' ? { ...frond, under: 'shop' } : frond));

    const violations = verify({ fronds });

    expect(violations.map((one) => one.frond)).toEqual(['blog']);
    expect(violations[0]?.dependsOn).toEqual({ key: 'Money', frond: 'shop', kind: 'provider' });
  });
});

describe('nestingOf', () => {
  it('reads who inherits from whom, and nothing else', async () => {
    const { under, refused } = nestingOf(family, await scanned(), undefined);

    expect([...under]).toEqual([['cart', 'shop']]);
    expect(refused).toEqual([]);
  });

  it('refuses a parent that serves', async () => {
    const { refused } = nestingOf({ cart: { fronds: ['shop'] } }, await scanned(), undefined);

    expect(codesOf(refused)).toEqual(['frond-parent-serves']);
    expect(refused[0]?.message).toContain('answers at cart');
  });

  it('refuses a parent placed at an address', async () => {
    const { refused } = nestingOf(family, await scanned(), { shop: 'http://localhost:4100' });

    expect(codesOf(refused)).toEqual(['frond-parent-remote']);
  });

  it('refuses a parent that declares rows', async () => {
    const { refused } = nestingOf({ catalog: { fronds: ['shop'] } }, await scanned(), undefined);

    expect(codesOf(refused)).toEqual(['frond-parent-entities']);
    expect(refused[0]?.message).toContain('product');
  });

  it('names a frond the process does not hold', async () => {
    const { refused } = nestingOf({ shop: { fronds: ['basket'] } }, await scanned(), undefined);

    expect(codesOf(refused)).toEqual(['frond-unknown']);
    expect(refused[0]?.subject).toBe('shop.basket');
  });

  it('says nothing about a module key, which the host resolves', async () => {
    const { refused } = nestingOf({ '@fougere/log': './lines.jsonl' }, await scanned(), undefined);

    expect(refused).toEqual([]);
  });

  it('refuses a name stated at two places in the tree', async () => {
    const { refused } = nestingOf({ shop: { fronds: ['cart'] }, blog: { fronds: ['cart'] } }, await scanned(), undefined);

    expect(codesOf(refused)).toEqual(['frond-under-twice']);
  });

  it('answers nothing when the config states no tree', async () => {
    const { under, refused } = nestingOf(undefined, await scanned(), undefined);

    expect([...under]).toEqual([]);
    expect(refused).toEqual([]);
  });
});

describe('parentsFirst', () => {
  it('puts a parent before the child that inherits from it', async () => {
    const fronds = await scanned();
    const ordered = parentsFirst(fronds, new Map([['blog', 'cart']]));

    expect(ordered.map((frond) => frond.name).slice(0, 2)).toEqual(['cart', 'blog']);
  });

  it('leaves a flat app exactly as it was', async () => {
    const fronds = await scanned();

    expect(parentsFirst(fronds, new Map())).toBe(fronds);
  });
});

describe('the declared topology', () => {
  it('leaves out a frond its family inherits from — it answers at no address', async () => {
    const fronds = [...await scanned()];
    const declared = declaredTopologyOf({ fronds, remotes: {} });

    // `shop` holds what `cart` resolves and serves nothing, so it stands in every process
    // that carries one of its children — there is no one placement to report for it.
    expect(declared.fronds.map((one) => one.frond)).toEqual(['blog', 'cart']);
  });
});
