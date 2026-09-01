import type { Facade } from '@fougere/core';
import type ArticleHandler from '../../stock/handlers/ArticleHandler.js';

/**
 * The whole question, in one class: a frond reaching another frond.
 *
 * `Facade<ArticleHandler>` is the second port, read like the first (`Storage<Post>`).
 * It names what arrives — the door built in front of the handler, not the handler, which
 * is never injected. The same type resolves the local façade or a doublure, so the
 * signature says nothing about where the stock frond runs.
 */
export default class CommandeHandler {
  constructor(private articleFacade: Facade<ArticleHandler>) {}

  /** Can this order be served from the shelf? */
  async servable(): Promise<boolean> {
    const onHand = await this.articleFacade.onHand() as number;
    return onHand > 0;
  }
}
