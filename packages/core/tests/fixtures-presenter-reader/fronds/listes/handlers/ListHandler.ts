import List from '../entities/List.js';

declare class ListRepository {
  list(): List[];
}

/** Reads only — the presenter is the subject here. */
export default class ListHandler {
  constructor(private listes: ListRepository) {}

  async list() { return this.listes.list(); }
}
