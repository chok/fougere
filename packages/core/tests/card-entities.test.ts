import aggregate from './fixtures-aggregate/fronds.js';
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp } from '../src/index.js';
import { memory } from './memory.js';
import { identityCardOf } from '../src/boot/card.js';

describe('a card says what a frond stores apart from what it answers', () => {
  it('lists the entities an operation reaches, and names an answer that IS one after it', async () => {
    await using app = await createApp({ fronds: aggregate, createContainer, storageFactory: memory });
    const [bank] = identityCardOf(app).fronds;

    // `ledger` is stored, and no operation takes or answers it: its shape stays home.
    expect(bank!.entities.map((entity) => entity.name)).toEqual(['account']);
    const withdraw = bank!.facades.find((facade) => facade.name === 'account')!.ops.find((op) => op.name === 'withdraw')!;
    expect(withdraw.output?.title).toBe('account');
  });
});
