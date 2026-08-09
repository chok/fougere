import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/** A third frond, and the one that fails — on purpose. */
export default class DigestHandler {
  /** Queue a digest entry, badly. */
  async queue(fact: Fact<PostPublished>): Promise<void> {
    ((globalThis as any).__heard ??= []).push(`mail:${fact.id}`);
    throw new Error('the mail server is down');
  }
}
