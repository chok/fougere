/**
 * A middleware in srvx's shape: it answers in `next`'s place, or decorates what `next` answered —
 * `cors()`, a `/healthz`, compression, any function written for srvx.
 */
export type ServerMiddleware = (request: Request, next: () => Promise<Response>) => Response | Promise<Response>;

/**
 * What stands around the requests `fougere serve` answers beside its envelope — REST, GraphQL and
 * whatever none of them claims — outside in. The envelope its peers call is not among them.
 */
export interface ServerConfig {
  use?: ServerMiddleware[];
}
