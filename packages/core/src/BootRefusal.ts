/**
 * A boot stopped by what it was handed — a declaration, the frond tree, a database behind its
 * entities — rather than by a bug. Its message is for whoever has to fix it, and a host shows it
 * without a stack: the stack names the check that refused, never what it refused.
 */
export class BootRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootRefusal';
  }
}
