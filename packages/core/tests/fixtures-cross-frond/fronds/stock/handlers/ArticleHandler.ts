/** The frond that owns the stock. It depends on no one. */
export default class ArticleHandler {
  /** How many of this article are on the shelf. */
  async onHand(): Promise<number> {
    return 7;
  }
}
