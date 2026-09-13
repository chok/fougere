import type { Facade } from '@fougere/core';
import type StockHandler from '../../catalog/handlers/StockHandler.js';

/**
 * A frond reaching another through its façade — the sanctioned crossing. The span it nests
 * names a caller frond different from its own, which is the one thing an edge is counted from.
 */
export default class CartHandler {
  constructor(private stockFacade: Facade<StockHandler>) {}

  /** Whether the shelf can serve this cart. */
  async servable(): Promise<boolean> {
    const onHand = await this.stockFacade.onHand() as number;

    return onHand > 0;
  }
}
