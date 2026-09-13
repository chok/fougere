/** The port: a class something already answers under. Nothing declares it as one. */
export default class Payment {
  async charge(_cents: number): Promise<string> { return 'none'; }
}
