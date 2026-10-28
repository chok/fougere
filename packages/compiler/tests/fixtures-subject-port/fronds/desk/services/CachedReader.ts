import type { Collect, InvocationContext } from '@fougere/core';
import type Reader from '../entities/Reader.js';

export default class CachedReader implements Partial<Collect<Reader>> {
  constructor(private inner: Collect<Reader>) {}

  collect(context: InvocationContext) { return this.inner.collect(context); }
}
