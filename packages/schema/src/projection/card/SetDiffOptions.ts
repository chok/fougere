export interface SetDiffOptions {
  /** Declared renames, per entity: `{ post: { body: 'content' } }`. */
  renamed?: Record<string, Record<string, string>>;
}
