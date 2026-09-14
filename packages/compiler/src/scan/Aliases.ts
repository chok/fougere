import type { Live } from './Live.js';

/**
 * What the writer needs of an emitter's imports, and nothing more.
 *
 * The two emitters index theirs differently — one by value against a relative path, one
 * by file against the package specifier a project already uses — and neither is wrong for
 * the module it writes. What they agree on is this: a value already imported has an
 * alias, a class can be imported by name, and an entity can be found by its class name.
 */
export interface Aliases {
  aliasOf(value: Live): string | undefined;
  named(value: Live, filePath: string, name: string): string;
  /** The entity class this name belongs to — what a `Partial<X>` names as its source. */
  classNamed(name: string): Live | undefined;
}
