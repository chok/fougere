/** The port: what a handler asks for, never which provider answers. */
export default abstract class Payment {
  abstract charge(cents: number): Promise<string>;
}
