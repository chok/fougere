import { onLog, type App, type Extension, type InvocationContext } from '@fougere/core';
import { CallRing } from './CallRing.js';
import { ErrorRing, LogRing, QueryRing } from './rings.js';
import { servePanel, type PanelOptions } from './panel.js';

export type { CallPage, CallRecord } from '@fougere/core';
export { CallRing } from './CallRing.js';
export { LogRing, QueryRing, ErrorRing } from './rings.js';
export type { LogLine, QueryLine, ErrorGroup } from './rings.js';
export { servePanel, type PanelOptions } from './panel.js';

/** The rpc operation this extension answers under. */
export const CALLS_OP = 'calls';

export interface CallsOptions {
  /** How many calls the ring keeps. Beyond it, the oldest are dropped and counted. */
  max?: number;
  /** Serve the page too, on its own loopback port. */
  panel?: boolean | number | PanelOptions;
}

/** What this process serves, read from the app itself. */
function servedModel(app: App): unknown {
  return {
    fronds: app.fronds.map((frond) => ({
      name: frond.name,
      // What the config SAYS. What the runtime saw is in the ring, under `route` — and the
      // two disagree exactly when something is misconfigured, which is the whole point of
      // showing them side by side. `rpc.topology` calls a frond remote because it ANSWERED.
      declared: app.remotes[frond.name] ? 'remote' as const : 'local' as const,
      at: app.remotes[frond.name] ? hostOf(app.remotes[frond.name]!) : null,
      entities: frond.entities.map((entity) => entity.name),
      operations: frond.handlers.flatMap((handler) => {
        const ops = app.operationsFor(handler.address);
        return [...(ops?.values() ?? [])].map((op) => ({
          id: op.id,
          operation: op.operation,
          kind: op.kind,
          address: `${op.handler.address}.${op.implementation.method}`,
          handler: op.handler.className,
          description: op.description ?? null,
          input: nameOf(op.input),
          output: nameOf(op.output),
          cardinality: op.cardinality ?? null,
          parameters: op.parameters.map((one) => ({
            name: one.name,
            type: one.type,
            optional: one.optional,
            binding: one.binding.source.kind,
          })),
          surfaces: op.exposure.surfaces,
          adapters: op.exposure.adapters,
          placement: op.placement.runtime,
          file: op.implementation.filePath,
        }));
      }),
    })),
  };
}

/** Host and port only — a declared address may carry credentials, and this answer leaves. */
function hostOf(address: string): string {
  try {
    const url = new URL(address);
    return `${url.protocol}//${url.host}`;
  } catch {
    return address;
  }
}

function nameOf(schema: unknown): string | null {
  const named = schema as { getName?: () => string; name?: string } | undefined;
  if (!named) return null;

  return typeof named.getName === 'function' ? named.getName() : named.name ?? null;
}

/** `address -> frond`, resolved once at boot: a call's address does not carry its frond. */
function frondIndex(app: App): (address: string) => string | undefined {
  const byAddress = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const entity of frond.entities) byAddress.set(entity.name, frond.name);
    for (const handler of frond.handlers) byAddress.set(handler.address, frond.name);
  }

  return (address) => byAddress.get(address);
}

/** Subscribe to SQL when there is SQL. */
async function queriesFrom(queries: QueryRing): Promise<() => void> {
  try {
    const { onQuery } = await import('@fougere/adapter-sql');
    return onQuery((event) => queries.record(event));
  } catch {
    return () => {};
  }
}

function cursorOf(invocation: InvocationContext): number {
  const body = invocation.body as { since?: unknown } | undefined;
  const since = Number(body?.since ?? 0);

  return Number.isFinite(since) && since > 0 ? since : 0;
}

/** What this process dispatched, kept in a bounded ring and served as an rpc operation. */
export function calls(options: CallsOptions = {}): Extension {
  /** Per APP, not per extension. */
  const stopping = new WeakMap<App, () => void | Promise<void>>();

  return {
    name: 'calls',

    async up(app: App) {
      const ring = new CallRing(options.max ?? 500, frondIndex(app));
      const logs = new LogRing();
      const errors = new ErrorRing();
      const queries = new QueryRing();

      const undo = [
        app.observe((event) => {
          ring.record(event);
          if (event.stage === 'failed') errors.fromDispatch(event);
        }),
        onLog((line) => {
          logs.record(line);
          errors.fromLog(line);
        }),
        // `@fougere/adapter-sql` is optional — an app on another storage, or none, simply
        // never resolves it, and the Queries tab says there is none rather than staying
        // blank. Dynamic on purpose: this package declares no dependency on it.
        await queriesFrom(queries),
      ];
      const stop = () => { for (const one of undo) one(); };

      app.serveRpc(CALLS_OP, (invocation) => ring.since(cursorOf(invocation), app.inFlight()));

      if (!options.panel) {
        stopping.set(app, stop);
        return;
      }

      const asked = typeof options.panel === 'object' ? options.panel : {};
      const port = typeof options.panel === 'number' ? options.panel : asked.port;
      const close = await servePanel(ring, {
        ...asked,
        ...(port !== undefined ? { port } : {}),
        title: asked.title ?? app.fronds[0]?.name ?? 'fougere',
        fronds: app.fronds.map((frond) => frond.name),
        model: servedModel(app),
        logs: (cursor) => logs.since(cursor),
        errors: (cursor) => errors.since(cursor),
        queries: (cursor) => queries.since(cursor),
        inFlight: () => app.inFlight(),
        announce: asked.announce ?? ((url) => console.log(`  calls panel  ${url}`)),
      });

      stopping.set(app, async () => { stop(); await close(); });
    },

    async down(app: App) {
      await stopping.get(app)?.();
      stopping.delete(app);
    },
  };
}
