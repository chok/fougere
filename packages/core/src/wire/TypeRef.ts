/** A type reference — primitives, entities, arrays, generics. */
export interface TypeRef {
  /** Raw type text as written in source (e.g. 'Pagination<Post>'). */
  raw: string;
  /** Base type name (e.g. 'Pagination', 'string', 'Post'). */
  name: string;
  /** Whether this is an array (T[] or Array<T>) — true at any depth. */
  array?: boolean;
  /** How MANY array levels. */
  arrayDepth?: number;
  /** Generic type arguments (e.g. for Pagination<Post> → [{ name: 'Post' }]). */
  generics?: TypeRef[];
  /** Whether `null` belongs to the type. */
  nullable?: boolean;
  /** Whether absence (`undefined` or `void`) belongs to the type. */
  undefined?: boolean;
  /** Whether this is a Promise wrapper (unwrapped in output). */
  promise?: boolean;
  /** `Post['title']` — the field this type is read from, whose rules the value obeys. */
  field?: { entity: string; name: string };
  /** The entity whose row this value designates — set by the scan when `field` is its primary. */
  identifies?: string;
}
