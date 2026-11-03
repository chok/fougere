/** Twenty buyers, ten units — a change waits for the write before it on the same row. */
import { describe, it, expect } from 'vitest';
import { entity, number, primary, text } from '@fougere/schema';
import { ErrorCode, FougereError } from '@fougere/core';
import { createMemorySource } from '../src/index.js';

class Stock extends entity({
  sku: primary(text()),
  units: number({ integer: true, min: 0 }),
}) {}

const sell = async (current: Record<string, unknown>) => {
  await Promise.resolve();
  const units = current.units as number;
  if (units < 1) throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Insufficient stock' });

  return { units: units - 1 };
};

describe('update(id, change) over a Map', () => {
  it('sells ten units to twenty buyers, ten times — even across two storages of the same rows', async () => {
    const { storageFactory } = createMemorySource();
    const first = storageFactory(Stock as never, 'Stock');
    const second = storageFactory(Stock as never, 'Stock');
    await first.create({ sku: 'widget', units: 10 });

    const replies = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => (index % 2 ? first : second).update('widget', sell)),
    );

    expect(replies.filter((reply) => reply.status === 'fulfilled')).toHaveLength(10);
    expect(await first.findById('widget')).toEqual({ sku: 'widget', units: 0 });
  });

  it('lets the next change run after one that refused', async () => {
    const { storageFactory } = createMemorySource();
    const storage = storageFactory(Stock as never, 'Stock');
    await storage.create({ sku: 'widget', units: 0 });

    await expect(storage.update('widget', sell)).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    await storage.update('widget', () => ({ units: 3 }));

    expect(await storage.findById('widget')).toEqual({ sku: 'widget', units: 3 });
  });

  it('holds a set of keys at once, in key order, so buyers taking them in opposite orders never cross', async () => {
    const { storageFactory } = createMemorySource();
    const storage = storageFactory(Stock as never, 'Stock');
    await storage.create({ sku: 'widget', units: 10 });
    await storage.create({ sku: 'gadget', units: 10 });

    const replies = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => storage.updateByKeys(index % 2 ? ['widget', 'gadget'] : ['gadget', 'widget'], sell)),
    );

    expect(replies.filter((reply) => reply.status === 'fulfilled')).toHaveLength(10);
    expect(await storage.findById('gadget')).toEqual({ sku: 'gadget', units: 0 });
  });
});
