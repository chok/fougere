import { Crud } from '@fougere/core';
import Category from '../entities/Category.js';

export class StatsOutput extends Category.pick('id', 'name', 'postCount') {}

export default class CategoryHandler extends Crud(Category) {
  async stats(): Promise<StatsOutput[]> {
    const all = await this.storage.list();
    return all.map((c) => ({
      id: String(c.id),
      name: String(c.name),
      postCount: Number(c.postCount ?? 0),
    }));
  }
}
