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
  /** Maximum JSON-RPC body size. Default: 1 MiB. */
  maxBodyBytes?: number;
  /** Time allowed to receive a request. Default: 15 seconds. */
  requestTimeoutMs?: number;
}
