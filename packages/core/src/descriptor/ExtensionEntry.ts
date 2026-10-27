import type { Field } from '@fougere/schema';

/**
 * An extension this frond declares — what rises and falls with the process, written beside the
 * code it instruments.
 *
 * It travels with its frond: moved behind `remotes:`, it mounts on the process serving it there,
 * which is why no key widens it. What must be everywhere is a frond that is everywhere, which
 * `Extension.fronds` already answers.
 */
export interface ExtensionEntry {
  /** Its own `name`, or the file's — the ascent REPLACES a name already declared. */
  name: string;
  /** The value handed to the ascent, the same shape `CreateAppOptions.extensions` takes. */
  extension: {
    name?: string;
    state?: Readonly<Record<string, Field>>;
    up?: (app: never) => void | Promise<void>;
    down?: (app: never) => void | Promise<void>;
  };
  filePath: string;
}

/** Recognized by its FORM: a value stating `up`, `down`, or the `state` members it declares. */
export function isExtension(value: unknown): value is ExtensionEntry['extension'] {
  const shape = value as { up?: unknown; down?: unknown; state?: unknown } | null;

  return typeof shape?.up === 'function' || typeof shape?.down === 'function'
    || (typeof shape?.state === 'object' && shape.state !== null);
}
