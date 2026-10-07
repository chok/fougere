/**
 * The ascent, named — and the three things that were only true by accident before it.
 *
 * `dispose` had a shape (reverse order, only what it built); the way up had four call sites
 * under one word, `afterBoot`, meaning two different things. A host that wanted its own
 * seeding had to claim EVERYTHING after the boot to get it, which is how the Nitro plugin's
 * copy of the seeding loop drifted out of sight.
 */
import fronds from './fixtures-ports/fronds.js';
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { AppLifecycle, BootRefusal, checking, createApp, frond, migrating } from '../src/index.js';
import type { Extension } from '../src/index.js';


/** An extension that records when each half ran, in a shared list. */
const recording = (name: string, log: string[]): Extension => ({
  name,
  up: () => { log.push(`${name} up`); },
  down: () => { log.push(`${name} down`); },
});

describe('Lifecycle', () => {
  it('runs up in declaration order and down in reverse', async () => {
    const log: string[] = [];
    await using app = await createApp({
      fronds, createContainer,
      extensions: [recording('schema', log), recording('seeds', log)],
    });

    expect(log).toEqual(['schema up', 'seeds up']);
    expect(app.extensions()).toEqual(['schema', 'seeds']);

    await app.dispose();
    // Reverse of construction, the container's own rule read one level out.
    expect(log).toEqual(['schema up', 'seeds up', 'seeds down', 'schema down']);
  });

  /**
   * The one that lets a host say "the seeding, but mine" — Nuxt's plugin needs its seed
   * modules as static imports, and used to take over the whole post-boot to get them.
   */
  it('replaces a member of the same name, and keeps its position', async () => {
    const log: string[] = [];
    const lifecycle = new AppLifecycle()
      .add(recording('migrate', log), recording('seeds', log), recording('extra', log))
      .add({ name: 'seeds', up: () => { log.push('MY seeds'); } });

    expect(lifecycle.names()).toEqual(['migrate', 'seeds', 'extra']);
    await lifecycle.up({} as never);
    expect(log).toEqual(['migrate up', 'MY seeds', 'extra up']);
  });

  it('skips an absent member, so a host writes a conditional one inline', () => {
    expect(new AppLifecycle().add(undefined, migrating(() => {})).names()).toEqual(['schema']);
  });

  /**
   * `migrating()` with nothing to run still HOLDS the slot. Returning `undefined` there is
   * what let a host's own `migrate` land after the seeds — the slot is what makes a later
   * declaration a replacement instead of an addition.
   */
  it('holds the schema slot even when nothing migrates', async () => {
    const slot = migrating(undefined)!;
    expect(slot.name).toBe('schema');
    expect(slot.up).toBeUndefined();
    await new AppLifecycle().add(slot).up({} as never);
  });

  /**
   * The asymmetry is the design: a half-started app must not be handed out, while a
   * half-released one has already leaked everything the first refusal skipped.
   */
  it('stops the ascent at the first refusal', async () => {
    const log: string[] = [];
    const lifecycle = new AppLifecycle().add(
      { name: 'migrate', up: () => { throw new Error('no such table'); } },
      recording('seeds', log),
    );

    await expect(lifecycle.up({} as never)).rejects.toThrow('no such table');
    // A seed that assumes a migration ran must not run when it did not.
    expect(log).toEqual([]);
  });

  /**
   * The rule `down` applies INSIDE its list, applied ACROSS the three levels of a release.
   * It was stated in one place and broken in the other: a refusing extension took the
   * container and the handed-in connection down with it, which is the leak this whole
   * gesture exists to prevent.
   */
  it('releases the container and what was handed in even when an extension refuses', async () => {
    const released: string[] = [];
    const container = createContainer();
    const disposeContainer = container.dispose.bind(container);
    container.dispose = async () => { released.push('container'); await disposeContainer(); };

    const app = await createApp({
      fronds,
      createContainer: () => container,
      extensions: [{ name: 'broken', down: () => { throw new Error('socket already gone'); } }],
      onDispose: () => { released.push('handed in'); },
    });

    await expect(app.dispose()).rejects.toThrow(AggregateError);
    // Still told to close, both of them — and the refusal is still reported.
    expect(released).toEqual(['container', 'handed in']);
  });

  /**
   * The caller hands `onDispose` over BEFORE the ascent runs, and never receives the app that
   * would carry it back. So a refusal on the way up has to release what the boot took, or
   * whoever opened the connection leaks it on every failed boot.
   */
  it('releases what it took when the ascent refuses', async () => {
    const released: string[] = [];
    const container = createContainer();
    const disposeContainer = container.dispose.bind(container);
    container.dispose = async () => { released.push('container'); await disposeContainer(); };

    const boot = createApp({
      fronds,
      createContainer: () => container,
      extensions: [
        { name: 'opens', down: () => { released.push('opens'); } },
        { name: 'refuses', up: () => { throw new Error('port 5432 refused'); } },
      ],
      onDispose: () => { released.push('handed in'); },
    });

    await expect(boot).rejects.toThrow('port 5432 refused');
    expect(released).toEqual(['opens', 'container', 'handed in']);
  });

  /**
   * And before the ascent too: the boot opens sources and builds storages long before an
   * extension is asked to rise, and a refusal in there used to walk out holding all of it.
   * No app exists yet, so `down` has no list to run — the other two levels still do.
   */
  it('releases what it took when the refusal comes before the ascent', async () => {
    const released: string[] = [];
    const container = createContainer();
    const disposeContainer = container.dispose.bind(container);
    container.dispose = async () => { released.push('container'); await disposeContainer(); };

    const boot = createApp({
      createContainer: () => container,
      scan: () => { throw new Error('the disk went away'); },
      onDispose: () => { released.push('handed in'); },
    });

    await expect(boot).rejects.toThrow('the disk went away');
    expect(released).toEqual(['container', 'handed in']);
  });

  it('keeps the original refusal beside the ones raised while releasing', async () => {
    const boot = createApp({
      fronds,
      createContainer,
      extensions: [{ name: 'refuses', up: () => { throw new Error('up refused'); } }],
      onDispose: () => { throw new Error('close refused'); },
    });

    await expect(boot).rejects.toMatchObject({
      errors: [expect.objectContaining({ message: 'up refused' }), expect.objectContaining({ message: 'close refused' })],
    });
  });

  /**
   * The order that was broken in production shape: a host declares its own `migrate` AFTER
   * the framework's defaults, and rows must still land after tables.
   */
  it('keeps the schema before seeds when the host declares its own migration last', async () => {
    const ran: string[] = [];
    await using app = await createApp({
      fronds, createContainer,
      extensions: [
        // No local storage resolved, so the framework contributes an empty slot…
        migrating(undefined),
        { name: 'seeds', up: () => { ran.push('seeds'); } },
        // …and the host fills it here, which must not land after the seeds.
        migrating(() => { ran.push('migrate'); }),
      ],
    });

    expect(app.extensions()).toEqual(['schema', 'seeds']);
    expect(ran).toEqual(['migrate', 'seeds']);
  });

  it('releases every member even when one refuses, and reports them together', async () => {
    const log: string[] = [];
    const lifecycle = new AppLifecycle().add(
      recording('first', log),
      { name: 'broken', down: () => { throw new Error('socket already gone'); } },
      recording('last', log),
    );

    await expect(lifecycle.down({} as never)).rejects.toThrow(AggregateError);
    // 'first' is what the abandoned release used to leak.
    expect(log).toEqual(['last down', 'first down']);
  });
});

