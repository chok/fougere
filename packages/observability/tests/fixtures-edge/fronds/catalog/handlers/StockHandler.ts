/** The far side of the one edge this fixture exists to produce. */
export default class StockHandler {
  /** How many are on the shelf. */
  async onHand(): Promise<number> {
    return 3;
  }
}
