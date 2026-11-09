import type { Live } from './Live.js';

/** What the statement writer needs of an emitter's imports. */
export interface Aliases {
  aliasOf(value: Live): string | undefined;
  named(value: Live, filePath: string, name: string): string;
  /** The entity class this name belongs to — what a `Partial<X>` names as its source. */
  classNamed(name: string): Live | undefined;
}
