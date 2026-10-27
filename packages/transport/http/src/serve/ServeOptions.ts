import type { ServerMiddleware } from '@fougere/core';
import { type ReceiveOptions } from '../server.js';

export interface ServeOptions extends ReceiveOptions {
  /** Port to listen on. 0 (default) picks a free one. */
  port?: number;
  /** The addresses this receiver may bind. */
  hosts?: string[];
  /** Which address to bind. Must be one of `hosts`. Defaults to its first. */
  host?: string;
  /** Serve unsigned calls beyond loopback, deliberately. */
  allowUnsigned?: boolean;
  /** Time allowed to receive a request. Default: 15 seconds. */
  requestTimeoutMs?: number;
  /**
   * What answers a request that is not a call — the REST door of the fronds this process hosts.
   * `undefined` from it, or no `beside` at all, is a 404.
   */
  beside?: (request: Request) => Promise<Response | undefined>;
  /** What stands around `beside`, outside in — the envelope stays outside every one of them. */
  use?: ServerMiddleware[];
}
