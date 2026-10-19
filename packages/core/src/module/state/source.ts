import type { BindingSourceType } from '../../wire/BindingSourceType.js';
import { State } from '../../wire/State.js';
import { request } from '../../slots.js';

/** `state: State` — the caller's state, through the request the call answers within. */
export const state: BindingSourceType<'state'> = {
  claim: (param) => (param.type.name === 'State' ? { kind: 'state' } : undefined),
  resolve: () => new State(request.current()),
  given: (_source, value) => value,
};
