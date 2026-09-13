import type { RpcErrorShape } from './RpcErrorShape.js';

export type RpcResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: RpcErrorShape };
