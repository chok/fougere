import { describe, expect, it, vi } from 'vitest';
import { Call } from '../src/contract/Call.js';
import type { DispatchPort } from '../src/dispatch/DispatchPort.js';
import { createTransportEntry } from '../src/entry/transport.js';

describe('createTransportEntry', () => {
  it('normalizes legacy transport input before dispatch', async () => {
    const dispatch = vi.fn(async (call: Call) => call.address.toString());
    const entry = createTransportEntry({ dispatch } satisfies DispatchPort, 'admin');

    await expect(entry(
      { frond: 'catalog', entity: 'product', op: 'create' },
      { params: {}, query: {}, body: { name: 'Fern', omitted: undefined }, state: {} },
    )).resolves.toBe('admin/product.create');

    const call = dispatch.mock.calls[0]![0];
    expect(call).toBeInstanceOf(Call);
    expect(call.invocation.body).toEqual({ name: 'Fern' });
  });
});
