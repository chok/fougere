import { describe, expect, it } from 'vitest';
import { Invocation, canonicalInvocation } from '../src/contract/Invocation.js';

describe('canonicalInvocation', () => {
  it('uses undefined as the canonical absence for optional parameters and fields', () => {
    const invocation = canonicalInvocation({
      params: { omitted: undefined },
      body: { omitted: undefined, nested: { omitted: undefined } },
    });

    expect(invocation.params.omitted).toBeUndefined();
    expect(Object.hasOwn(invocation.params, 'omitted')).toBe(false);
    expect((invocation.body as Record<string, unknown>).omitted).toBeUndefined();
    expect(Object.hasOwn(invocation.body as object, 'omitted')).toBe(false);
    expect(Object.hasOwn((invocation.body as { nested: object }).nested, 'omitted')).toBe(false);
  });

  it('never rewrites explicit null as undefined', () => {
    const invocation = canonicalInvocation({
      params: { nullable: null },
      query: { nullable: null },
      body: { nullable: null, nested: { nullable: null } },
    });

    expect(invocation.params.nullable).toBeNull();
    expect(invocation.query.nullable).toBeNull();
    expect(invocation.body).toEqual({ nullable: null, nested: { nullable: null } });
  });

  it('distinguishes an absent optional nullable field from explicit null', () => {
    const absent = canonicalInvocation({ body: {} });
    const explicit = canonicalInvocation({ body: { value: null } });

    expect((absent.body as Record<string, unknown>).value).toBeUndefined();
    expect(Object.hasOwn(absent.body as object, 'value')).toBe(false);
    expect((explicit.body as Record<string, unknown>).value).toBeNull();
    expect(Object.hasOwn(explicit.body as object, 'value')).toBe(true);
  });

  it('creates a new value when the body changes', () => {
    const initial = Invocation.from({ body: { title: 'Before' }, state: { userId: '1' } });
    const changed = initial.withBody({ title: 'After' });

    expect(initial.body).toEqual({ title: 'Before' });
    expect(changed.body).toEqual({ title: 'After' });
    expect(changed.state).toEqual({ userId: '1' });
    expect(changed).not.toBe(initial);
  });

  it('freezes caller input but preserves host-owned state during migration', () => {
    const state = { userId: '1' };
    const invocation = Invocation.from({ params: { id: '1' }, state });

    expect(Object.isFrozen(invocation)).toBe(true);
    expect(Object.isFrozen(invocation.params)).toBe(true);
    expect(invocation.state).toBe(state);
    expect(Object.isFrozen(invocation.state)).toBe(false);
  });
});
