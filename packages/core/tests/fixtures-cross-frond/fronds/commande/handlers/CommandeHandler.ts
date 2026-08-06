import type ArticleHandler from '../../stock/handlers/ArticleHandler.js';

/**
 * The whole question, in one class: a frond reaching another frond's façade.
 *
 * `articleHandler` is the key the root container holds for the stock frond's façade
 * (`facadeKeyOf('article')`). Never its service, never its ORM — the façade is the
 * only public thing a frond has.
 */
export default class CommandeHandler {
  constructor(private articleHandler: ArticleHandler) {}

  /** Can this order be served from the shelf? */
  async servable(): Promise<boolean> {
    return (await this.articleHandler.onHand()) > 0;
  }
}
