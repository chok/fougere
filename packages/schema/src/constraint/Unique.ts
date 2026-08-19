import { FieldGroup } from './FieldGroup.js';

export class Unique extends FieldGroup {
  /** Names its members. */
  static of(...members: string[]): Unique {
    return new Unique(members);
  }

  static self(): Unique {
    return new Unique([]);
  }
}
