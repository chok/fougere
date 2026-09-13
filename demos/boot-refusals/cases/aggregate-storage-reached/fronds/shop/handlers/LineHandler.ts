import type { Storage } from '@fougere/core';
import type Line from '../entities/Line.js';

/** Reaches around the aggregate that owns Line. */
export default class LineHandler {
  constructor(private lines: Storage<Line>) {}

  /** Every line, read behind the owner's back. */
  async all() { return this.lines.list(); }
}
