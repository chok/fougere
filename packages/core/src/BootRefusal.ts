/** A boot stopped by what it was handed rather than by a bug; a host shows it without a stack. */
export class BootRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootRefusal';
  }
}
