import type { Fields } from '@fougere/schema';

/** Immutable projection boundary of one operation result. */
export class OutputView {
  constructor(
    readonly fields: Fields,
    readonly closed = false,
  ) {}
}
