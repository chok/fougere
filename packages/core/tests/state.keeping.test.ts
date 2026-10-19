/**
 * The caller's state, kept between two requests: an op reads and writes it by name, the door carries
 * it, and core signs what leaves — knowing no cookie, only keys and tokens. Tested with a way to keep
 * it and a door of no real kind.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { Format } from '@fougere/schema';
import { createApp, ErrorCode, FougereError, frond, States, type Door, type DoorOutcome, type State } from '../src/index.js';
import { kept, op } from './contract.js';

/** What the door carries a caller's state in, per request: what arrived, and what leaves. */
interface Memo {
  arrived: Map<string, string>;
  leaving: Map<string, string | undefined>;
}

States.register('memo', {
  over: 'line',
  format: Format.of().closed(),
  read: (carrier, name) => (carrier as Memo).arrived.get(name),
  write: (carrier, name, token) => { (carrier as Memo).leaving.set(name, token); },
});

class CartHandler {
  async remember(state: State) { state.set('cart', 'c42'); return state.get('cart'); }
  async recall(state: State) { return state.get('cart') ?? null; }
  async stray(state: State) { state.set('wishlist', 'w1'); return null; }
  async fails(state: State): Promise<never> { state.set('cart', 'c99'); throw new FougereError({ code: ErrorCode.CONFLICT, message: 'No.' }); }
}

const shop = frond('shop', {
  handlers: [{ ctor: CartHandler, deps: [], operations: {
    remember: op({ cardinality: 'none', args: [kept()] }),
    recall: op({ cardinality: 'none', args: [kept()] }),
    stray: op({ cardinality: 'none', args: [kept()] }),
    fails: op({ cardinality: 'none', args: [kept()] }),
  } }],
});

/** One op per request, the memo it carries in, and what it answers. */
function lineDoor(app: Awaited<ReturnType<typeof createApp>>, carries = 'line'): Door<{ op: string; memo: Memo }, string, DoorOutcome> {
  return {
    name: 'line',
    carries,
    carrier: (received) => received.memo,
    decode: async (received) => received.op,
    run: (name) => app.facadeFor('cart')![name]!({}),
    encode: (outcome) => outcome,
  };
}

const memo = (arrived: Map<string, string> = new Map()): Memo => ({ arrived, leaving: new Map() });

describe('the caller\'s state', () => {
  it('leaves signed, and comes back as the value it was', async () => {
    await using app = await createApp({ fronds: [shop], createContainer, state: { cart: { memo: {} } } as never });
    const first = memo();

    expect(await app.answer(lineDoor(app), { op: 'remember', memo: first })).toEqual({ answered: 'c42' });
    const token = first.leaving.get('cart')!;
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(await app.answer(lineDoor(app), { op: 'recall', memo: memo(new Map([['cart', token]])) })).toEqual({ answered: 'c42' });
  });

  it('reads a value the caller changed as absent', async () => {
    await using app = await createApp({ fronds: [shop], createContainer, state: { cart: { memo: {} } } as never });
    const first = memo();
    await app.answer(lineDoor(app), { op: 'remember', memo: first });
    const [, signature] = first.leaving.get('cart')!.split('.');
    const forged = `${Buffer.from(JSON.stringify('c99')).toString('base64url')}.${signature}`;

    expect(await app.answer(lineDoor(app), { op: 'recall', memo: memo(new Map([['cart', forged]])) })).toEqual({ answered: null });
  });

  it('refuses a name state: does not declare, and a door that carries nothing', async () => {
    await using app = await createApp({ fronds: [shop], createContainer, state: { cart: { memo: {} } } as never });

    // A trusted door hands the refusal whole — what the developer reads in the log.
    const stray = await app.answer({ ...lineDoor(app), trusted: true }, { op: 'stray', memo: memo() }) as { refused: FougereError };
    const elsewhere = await app.answer({ ...lineDoor(app, 'other'), trusted: true }, { op: 'remember', memo: memo() }) as { refused: FougereError };

    expect(stray.refused.message).toMatch(/'wishlist' cannot be kept at the door 'line'\. It keeps cart: declare 'wishlist' in state:/);
    expect(elsewhere.refused.message).toMatch(/'cart' cannot be kept at the door 'line'\. It keeps nothing/);
  });

  it('keeps nothing an op that failed wrote', async () => {
    await using app = await createApp({ fronds: [shop], createContainer, state: { cart: { memo: {} } } as never });
    const failing = memo();

    await app.answer(lineDoor(app), { op: 'fails', memo: failing });

    expect(failing.leaving.size).toBe(0);
  });

  it('refuses the boot for a way to keep that nothing registered, naming what does', async () => {
    await expect(createApp({ fronds: [shop], createContainer, state: { cart: { jar: {} } } as never }))
      .rejects.toThrow(/Unknown state keeper 'jar'\. Known: .*memo/);
  });
});
