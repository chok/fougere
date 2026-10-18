/** Where the scan would look, and stated nowhere. */
export default class StrayHandler {
  async ping(): Promise<string> {
    return 'pong';
  }
}
