import { describe, expect, it } from 'vitest';
import { entity, number, primary, text } from '@fougere/schema';
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

  describe('a parameter typed by a field', () => {
    class Sample extends entity({
      id: primary(text({ format: 'uuid' })),
      age: number({ integer: true, min: 1 }),
    }) {}
    const plan: BindingPlan = [
      { name: 'sampleId', source: { kind: 'param', name: 'sampleId', field: { entity: 'Sample', name: 'id' }, identifies: 'Sample' }, optional: false },
      { name: 'age', source: { kind: 'param', name: 'age', coerce: 'number', field: { entity: 'Sample', name: 'age' } }, optional: false },
    ];
    const resolver = new ArgumentResolver(undefined, (name) => name === 'Sample' ? Sample : undefined);
    const id = '3f2a8c1e-6d4b-4f7a-9c2e-1b5d8e0a7f63';

    it('obeys what the field declares, after the query string was read', async () => {
      await expect(resolver.resolve(plan, Invocation.from({ query: { sampleId: id, age: '21' } })))
        .resolves.toEqual([id, 21]);
    });

    it.each([
      [{ sampleId: 'abc', age: '21' }, 'sampleId'],
      [{ sampleId: id, age: '0' }, 'age'],
      [{ sampleId: id, age: '2.5' }, 'age'],
    ])('refuses %j at the door, naming the parameter', async (query, name) => {
      await expect(resolver.resolve(plan, Invocation.from({ query })))
        .rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: [{ path: [name] }] });
    });
  });

  describe('a body that carries parameters rather than an input', () => {
    const retitle: BindingPlan = [
      { name: 'id', source: { kind: 'param', name: 'id', identifies: 'Post' }, optional: false },
      { name: 'title', source: { kind: 'param', name: 'title', field: { entity: 'Post', name: 'title' } }, optional: false },
    ];

    it('reads what the path did not carry — PATCH /posts/:id/retitle { title }', async () => {
      await expect(new ArgumentResolver().resolve(retitle, Invocation.from({ params: { id: 'p1' }, input: { title: 'Hi' } })))
        .resolves.toEqual(['p1', 'Hi']);
    });

    it('lets the path and the query win over the body', async () => {
      const invocation = Invocation.from({ params: { id: 'p1' }, query: { title: 'Query' }, input: { id: 'body', title: 'Body' } });

      await expect(new ArgumentResolver().resolve(retitle, invocation)).resolves.toEqual(['p1', 'Query']);
    });

    it('reads nothing from a body that is an input', async () => {
      const plan: BindingPlan = [...retitle, { name: 'input', source: { kind: 'input' }, optional: false }];

      await expect(new ArgumentResolver().resolve(plan, Invocation.from({ params: { id: 'p1' }, input: { title: 'Hi' } })))
        .rejects.toMatchObject({ message: 'title: Required' });
    });

    it('never reads a plain parameter there — only a field of the row the call designates', async () => {
      const plain: BindingPlan = [retitle[0]!, { name: 'reason', source: { kind: 'param', name: 'reason' }, optional: false }];

      await expect(new ArgumentResolver().resolve(plain, Invocation.from({ params: { id: 'p1' }, input: { reason: 'typo' } })))
        .rejects.toMatchObject({ message: 'reason: Required' });
    });

    it('refuses a key of that body which names no parameter', async () => {
      await expect(new ArgumentResolver().resolve(retitle, Invocation.from({ params: { id: 'p1' }, input: { title: 'Hi', nawak: 1 } })))
        .rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'nawak: Unknown field' });
    });
  });
});
