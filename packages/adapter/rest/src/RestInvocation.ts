/** What a route's op is called with. */
export interface RestInvocation {
  params: Record<string, string>;
  query: Record<string, unknown>;
  input: unknown;
  state: Record<string, unknown>;
}
