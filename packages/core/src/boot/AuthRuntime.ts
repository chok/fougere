/**
 * What an auth provider answers once it has risen — the handler a host mounts and the API a
 * session is read through. The provider is an extension: it brings the frond its rows live in,
 * and registers this under {@link AUTH} in its `up`.
 */
export interface AuthRuntime {
  /** Web Standard handler that processes `/auth/*` requests. */
  handler: (request: Request) => Promise<Response>;
  /** Programmatic API exposed by the provider (getSession, signOut, ...). */
  api: Record<string, unknown>;
  /** Effective mount path. */
  basePath: string;
}

/** The container key an auth provider registers its runtime under. */
export const AUTH = 'AuthRuntime';
