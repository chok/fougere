import type { Fact } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** A subscriber in the announcer's own frond — a delivery, never a crossing. */
export default class ArchiveHandler {
  /** Keep what went out. */
  async keep(fact: Fact<PostPublished>): Promise<void> {
    void fact;
  }
}
