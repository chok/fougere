import type { InvocationContext } from './InvocationContext.js';
import type { PartialInvocation } from './PartialInvocation.js';

const canonical = new WeakSet<object>();
const EMPTY: Record<string, unknown> = Object.freeze({});
canonical.add(EMPTY);

function canonicalValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (canonical.has(value)) return value;
  if (Array.isArray(value)) {
    const list = Object.freeze(value.map(canonicalValue));
    canonical.add(list);

    return list;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  return canonicalRecord(value);
}

function canonicalRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY;
  if (canonical.has(value)) return value as Record<string, unknown>;

  const entries = Object.entries(value);
  if (entries.length === 0) return EMPTY;
  const result: Record<string, unknown> = {};
  for (const [key, member] of entries) {
    if (member !== undefined) result[key] = canonicalValue(member);
  }
  Object.freeze(result);
  canonical.add(result);

  return result;
}

/** Canonical invocation shared by every entry and transport. */
export class Invocation implements InvocationContext {
  static readonly empty = Invocation.from();

  readonly params: Record<string, unknown>;
  readonly query: Record<string, unknown>;
  readonly input: unknown;
  readonly args?: readonly unknown[];
  readonly state: Record<string, unknown>;
  readonly trace?: string;
  readonly identity?: string;
  readonly caller?: string;
  readonly runAt?: number;
  readonly fromAnotherProcess?: true;

  private constructor(context: PartialInvocation) {
    this.params = canonicalRecord(context.params);
    this.query = canonicalRecord(context.query);
    this.input = canonicalValue(context.input);
    if (context.args !== undefined) this.args = canonicalValue(context.args) as readonly unknown[];
    this.state = context.state ?? {};
    if (context.trace !== undefined) this.trace = context.trace;
    if (context.identity !== undefined) this.identity = context.identity;
    if (context.caller !== undefined) this.caller = context.caller;
    if (context.runAt !== undefined) this.runAt = context.runAt;
    if (context.fromAnotherProcess) this.fromAnotherProcess = true;
    Object.freeze(this);
  }

  /** Takes a raw object or an invocation, so a caller never has to know which it holds. */
  static from(context?: PartialInvocation): Invocation {
    return context instanceof Invocation ? context : new Invocation(context ?? {});
  }


  /** Replaces the input — how the façade hands on the value it parsed. */
  withInput(input: unknown): Invocation {
    return new Invocation({ ...this, input });
  }

  /** Replaces the host-owned state, which a middleware enriches before the handler runs. */
  withState(state: Record<string, unknown>): Invocation {
    return new Invocation({ ...this, state });
  }
}