describe('the conventional ascent', () => {
  it('checks the schema, then rows, then whatever the host took on', async () => {
    const ran: string[] = [];

    await using app = await createApp({
      fronds: [frond('empty', {})],
      createContainer,
      pending: async () => { ran.push('schema'); return []; },
      extensions: [{ name: 'host', up: () => { ran.push('host'); } }],
    });
    void app;

    // Four hosts wrote `migrating(…)` and `seeding(…)` into their own lists, one of them
    // as a string inside generated code. The ORDER is not a host's preference — rows
    // before tables is a boot that finds none — so `createApp` states it.
    expect(ran).toEqual(['schema', 'host']);
  });

  /**
   * The boot reads the database and never writes it: every other step of the ascent checks
   * and refuses, and the one that wrote is where replicas raced and an empty database beside
   * the real one was served with a green boot.
   */
  it('refuses a database behind the entities, naming what is missing and the command', async () => {
    const booting = createApp({
      fronds: [frond('empty', {})],
      createContainer,
      pending: async () => ['products — no table', 'orders.total — no column'],
    });

    await expect(booting).rejects.toThrow(/behind the entities \(2\):\n  products — no table\n  orders\.total — no column\n.*fougere migrate --apply/);
    await expect(booting).rejects.toBeInstanceOf(BootRefusal);
  });

  it('lets a failure that is not a refusal through as itself', async () => {
    const booting = createApp({
      fronds: [frond('empty', {})],
      createContainer,
      pending: async () => { throw new TypeError('the engine is gone'); },
    });

    await expect(booting).rejects.toThrow(TypeError);
    await expect(booting).rejects.not.toBeInstanceOf(BootRefusal);
  });

  it('writes the schema only when a process states it, replacing the check by name', async () => {
    const ran: string[] = [];

    await using app = await createApp({
      fronds: [frond('empty', {})],
      createContainer,
      pending: async () => ['products — no table'],
      extensions: [migrating(() => { ran.push('migrated'); })],
    });

    expect(app.extensions()).toEqual(['schema', 'seeds']);
    expect(ran).toEqual(['migrated']);
  });

  it('holds the slot when the host hands over no gesture', async () => {
    const ran: string[] = [];

    // Eight demos passed nothing, and a host that resolves no storage still must not have
    // its own members land before the seeds.
    await using app = await createApp({
      fronds: [frond('empty', {})],
      createContainer,
      extensions: [{ name: 'host', up: () => { ran.push('host'); } }],
    });

    expect(app.extensions()).toEqual(['schema', 'seeds', 'host']);
    expect(ran).toEqual(['host']);
    expect(checking(undefined).up).toBeUndefined();
  });
});
