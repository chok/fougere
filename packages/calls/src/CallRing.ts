import { RPC_ENTITY, type CallPage, type CallRecord, type DispatchEvent } from '@fougere/core';

/** The message and the code of a refusal, without the stack that carries a body. */
function refusalOf(error: unknown): CallRecord['refusal'] {
  if (error === null || error === undefined) return { message: 'unknown refusal' };
  const held = error as { code?: unknown; message?: unknown };

  return {
    ...(typeof held.code === 'string' ? { code: held.code } : {}),
    message: typeof held.message === 'string' ? held.message : String(error),
  };
}

/**
 * A bounded log of what this process dispatched.
 *
 * The five transitions of one call are folded into one record: `received` opens it,
 * `resolved` names the route, `completed`/`failed` settle the verdict, `settled` closes
 * the duration. They are matched by the identity of the `Call`, which is the same frozen
 * object across all five.
 */
export class CallRing {
  private readonly held: CallRecord[] = [];
  private readonly open = new WeakMap<object, CallRecord>();
  private seq = 0;
  private lost = 0;
  private readonly watching = new Set<(record: CallRecord) => void>();

  constructor(
    private readonly max = 500,
    private readonly frondOf: (entity: string) => string | undefined = () => undefined,
  ) {}

  record(event: DispatchEvent): void {
    // A reader reaches this ring through `rpc`, so recording that would make the panel
    // watch itself — one reader, one line, forever.
    if (event.call.address.entity === RPC_ENTITY) return;

    if (event.stage === 'received') return this.opened(event);

    const record = this.open.get(event.call);
    if (!record) return;

    if (event.stage === 'resolved' && event.routeKind) record.route = event.routeKind;
    if (event.stage === 'completed') record.verdict = 'ok';
    if (event.stage === 'failed') {
      record.verdict = 'failed';
      record.refusal = refusalOf(event.error);
    }
    if (event.stage === 'settled') {
      record.ms = Date.now() - record.startedAt;
      if (event.routeKind) record.route = event.routeKind;
      this.open.delete(event.call);
      for (const told of this.watching) {
        // A watcher's own failure is not the dispatch's problem — the same rule
        // `DispatchLifecycle` applies to an observer.
        try { told(record); } catch { /* observational */ }
      }
    }
  }

  private opened(event: DispatchEvent): void {
    const { entity, operation, surface } = event.call.address;
    const frond = this.frondOf(entity);
    const { trace, caller } = event.call.invocation;
    const record: CallRecord = {
      seq: ++this.seq,
      ...(frond ? { frond } : {}),
      entity,
      operation,
      ...(surface !== undefined ? { surface } : {}),
      ...(trace ? { trace } : {}),
      ...(caller ? { caller } : {}),
      startedAt: Date.now(),
      verdict: 'running',
    };

    this.held.push(record);
    this.open.set(event.call, record);

    if (this.held.length > this.max) this.lost += this.held.splice(0, this.held.length - this.max).length;
  }

  /**
   * Be told when a record settles, and get the unsubscription back.
   *
   * A page that polls is a page that is always a little wrong; this is what lets a door
   * push instead. Told at `settled` and not at `received`, because a record is only
   * complete then — a reader would otherwise redraw the same line four times.
   */
  watch(told: (record: CallRecord) => void): () => void {
    this.watching.add(told);

    return () => this.watching.delete(told);
  }

  /** Everything above `cursor`, and what was lost while the reader was away. */
  since(cursor: number, inFlight = 0): CallPage {
    return {
      calls: this.held.filter((record) => record.seq > cursor),
      cursor: this.seq,
      inFlight,
      dropped: this.lost,
    };
  }
}
