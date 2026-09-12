import type { Facade } from '@fougere/core';
import type ArticleHandler from '../../stock/handlers/ArticleHandler.js';

/** One frond reaching another — the crossing `graph` reads off this constructor. */
export default class CommandeHandler {
  constructor(private articleFacade: Facade<ArticleHandler>) {}

  /** Can this order be served from the shelf? */
  async servable(): Promise<boolean> {
    const onHand = await this.articleFacade.onHand() as number;

    return onHand > 0;
  }
}
