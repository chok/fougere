import type { Call, Dispatcher } from '@fougere/core';

/** Declared in `ops`, which serves nothing — so it stands in front of every frond under it. */
export default class Everywhere implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher) {}

  async dispatch(call: Call): Promise<unknown> {
    ((globalThis as Record<string, unknown>).__around as string[])
      .push(`everywhere:${call.address.address}.${call.address.operation}`);

    return this.inner.dispatch(call);
  }
}
