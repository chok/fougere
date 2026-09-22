/** What an auth extension registers under {@link AUTH} once it has risen. */
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
