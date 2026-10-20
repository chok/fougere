import Visitor from '../entities/Visitor.js';

export default class DeskHandler {
  /** The visitor's own name. */
  async mine(visitor: Visitor): Promise<string> {
    return visitor.name;
  }

  /** The visitor's name, or nothing for someone not signed in. */
  async maybe(visitor?: Visitor): Promise<string | null> {
    return visitor?.name ?? null;
  }
}
