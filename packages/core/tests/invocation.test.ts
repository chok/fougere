import { describe, expect, it } from 'vitest';
import { Invocation } from '../src/wire/Invocation.js';

describe('Invocation.from', () => {
  it('uses undefined as the canonical absence for optional parameters and fields', () => {
    const invocation = Invocation.from({
      params: { omitted: undefined },
      input: { omitted: undefined, nested: { omitted: undefined } },
    });

    expect(invocation.params.omitted).toBeUndefined();
    expect(Object.hasOwn(invocation.params, 'omitted')).toBe(false);
    expect((invocation.input as Record<string, unknown>).omitted).toBeUndefined();
    expect(Object.hasOwn(invocation.input as object, 'omitted')).toBe(false);
    expect(Object.hasOwn((invocation.input as { nested: object }).nested, 'omitted')).toBe(false);
  });

  it('never rewrites explicit null as undefined', () => {
    const invocation = Invocation.from({
      params: { nullable: null },
      query: { nullable: null },
      input: { nullable: null, nested: { nullable: null } },
    });

    expect(invocation.params.nullable).toBeNull();
    expect(invocation.query.nullable).toBeNull();
    expect(invocation.input).toEqual({ nullable: null, nested: { nullable: null } });
  });

  it('distinguishes an absent optional nullable field from explicit null', () => {
    const absent = Invocation.from({ input: {} });
    const explicit = Invocation.from({ input: { value: null } });

    expect((absent.input as Record<string, unknown>).value).toBeUndefined();
    expect(Object.hasOwn(absent.input as object, 'value')).toBe(false);
    expect((explicit.input as Record<string, unknown>).value).toBeNull();
    expect(Object.hasOwn(explicit.input as object, 'value')).toBe(true);
  });

  it('creates a new value when the input changes', () => {
    const initial = Invocation.from({ input: { title: 'Before' }, state: { userId: '1' } });
    const changed = initial.withInput({ title: 'After' });

    expect(initial.input).toEqual({ title: 'Before' });
    expect(changed.input).toEqual({ title: 'After' });
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
