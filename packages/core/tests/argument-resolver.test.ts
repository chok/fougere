import { describe, expect, it } from 'vitest';
import type { BindingPlan } from '../src/wire/binding.js';
import { Invocation } from '../src/contract/Invocation.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';

describe('ArgumentResolver', () => {
  it('resolves the plan in declaration order', async () => {
    const plan: BindingPlan = [
      { name: 'id', source: { kind: 'param', name: 'id' }, optional: false },
      { name: 'input', source: { kind: 'body' }, optional: false },
    ];
    const invocation = Invocation.from({
      params: { id: 'p1' },
      body: { name: 'Fern' },
    });

    await expect(new ArgumentResolver().resolve(plan, invocation))
      .resolves.toEqual(['p1', { name: 'Fern' }]);
  });

  it('uses the collector lookup owned by the resolver', async () => {
    const plan: BindingPlan = [
      { name: 'actor', source: { kind: 'collector', typeName: 'user' }, optional: false },
    ];
    const actor = { id: 'u1' };
    const resolver = new ArgumentResolver((typeName) =>
      typeName === 'user' ? { collect: async () => actor } : undefined);

    await expect(resolver.resolve(plan, Invocation.from()))
      .resolves.toEqual([actor]);
  });
});
