import { Crud, type RepositoryOf, type Fact } from '@fougere/core';
import Indexed from '../entities/Indexed.js';
import PostPublished from '../../blog/entities/PostPublished.js';

export default class IndexedHandler extends Crud(Indexed) {
  constructor(repo: RepositoryOf<Indexed>) {
    super(repo);
  }

  /** Indexes a post the moment it is published. Accepting the fact IS the subscription. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    await this.storage.create({ postId: fact.id, title: fact.title });
  }
}
