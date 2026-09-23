/**
 * A call's `state` holds what the extensions of this process declare, and nothing else.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { date, entity, json, primary, text } from '@fougere/schema';
import { Collector, createApp, createLocalRunner, ErrorCode, frond, Invocation, type Extension } from '../src/index.js';

class Member extends entity({ id: primary(), since: date() }) {}

const seen: Record<string, unknown>[] = [];

class StateHandler {
  async read(): Promise<void> {}
}

const session: Extension = { name: 'session', state: { user: json(Member) } };

const built = (extensions: Extension[], middleware?: (state: Record<string, unknown>) => void) => createApp({
  fronds: [frond('desk', {
    handlers: [{ ctor: StateHandler, deps: [], operations: { read: { binding: [] } } }],
  })],
  extensions,
  createContainer,
}).then((app) => {
  if (middleware) app.use(async (context, next) => { middleware(context.state); return next(); });
  app.use(async (context, next) => { seen.push({ ...context.invocation?.state }); return next(); });

  return app;
});

const read = (app: Awaited<ReturnType<typeof built>>, state: Record<string, unknown>, crossed?: true) =>
  createLocalRunner(app)({ entity: 'state', op: 'read' }, { ...Invocation.empty, state, ...(crossed ? { crossed } : {}) });

describe('the state of a call', () => {
  it('is rebuilt by the field that declares it', async () => {
    await using app = await built([session]);
    seen.length = 0;

    await read(app, { user: { id: 'u1', since: '2026-09-23T00:00:00.000Z' } });

    expect(seen[0]?.user).toEqual({ id: 'u1', since: new Date('2026-09-23T00:00:00.000Z') });
  });

  it('refuses a member nobody declares, naming it and what is declared', async () => {
    await using app = await built([session]);

    await expect(read(app, { tenant: 'acme' })).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'state.tenant: Unknown field — this process declares user',
    });
  });

  it('refuses a member a middleware wrote without declaring it', async () => {
    await using app = await built([session], (state) => { state.touched = true; });

    await expect(read(app, {})).rejects.toMatchObject({ message: expect.stringContaining('state.touched: Unknown field') });
  });

  it('refuses the boot when two extensions declare one member', async () => {
    await expect(built([session, { name: 'other', state: { user: text() } }]))
      .rejects.toThrow("'user' is declared by two extensions, 'session' and 'other'");
  });

  it('reads the extension that stays, when one replaces another by name', async () => {
    await using app = await built([session, { name: 'session', state: { tenant: text() } }]);

    await expect(read(app, { tenant: 'acme' })).resolves.toBeNull();
    await expect(read(app, { user: { id: 'u1', since: '2026-09-23T00:00:00.000Z' } }))
      .rejects.toMatchObject({ message: 'state.user: Unknown field — this process declares tenant' });
  });

  it('is not judged again when it crossed from the process where it entered', async () => {
    await using app = await built([]);
    seen.length = 0;

    await read(app, { tenant: 'acme' }, true);

    expect(seen[0]).toEqual({ tenant: 'acme' });
  });

  it('judges what a middleware of the receiver writes, since that is where it entered', async () => {
    await using app = await built([], (state) => { state.touched = true; });

    await expect(read(app, { tenant: 'acme' }, true))
      .rejects.toMatchObject({ message: 'state.touched: Unknown field — this process declares no state member' });
  });

  it('is read by the entity its collector names — rebuilt, or refused when it is not one', async () => {
    class MemberCollector extends Collector(Member) {
      async collect(ctx: { state: Record<string, unknown> }) { return ctx.state.user as Member | undefined; }
    }
    class SinceHandler {
      async read(member: Member): Promise<string> { return Object.prototype.toString.call(member.since); }
    }
    await using app = await createApp({
      fronds: [frond('desk', {
        handlers: [{
          ctor: SinceHandler,
          deps: [],
          operations: { read: { binding: [{ name: 'member', optional: false, source: { kind: 'collector' as const, typeName: 'member' } }] } },
        }],
        collectors: [MemberCollector],
      })],
      createContainer,
    });
    const since = (user: unknown) =>
      createLocalRunner(app)({ entity: 'since', op: 'read' }, { ...Invocation.empty, state: { user }, crossed: true });

    await expect(since({ id: 'u1', since: '2026-09-23T00:00:00.000Z' })).resolves.toBe('[object Date]');
    await expect(since({ id: 'u1', since: 'yesterday' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});
