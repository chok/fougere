import { Crud, type EntityOrm, type Fact } from '@fougere/core';
import Indexed from '../entities/Indexed.js';
import PostPublished from '../../blog/entities/PostPublished.js';

export default class IndexedHandler extends Crud(Indexed) {
  constructor(orm: EntityOrm<Indexed>) {
    super(orm);
  }

  /** Indexes a post the moment it is published. Accepting the fact IS the subscription. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    await this.orm.create({ postId: fact.id, title: fact.title });
  }
}
