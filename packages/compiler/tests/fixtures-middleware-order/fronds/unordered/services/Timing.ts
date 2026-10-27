import type { Call, Dispatcher } from '@fougere/core';

export default class Timing implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher) {}

  async dispatch(call: Call): Promise<unknown> {
    return this.inner.dispatch(call);
  }
}
