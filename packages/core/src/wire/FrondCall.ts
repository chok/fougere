/** Target of a call — which façade operation, wherever it lives. */
export interface FrondCall {
  /** Frond name, when the caller knows it. Routing hint only. */
  frond?: string;
  /** Entity registration key (e.g. 'product'). */
  entity: string;
  /** Façade operation name (e.g. 'findById', 'search'). */
  op: string;
}
