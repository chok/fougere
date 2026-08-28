import type { App, Extension, InvocationContext } from '@fougere/core';
import { CallRing } from './CallRing.js';

export type { CallPage, CallRecord } from '@fougere/core';
export { CallRing } from './CallRing.js';

/** The rpc operation this extension answers under. */
export const CALLS_OP = 'calls';

export interface CallsOptions {
  /** How many calls the ring keeps. Beyond it, the oldest are dropped and counted. */
  max?: number;
}

/** `entity -> frond`, resolved once at boot: an address does not carry its frond. */
function frondIndex(app: App): (entity: string) => string | undefined {
  const byEntity = new Map<string, string>();
  for (const frond of app.fronds) {
    for (const entity of frond.entities) byEntity.set(entity.name, frond.name);
  }

  return (entity) => byEntity.get(entity);
}

function cursorOf(invocation: InvocationContext): number {
  const body = invocation.body as { since?: unknown } | undefined;
  const since = Number(body?.since ?? 0);

  return Number.isFinite(since) && since > 0 ? since : 0;
}

/**
 * What this process dispatched, kept in a bounded ring and served as an rpc operation.
 *
 * It watches rather than participates: `app.observe` is passive, `DispatchLifecycle`
 * swallows an observer's own failure, and the ring holds no reference to a body. What it
 * sees that a middleware cannot: a call refused BEFORE any handler — an unknown route, an
 * entity hosted elsewhere, a call arriving while the door drains — and the route kind of
 * every call, so a local execution and a hop to another process read the same way.
 *
 * The reader is `fougere devtools`, over `/_fougere/call` like any other consumer. No port
 * is opened here, and an app that never installed this package answers
 * `Unknown rpc operation 'calls'. It serves discover.`
 */
export function calls(options: CallsOptions = {}): Extension {
  /**
   * Per APP, not per extension. A host declares its extensions once, so the same instance
   * goes up on the new app before the old one is released — one shared ring would mix two
   * processes' worth of calls, and the older `down` would erase the newer subscription.
   */
  const stopping = new WeakMap<App, () => void>();

  return {
    name: 'calls',

    up(app: App) {
      const ring = new CallRing(options.max ?? 500, frondIndex(app));
      stopping.set(app, app.observe((event) => ring.record(event)));
      app.serveRpc(CALLS_OP, (invocation) => ring.since(cursorOf(invocation), app.inFlight()));
    },

    down(app: App) {
      stopping.get(app)?.();
      stopping.delete(app);
    },
  };
}
