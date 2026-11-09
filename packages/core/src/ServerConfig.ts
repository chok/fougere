/**
 * A middleware in srvx's shape.
 * Ex: `cors()`.
 */
export type ServerMiddleware = (request: Request, next: () => Promise<Response>) => Response | Promise<Response>;

/** What stands around the requests `fougere serve` answers beside its envelope, outside in. */
export interface ServerConfig {
  use?: ServerMiddleware[];
}
