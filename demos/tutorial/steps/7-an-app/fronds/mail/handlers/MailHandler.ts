import type { Fact } from '@fougere/core';
import type PostPublished from '@fronds/blog/entities/PostPublished.js';
import Mailer from '../services/Mailer.js';

export default class MailHandler {
  constructor(private mailer: Mailer) {}

  async onPublished(post: Fact<PostPublished>): Promise<void> {
    await this.mailer.send(`Published: ${post.title}`);
  }
}
