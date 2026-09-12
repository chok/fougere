/** The far side of the crossing. */
export default class ArticleHandler {
  /** How many are on the shelf. */
  async onHand(): Promise<number> {
    return 2;
  }
}
