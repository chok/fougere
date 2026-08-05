import List from '../entities/List.js';

declare class ListOrm {
  list(): List[];
}

/** Reads only — the presenter is the subject here. */
export default class ListHandler {
  constructor(private listOrm: ListOrm) {}

  async list() { return this.listOrm.list(); }
}
