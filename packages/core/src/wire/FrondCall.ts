/** Target of a call — which façade operation, wherever it lives. */
export interface FrondCall {
  /** Frond name, when the caller knows it. Routing hint only. */
  frond?: string;
  /** The address a handler answers at (e.g. 'product'). */
  address: string;
  /** Façade operation name (e.g. 'findById', 'search'). */
  op: string;
}
