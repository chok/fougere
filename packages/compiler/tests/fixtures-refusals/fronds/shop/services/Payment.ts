/** A port: the handler names it, and what refuses is what stands behind it. */
export default abstract class Payment {
  abstract charge(cents: number): Promise<string>;
}
