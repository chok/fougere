import { describe, it, expect } from 'vitest';
import { computeBindingPlan, resolveArgs, type BindingPlan } from '../src/boot/binding.js';
import type { ParsedParam } from '../src/scan/handler-parser.js';
import type { InvocationContext } from '../src/wire/invocation.js';

function param(name: string, typeName: string, optional = false): ParsedParam {
  return { name, type: { raw: typeName, name: typeName }, optional };
}

function ctx(overrides: Partial<InvocationContext> = {}): InvocationContext {
  return { params: {}, query: {}, body: undefined, state: {}, ...overrides };
}

describe('computeBindingPlan', () => {
  const noCollectors = new Set<string>();

  it('findById(id: string) → [param "id"]', () => {
    const plan = computeBindingPlan([param('id', 'string')], noCollectors);
    expect(plan).toEqual([
      { name: 'id', source: { kind: 'param', name: 'id', coerce: undefined }, optional: false },
    ]);
  });

  it('create(data: CreatePost) → [body]', () => {
    const plan = computeBindingPlan([param('data', 'CreatePost')], noCollectors);
    expect(plan).toEqual([
      { name: 'data', source: { kind: 'body' }, optional: false },
    ]);
  });

  it('update(id: string, data: UpdatePost) → [param "id", body]', () => {
    const plan = computeBindingPlan(
      [param('id', 'string'), param('data', 'UpdatePost')],
      noCollectors,
    );
    expect(plan).toHaveLength(2);
    expect(plan[0].source).toEqual({ kind: 'param', name: 'id', coerce: undefined });
    expect(plan[1].source).toEqual({ kind: 'body' });
  });

  it('list(options?: ListOptions) → [body] optional', () => {
    const plan = computeBindingPlan([param('options', 'ListOptions', true)], noCollectors);
    expect(plan[0].optional).toBe(true);
    expect(plan[0].source).toEqual({ kind: 'body' });
  });

  it('searchByTitle(query: string, limit: number) → [param, param coerce number]', () => {
    const plan = computeBindingPlan(
      [param('query', 'string'), param('limit', 'number')],
      noCollectors,
    );
    expect(plan[0].source).toEqual({ kind: 'param', name: 'query', coerce: undefined });
    expect(plan[1].source).toEqual({ kind: 'param', name: 'limit', coerce: 'number' });
  });

  it('create(data: CreatePost, author: User) with UserCollector → [body, collector]', () => {
    const collectors = new Set(['user']);
    const plan = computeBindingPlan(
      [param('data', 'CreatePost'), param('author', 'User')],
      collectors,
    );
    expect(plan[0].source).toEqual({ kind: 'body' });
    expect(plan[1].source).toEqual({ kind: 'collector', entityName: 'user' });
  });

  it('handler(ctx: InvocationContext) → [context]', () => {
    const plan = computeBindingPlan([param('ctx', 'InvocationContext')], noCollectors);
    expect(plan[0].source).toEqual({ kind: 'context' });
  });

  it('toggle(active: boolean) → [param coerce boolean]', () => {
    const plan = computeBindingPlan([param('active', 'boolean')], noCollectors);
    expect(plan[0].source).toEqual({ kind: 'param', name: 'active', coerce: 'boolean' });
  });
});

describe('resolveArgs', () => {
  it('resolves param from URL params', async () => {
    const plan: BindingPlan = [
      { name: 'id', source: { kind: 'param', name: 'id' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ params: { id: 'abc-123' } }));
    expect(args).toEqual(['abc-123']);
  });

  it('falls back to query when param not in URL params', async () => {
    const plan: BindingPlan = [
      { name: 'search', source: { kind: 'param', name: 'search' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ query: { search: 'hello' } }));
    expect(args).toEqual(['hello']);
  });

  it('coerces number from string', async () => {
    const plan: BindingPlan = [
      { name: 'limit', source: { kind: 'param', name: 'limit', coerce: 'number' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ query: { limit: '25' } }));
    expect(args).toEqual([25]);
  });

  it('coerces boolean from string', async () => {
    const plan: BindingPlan = [
      { name: 'active', source: { kind: 'param', name: 'active', coerce: 'boolean' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ query: { active: 'true' } }));
    expect(args).toEqual([true]);

    const args2 = await resolveArgs(plan, ctx({ query: { active: '0' } }));
    expect(args2).toEqual([false]);
  });

  it('resolves body', async () => {
    const body = { title: 'Hello', content: 'World' };
    const plan: BindingPlan = [
      { name: 'data', source: { kind: 'body' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ body }));
    expect(args).toEqual([body]);
  });

  it('resolves context', async () => {
    const invocation = ctx({ state: { userId: 'u1' } });
    const plan: BindingPlan = [
      { name: 'ctx', source: { kind: 'context' }, optional: false },
    ];
    const args = await resolveArgs(plan, invocation);
    expect(args[0]).toBe(invocation);
  });

  it('resolves collector', async () => {
    const fakeUser = { id: 'u1', name: 'Alice' };
    const plan: BindingPlan = [
      { name: 'author', source: { kind: 'collector', entityName: 'user' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ state: { userId: 'u1' } }), (entityName) => {
      if (entityName === 'user') return { collect: async () => fakeUser };
      return undefined;
    });
    expect(args).toEqual([fakeUser]);
  });

  it('resolves full update(id, data) plan', async () => {
    const plan: BindingPlan = [
      { name: 'id', source: { kind: 'param', name: 'id' }, optional: false },
      { name: 'data', source: { kind: 'body' }, optional: false },
    ];
    const body = { title: 'Updated' };
    const args = await resolveArgs(plan, ctx({ params: { id: 'x-1' }, body }));
    expect(args).toEqual(['x-1', body]);
  });

  it('resolves create(data, author) with collector', async () => {
    const body = { title: 'New Post' };
    const user = { id: 'u1', role: 'admin' };
    const plan: BindingPlan = [
      { name: 'data', source: { kind: 'body' }, optional: false },
      { name: 'author', source: { kind: 'collector', entityName: 'user' }, optional: false },
    ];
    const args = await resolveArgs(plan, ctx({ body, state: { userId: 'u1' } }), (name) => {
      if (name === 'user') return { collect: async () => user };
      return undefined;
    });
    expect(args).toEqual([body, user]);
  });
});
