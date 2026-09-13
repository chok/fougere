export interface InvocationContext {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  input: unknown;
  state: Record<string, unknown>;
  trace?: string;
  identity?: string;
  caller?: string;
}
