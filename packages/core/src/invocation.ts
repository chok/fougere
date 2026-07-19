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
}

/** Empty context for programmatic / test calls. */
export const EMPTY_INVOCATION: InvocationContext = {
  params: {},
  query: {},
  body: undefined,
  state: {},
};
