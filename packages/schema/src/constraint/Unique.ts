import { FieldGroup } from './FieldGroup.js';

export class Unique extends FieldGroup {
  /**
   * About whichever field carries it, name pending — `unique(text())` runs inside the
   * declaration, before `entity()` reads the key. `resolvedOn` fills it in.
   */
  static self(): Unique {
    return new Unique([]);
  }
}
