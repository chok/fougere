import { describe, expect, it } from 'vitest';
import type { BindingPlan } from '../src/wire/binding.js';
import { Invocation } from '../src/wire/Invocation.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';

describe('ArgumentResolver', () => {
  it('resolves the plan in declaration order', async () => {
    const plan: BindingPlan = [
      { name: 'id', source: { kind: 'param', name: 'id' }, optional: false },
      { name: 'input', source: { kind: 'input' }, optional: false },
    ];
    const invocation = Invocation.from({
      params: { id: 'p1' },
      input: { name: 'Fern' },
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

  it('refuses a required parameter the caller did not send', async () => {
    const plan: BindingPlan = [{ name: 'cents', source: { kind: 'param', name: 'cents', coerce: 'number' }, optional: false }];

    await expect(new ArgumentResolver().resolve(plan, Invocation.from()))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'cents: Required' });
  });

  it('hands an optional parameter the caller did not send as undefined', async () => {
    const plan: BindingPlan = [{ name: 'cents', source: { kind: 'param', name: 'cents', coerce: 'number' }, optional: true }];

    await expect(new ArgumentResolver().resolve(plan, Invocation.from())).resolves.toEqual([undefined]);
  });

  it.each(['abc', '', ' '])('refuses %j where a number is expected', async (cents) => {
    const plan: BindingPlan = [{ name: 'cents', source: { kind: 'param', name: 'cents', coerce: 'number' }, optional: false }];

    await expect(new ArgumentResolver().resolve(plan, Invocation.from({ query: { cents } })))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('refuses a word that is not a boolean', async () => {
    const plan: BindingPlan = [{ name: 'active', source: { kind: 'param', name: 'active', coerce: 'boolean' }, optional: false }];

    await expect(new ArgumentResolver().resolve(plan, Invocation.from({ query: { active: 'yes' } })))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
