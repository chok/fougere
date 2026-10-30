import type { Logger } from '@fougere/core';
import type Mailer from './Mailer.js';

export default class AuditMailer implements Partial<Mailer> {
  constructor(private inner: Mailer, private log: Logger) {}

  async send(subject: string): Promise<void> {
    this.log.info('sending', subject);

    return this.inner.send(subject);
  }
}
