/**
 * A frond installed from a package, extended to be made one's own.
 *
 * The package sends mail and leaves out how: `Mailer` is a port. A project extends the frond and
 * states its own `Mailer` — which must reach the service of the package that asks for it, not only
 * the handler. That holds because a child builds its parent's services in its own scope.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond } from '../src/index.js';
import { Invocation } from '../src/wire/Invocation.js';
import { op, param } from './contract.js';

abstract class Mailer {
  abstract send(to: string): Promise<string>;
}

class SmtpMailer extends Mailer {
  async send(to: string): Promise<string> {
    return `smtp:${to}`;
  }
}

class MailService {
  constructor(private mailer: Mailer) {}

  welcome(to: string): Promise<string> {
    return this.mailer.send(to);
  }
}

class MailHandler {
  constructor(private service: MailService) {}

  async welcome(to: string): Promise<string> {
    return this.service.welcome(to);
  }
}

class ResendMailer extends Mailer {
  async send(to: string): Promise<string> {
    return `resend:${to}`;
  }
}

const handler = { ctor: MailHandler, deps: ['MailService'], operations: { welcome: op({ cardinality: 'none', args: [param('to')] }) } };

const pkg = (withDefault: boolean) => frond('@acme/mail', {
  providers: [
    { ctor: Mailer, deps: [], abstract: true },
    { ctor: MailService, deps: ['Mailer'] },
    ...(withDefault ? [{ ctor: SmtpMailer, deps: [] }] : []),
  ],
  handlers: [handler],
});

const welcome = async (fronds: ReturnType<typeof frond>[], under: Record<string, { extends?: string }>) => {
  await using app = await createApp({ fronds, under, createContainer });

  return createLocalRunner(app)({ address: 'mail', op: 'welcome' }, Invocation.from({ params: { to: 'a@b.fr' } }));
};

describe('a frond extended from a package', () => {
  it('sends through the Mailer the child states, reached by the service of the package', async () => {
    const mine = frond('mymail', { providers: [ResendMailer] });

    const sent = await welcome([pkg(false), mine], { '@acme/mail': {}, mymail: { extends: '@acme/mail' } });

    expect(sent).toBe('resend:a@b.fr');
  });

  it('refuses the package alone when nothing realizes its port, naming the port', async () => {
    await expect(welcome([pkg(false)], { '@acme/mail': {} }))
      .rejects.toThrow(/a port nothing in the frond '@acme\/mail' realizes\. Extend it — mine: \{ extends: '@acme\/mail' \}/);
  });

  it('refuses a child that realizes nothing either, in the child', async () => {
    await expect(welcome([pkg(false), frond('mymail')], { '@acme/mail': {}, mymail: { extends: '@acme/mail' } }))
      .rejects.toThrow(/a port nothing in the frond 'mymail' realizes/);
  });

  it('keeps the package default when the child states none', async () => {
    const mine = frond('mymail');

    const sent = await welcome([pkg(true), mine], { '@acme/mail': {}, mymail: { extends: '@acme/mail' } });

    expect(sent).toBe('smtp:a@b.fr');
  });

  it('lets the child replace the package default', async () => {
    const mine = frond('mymail', { providers: [ResendMailer] });

    const sent = await welcome([pkg(true), mine], { '@acme/mail': {}, mymail: { extends: '@acme/mail' } });

    expect(sent).toBe('resend:a@b.fr');
  });

  it('refuses two children of one package until each answers under its own name', async () => {
    await expect(welcome(
      [pkg(true), frond('news'), frond('docs')],
      { '@acme/mail': {}, news: { extends: '@acme/mail' }, docs: { extends: '@acme/mail' } },
    )).rejects.toThrow(/frond-key-taken/);
  });
});
