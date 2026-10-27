import type { Call, Dispatcher } from '@fougere/core';

export default class Audit implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher) {}

  async dispatch(call: Call): Promise<unknown> {
    return this.inner.dispatch(call);
  }
}
