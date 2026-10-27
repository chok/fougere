import type { Call, Dispatcher } from '@fougere/core';
import Trail from './Trail.js';

/** Its own frond, because nothing says otherwise. */
export default class Audit implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher, private trail: Trail) {}

  async dispatch(call: Call): Promise<unknown> {
    this.trail.note(`audit:${call.address.address}.${call.address.operation}`);

    return this.inner.dispatch(call);
  }
}
