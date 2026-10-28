import type { Repository } from '@fougere/core';
import List from '../entities/List.js';

/** Reads only — the presenter is the subject here. */
export default class ListHandler {
  constructor(private listes: Repository<List>) {}

  async list() { return this.listes.list(); }
}
