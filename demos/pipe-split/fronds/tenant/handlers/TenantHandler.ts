import type { Pipe } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';
import Tenants from '../services/Tenants.js';

/**
 * The FIRST link, and it must be: it reads the author while the author is still an id.
 *
 * It takes a dependency the blog has no business holding — which is the other half of what
 * a link is for. `PostHandler` asking for `Tenants` would make publication depend on
 * accounting; each subscriber asking would be one lookup per reader.
 */
export default class TenantHandler {
  constructor(private tenants: Tenants) {}

  /** Say which account published, before anyone can no longer tell. */
  async set(fact: Pipe<PostPublished>): Promise<PostPublished> {
    return { ...fact, account: this.tenants.of(fact.author) } as PostPublished;
  }
}
