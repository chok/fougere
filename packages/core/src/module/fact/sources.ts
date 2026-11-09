import { lowerFirst } from '@fougere/schema';
import type { BindingCall, BindingSourceType } from '../../wire/BindingSourceType.js';
import type { Param } from '../../wire/Param.js';
import { validateInput } from '../../dispatch/validateInput.js';

const announcedIn = (param: Param, typeName: 'Fact' | 'Pipe'): string | undefined => {
  const fact = param.type.name === typeName ? param.type.generics?.[0]?.name : undefined;

  return fact === undefined ? undefined : lowerFirst(fact);
};

const payload = (_source: unknown, { ctx }: BindingCall): unknown => ctx.input;

const validatedAsInput = (_source: unknown, value: unknown, { ctx, input }: BindingCall): unknown =>
  validateInput(input, { ...ctx, input: value }).input;

export const fact: BindingSourceType<'fact'> = {
  bind(param) {
    const factName = announcedIn(param, 'Fact');

    return factName === undefined ? undefined : { kind: 'fact', factName };
  },
  resolve: payload,
  given: validatedAsInput,
};

export const pipe: BindingSourceType<'pipe'> = {
  bind(param) {
    const factName = announcedIn(param, 'Pipe');

    return factName === undefined ? undefined : { kind: 'pipe', factName };
  },
  resolve: payload,
  given: validatedAsInput,
};
