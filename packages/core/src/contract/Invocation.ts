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

/**
 * Freezes plain data deeply, and leaves a class instance alone — a `Date` is not a record.
 * FR : fige les données nues en profondeur, et laisse une instance de classe — une `Date`
 * n'est pas un enregistrement.
 * `canonicalValue([{ a: 1 }])` → frozen; `canonicalValue(new Date())` → the same `Date`
 */
function canonicalValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(canonicalValue));

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return canonicalRecord(value);
}

/**
 * Drops the keys set to `undefined`, so a body and its JSON round-trip agree.
 * FR : retire les clés valant `undefined`, pour qu'un corps et son aller-retour JSON s'accordent.
 * `canonicalRecord({ a: 1, b: undefined })` → `{ a: 1 }`
 */
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

  /**
   * Gives every entry and every transport the same seven-member value, frozen.
   * FR : donne à chaque porte et à chaque transport la même valeur à sept membres, figée.
   * `params`, `query`, `body`, `state`, `trace`, `identity`, `caller`
   */
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

  /**
   * Takes a raw object or an invocation, so a caller never has to know which it holds.
   * FR : accepte un objet nu ou une invocation, l'appelant n'ayant pas à savoir lequel il tient.
   * `Invocation.from(inv)` → `inv` itself, not a copy
   */
  static from(input?: InvocationInput): Invocation {
    return input instanceof Invocation ? input : new Invocation(input ?? {});
  }

  /**
   * Replaces the body — how the façade hands on the value it parsed.
   * FR : remplace le corps — la façade transmet ainsi la valeur qu'elle a analysée.
   * `invocation.withBody(judged.data)`
   */
  withBody(body: unknown): Invocation {
    return new Invocation({ ...this, body });
  }

  /**
   * Replaces the host-owned state, which a middleware enriches before the handler runs.
   * FR : remplace l'état, propriété de l'hôte, qu'un middleware enrichit avant le handler.
   * `invocation.withState({ ...invocation.state, user })`
   */
  withState(state: Record<string, unknown>): Invocation {
    return new Invocation({ ...this, state });
  }
}

export const EMPTY_INVOCATION = Invocation.from();

/**
 * Names the same gesture as `Invocation.from` for callers that read better this way.
 * FR : nomme le même geste qu'`Invocation.from` pour les appelants qui se lisent mieux ainsi.
 * `canonicalInvocation({ body })`
 */
export function canonicalInvocation(input?: InvocationInput): Invocation {
  return Invocation.from(input);
}
