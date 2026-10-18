/**
 * Where a parameter's value comes from beyond the request: asked in order, before the request's
 * own parts — so a fact is never taken for the caller's input, and a source a module adds is asked
 * before the input is assumed.
 */
import { describe, it, expect } from 'vitest';
import { BindingSources } from '../src/BindingSources.js';
import { computeBindingPlan } from '../src/bindingPlan.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';
import { Invocation } from '../src/wire/Invocation.js';
import type { BindingSourceType } from '../src/wire/BindingSourceType.js';
import type { Param } from '../src/wire/Param.js';

const typed = (name: string, typeName: string, generic?: string): Param => ({
  name,
  type: { raw: typeName, name: typeName, ...(generic ? { generics: [{ raw: generic, name: generic }] } : {}) },
});

describe('BindingSources', () => {
  it('asks the fact, the link and the collector, in that order', () => {
    expect(BindingSources.names).toEqual(['fact', 'pipe', 'collector']);
  });

  it('takes a fact for a fact even when its type has a collector', () => {
    const [binding] = computeBindingPlan([typed('post', 'Fact', 'Post')], new Set(['fact']));

    expect(binding!.source).toEqual({ kind: 'fact', factName: 'post' });
  });

  it('asks a source standing in place of another before the request input is assumed', async () => {
    const tenant: BindingSourceType<'collector'> = {
      claim: (param) => (param.type.name === 'Tenant' ? { kind: 'collector', typeName: 'tenant' } : undefined),
      resolve: () => 'acme',
      given: (_source, value) => value,
    };
    const before = BindingSources.find('collector')!;
    BindingSources.replace('collector', tenant);
    try {
      const plan = computeBindingPlan([typed('tenant', 'Tenant')], new Set());

      expect(plan[0]!.source).toEqual({ kind: 'collector', typeName: 'tenant' });
      await expect(new ArgumentResolver().resolve(plan, Invocation.from())).resolves.toEqual(['acme']);
    } finally {
      BindingSources.replace('collector', before);
    }
  });

  it('leaves what no source claims to the request: the context, a primitive, then the input', () => {
    const plan = computeBindingPlan(
      [typed('ctx', 'InvocationContext'), typed('id', 'string'), typed('draft', 'PostDraft')],
      new Set(),
    );

    expect(plan.map((binding) => binding.source.kind)).toEqual(['context', 'param', 'input']);
  });
});
