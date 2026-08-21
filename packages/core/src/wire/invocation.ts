/**
 * InvocationContext — unified cross-transport context.
 *
 * Every bridge (REST, GraphQL, Nuxt, CLI, event bus) produces an
 * InvocationContext before calling a handler facade. The binding
 * algorithm uses it to resolve handler parameters by type.
 */

export interface InvocationContext {
  /** Named path/route params (URL segments, CLI positional args). */
  params: Record<string, string>;
  /** Query-string params (CLI flags, search params). */
  query: Record<string, string>;
  /** Payload (HTTP body, event payload, CLI stdin). */
  body: unknown;
  /** State deposited by middlewares (auth, session, tenant). */
  state: Record<string, unknown>;
  /**
   * The trace this call continues, opaque to core — a `traceparent` when
   * `@fougere/observability` is installed, absent otherwise.
   *
   * It rides the invocation and not a header because the invocation is what EVERY
   * transport carries: a header is HTTP's alone, and the same call over a socket would
   * have arrived untraced. Beside `state` rather than inside it — one sack holds what a
   * caller claims about itself, the other what the wire says about the call.
   */
  trace?: string;
  /**
   * The caller's signed envelope, opaque to core — verified at the receiving boundary,
   * which then deposits what it proved INTO `state`.
   *
   * Beside `state` for the reason `trace` is, read the other way round: `state` is what a
   * caller claims, and this is what makes a claim checkable. A receiver that trusts one
   * without the other is the split hole — `{ state: { user: { role: 'admin' } } }` believed
   * because it arrived.
   */
  identity?: string;
  /**
   * The frond that signed this call, as the ROOT named it — written by the receiver
   * after it verified, absent otherwise.
   *
   * Top-level and not a key of `state` for the reason that decides every field here:
   * `state` travels unverified when no verifier is wired, so a `state.caller` would be
   * forgeable exactly where nothing checks it, and a reader could not tell an
   * established name from an asserted one. Absent means "not established" and nothing
   * else. A sender CLEARS it — it names the last hop, never the first.
   */
  caller?: string;
}

/** Empty context for programmatic / test calls. */
export const EMPTY_INVOCATION: InvocationContext = {
  params: {},
  query: {},
  body: undefined,
  state: {},
};
