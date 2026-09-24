/** The catalogue's view of a product. */
export default class ProductHandler {
  /** Which frond answered — the whole point of the test. */
  async who(): Promise<string> {
    return 'catalog';
  }
}
