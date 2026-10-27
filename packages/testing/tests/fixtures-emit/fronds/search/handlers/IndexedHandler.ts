import { Repository, type Fact } from '@fougere/core';
import Indexed from '../entities/Indexed.js';
import PostPublished from '../../blog/entities/PostPublished.js';

export default class IndexedHandler extends Repository<Indexed> {
  constructor(repo: Repository<Indexed>) {
    super();
  }

  /** Indexes a post the moment it is published. Accepting the fact IS the subscription. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    await super.create({ postId: fact.id, title: fact.title });
  }
}
