/**
 * What a handler receives when it declares a port rather than an implementation.
 *
 * Before this, `constructor(private payment: Payment)` resolved — to the BASE class.
 * The handler got an object whose method did not exist and the failure read as a
 * runtime TypeError, from a signature TypeScript had blessed. Nothing was missing;
 * the wrong thing answered.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer, type Container } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/wire/Invocation.js';

const one = join(import.meta.dirname, 'fixtures-ports');
const two = join(import.meta.dirname, 'fixtures-ports-two');

describe('a port declared by extension', () => {
  it('hands the handler the implementation, not the base it declared', async () => {
    await using app = await createApp({ scan: await scanProject(one), createContainer });

    const out = await createLocalRunner(app)({ entity: 'checkout', op: 'pay' }, EMPTY_INVOCATION);

    expect(out).toEqual({ provider: 'stripe', amountCents: 4990 });
  });

  it('leaves a class that extends nothing scanned under its own name only', async () => {
    await using app = await createApp({ scan: await scanProject(one), createContainer });
    const scope = app.resolve<Container>('frond:billing');

    // Registered, as before. And it opened no second key: nothing extends it.
    expect(scope.resolve('Mailer')).toBeInstanceOf(Object);
    expect(scope.has('Payment')).toBe(true);
  });

  it('still answers under the implementation\'s own name', async () => {
    await using app = await createApp({ scan: await scanProject(one), createContainer });
    const scope = app.resolve<Container>('frond:billing');

    const direct = scope.resolve<{ charge(n: number): { provider: string } }>('StripePayment');
    const viaPort = scope.resolve<{ charge(n: number): { provider: string } }>('Payment');

    expect(direct.charge(1).provider).toBe('stripe');
    expect(viaPort.charge(1).provider).toBe('stripe');
  });
});

describe('two implementations of one port', () => {
  it('refuses at boot, naming both and the remedy', async () => {
    await expect(createApp({ scan: await scanProject(two), createContainer })).rejects.toThrow(
      /OgonePayment|StripePayment/,
    );
    await expect(createApp({ scan: await scanProject(two), createContainer })).rejects.toThrow(/ports: \{ Payment:/);
  });

  it('is settled by `ports:`, and the handler charges through the named one', async () => {
    await using app = await createApp({
      scan: await scanProject(two),
      createContainer,
      ports: { Payment: 'OgonePayment' },
    });

    const out = await createLocalRunner(app)({ entity: 'checkout', op: 'pay' }, EMPTY_INVOCATION);

    expect(out).toEqual({ provider: 'ogone', amountCents: 4990 });
  });

  it('refuses a `ports:` entry naming a class that does not extend the port', async () => {
    await expect(
      createApp({ scan: await scanProject(two), createContainer, ports: { Payment: 'Mailer' } }),
    ).rejects.toThrow(/does not extend it/);
  });
});

describe('a framework builtin is a port too', () => {
  const overridden = join(import.meta.dirname, 'fixtures-logger-override');

  it('hands the handler the declared subclass, not the default Logger', async () => {
    await using app = await createApp({ scan: await scanProject(overridden), createContainer });

    const out = await createLocalRunner(app)({ entity: 'report', op: 'run' }, EMPTY_INVOCATION);

    expect(out).toEqual({ logger: 'AuditLogger', seen: 1 });
  });

  it('leaves the default in place for a frond that declares none', async () => {
    await using app = await createApp({ scan: await scanProject(one), createContainer });

    expect(app.resolve<object>('Logger').constructor.name).toBe('Logger');
  });

  it('never treats a prefab base as a port — a repository is not one', async () => {
    const repo = join(import.meta.dirname, 'fixtures-repository');
    await using app = await createApp({ scan: await scanProject(repo), createContainer });
    const scope = app.resolve<Container>('frond:mesures');

    expect(scope.has('RepositoryBase')).toBe(false);
  });
});
