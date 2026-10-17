import { lowerFirst } from '@fougere/schema';
import type { BindingCall, BindingSourceType } from '../../wire/BindingSourceType.js';
import type { Param } from '../../wire/Param.js';
import { validateInput } from '../../dispatch/validateInput.js';

/**
 * `Fact<PostPublished>` and `Pipe<PostPublished>` — a fact IS the payload, the whole of what
 * happened, never a piece of it; and a link that finishes one is handed all of it and answers all
 * of it. Asked FIRST: a fact names itself, and asked later it would be taken for the caller's input.
 *
 * Identical to the request input today, and deliberately not sharing its branch: the two agree by
 * coincidence, not by rule, and the day the input learns to look up a value by parameter name a
 * subscriber would receive ONE FIELD of the fact it subscribed to.
 */
const announcedIn = (param: Param, typeName: 'Fact' | 'Pipe'): string | undefined => {
  const fact = param.type.name === typeName ? param.type.generics?.[0]?.name : undefined;

  return fact === undefined ? undefined : lowerFirst(fact);
};

const payload = (_source: unknown, { ctx }: BindingCall): unknown => ctx.input;

const judged = (_source: unknown, value: unknown, { ctx, input }: BindingCall): unknown =>
  validateInput(input, { ...ctx, input: value }).input;

export const fact: BindingSourceType<'fact'> = {
  claim(param) {
    const factName = announcedIn(param, 'Fact');

    return factName === undefined ? undefined : { kind: 'fact', factName };
  },
  resolve: payload,
  given: judged,
};

export const pipe: BindingSourceType<'pipe'> = {
  claim(param) {
    const factName = announcedIn(param, 'Pipe');

    return factName === undefined ? undefined : { kind: 'pipe', factName };
  },
  resolve: payload,
  given: judged,
};
