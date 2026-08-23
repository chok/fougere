export interface InvocationContext {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
  state: Record<string, unknown>;
  trace?: string;
  identity?: string;
  caller?: string;
}

export type InvocationInput = Partial<InvocationContext>;

function canonicalValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(canonicalValue));

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return canonicalRecord(value);
}

function canonicalRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});

  const result: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    if (member !== undefined) result[key] = canonicalValue(member);
  }
  return Object.freeze(result);
}

/** Canonical invocation shared by every entry and transport. */
export class Invocation implements InvocationContext {
  readonly params: Record<string, unknown>;
  readonly query: Record<string, unknown>;
  readonly body: unknown;
  readonly state: Record<string, unknown>;
  readonly trace?: string;
  readonly identity?: string;
  readonly caller?: string;

  private constructor(input: InvocationInput) {
    this.params = canonicalRecord(input.params);
    this.query = canonicalRecord(input.query);
    this.body = canonicalValue(input.body);
    // State is host-owned and may still be enriched by existing middlewares. Moving it
    // to immutable lifecycle context is a separate migration.
    this.state = input.state ?? {};
    if (input.trace !== undefined) this.trace = input.trace;
    if (input.identity !== undefined) this.identity = input.identity;
    if (input.caller !== undefined) this.caller = input.caller;
    Object.freeze(this);
  }

  static from(input?: InvocationInput): Invocation {
    return input instanceof Invocation ? input : new Invocation(input ?? {});
  }

  withBody(body: unknown): Invocation {
    return new Invocation({ ...this, body });
  }

  withState(state: Record<string, unknown>): Invocation {
    return new Invocation({ ...this, state });
  }
}

export const EMPTY_INVOCATION = Invocation.from();

export function canonicalInvocation(input?: InvocationInput): Invocation {
  return Invocation.from(input);
}
