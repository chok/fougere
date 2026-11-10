import { CARRIES_LINE, declaredTopologyOf, DispatchEvent, frond, LogLine, type App, type Extension, type InvocationContext } from '@fougere/core';
import KeepHandler from './KeepHandler.js';
import { CallRing } from './CallRing.js';
import { ErrorRing } from './ErrorRing.js';
import { LogRing } from './LogRing.js';
import { QueryRing } from './QueryRing.js';
import { servePanel, type PanelOptions } from './panel.js';

export type { CallPage, CallRecord } from '@fougere/core';

/** The rpc operation this extension answers under. */
export const CALLS_OP = 'calls';

export interface CallsOptions {
  /** How many calls the ring keeps. Beyond it, the oldest are dropped and counted. */
  max?: number;
  /** Serve the page too, on its own loopback port. */
  panel?: boolean | number | PanelOptions;
}

function servedModel(app: App): unknown {
  const declared = declaredTopologyOf(app);
  const stated = new Map(declared.fronds.map((one) => [one.frond, one]));

  return {
    fronds: app.fronds.filter((frond) => !frond.fromExtension).map((frond) => ({
      name: frond.name,
      declared: stated.get(frond.name)?.placement ?? 'local',
      at: stated.get(frond.name)?.at ?? null,
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
          placement: op.placement,
          file: op.implementation.filePath,
        }));
      }),
    })),
  };
}

function nameOf(schema: unknown): string | null {
  const named = schema as { getName?: () => string; name?: string } | undefined;
  if (!named) return null;

  return typeof named.getName === 'function' ? named.getName() : named.name ?? null;
}

function frondIndex(app: App): (address: string) => string | undefined {
  const byAddress = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const handler of frond.handlers) byAddress.set(handler.address, frond.name);
  }

  return (address) => byAddress.get(address);
}

async function queriesFrom(queries: QueryRing): Promise<() => void> {
  try {
    const { onQuery } = await import('@fougere/adapter-sql');

    return onQuery((event) => queries.record(event));
  } catch {
    return () => {};
  }
}

function cursorOf(invocation: InvocationContext): number {
  const input = invocation.input as { since?: unknown } | undefined;
  const since = Number(input?.since ?? 0);

  return Number.isFinite(since) && since > 0 ? since : 0;
}

/** What this process dispatched, kept in a bounded ring and served as an rpc operation. */
export function calls(options: CallsOptions = {}): Extension {
  const stopping = new WeakMap<App, () => void | Promise<void>>();

  return {
    name: 'calls',

    fronds: [frond('calls', {
      handlers: [{
        ctor: KeepHandler,
        deps: ['LogRing', 'ErrorRing'],
        operations: {
          record: {
            input: LogLine,
            binding: [{ name: 'line', optional: false, source: { kind: 'fact', factName: 'logLine' } }],
          },
        },
      }],
    })],

    async up(app: App) {
      const ring = new CallRing(options.max ?? 500, frondIndex(app));
      const logs = new LogRing();
      const errors = new ErrorRing();
      const queries = new QueryRing();

      app.container.registerValue('LogRing', logs);
      app.container.registerValue('ErrorRing', errors);

      const undo = [
        app.observe((event) => {
          if (!(event instanceof DispatchEvent)) return;
          if (CARRIES_LINE.has(event.call.address.address)) return;
          ring.record(event);
          if (event.stage === 'failed') errors.fromDispatch(event);
        }),
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
        fronds: app.fronds.filter((frond) => !frond.fromExtension).map((frond) => frond.name),
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
