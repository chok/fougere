/**
 * A method's signature, as a contract is built from it — the shape, never the reading.
 *
 * The scan derives one from source; `frond.config.ts` states one. Neither owns the shape.
 */
/** A type reference — primitives, entities, arrays, generics. */
export interface TypeRef {
  /** Raw type text as written in source (e.g. 'Pagination<Post>'). */
  raw: string;
  /** Base type name (e.g. 'Pagination', 'string', 'Post'). */
  name: string;
  /** Whether this is an array (T[] or Array<T>) — true at any depth. */
  array?: boolean;
  /**
   * How MANY array levels: `string[]` is 1, `string[][]` is 2. `array` only ever said
   * "at least one", which sufficed while one level meant one thing. It stopped sufficing
   * when a presenter method started taking the page — there the outer level IS the page
   * and what remains is the field, so telling `string[]` from `string[][]` is telling a
   * computed string from a computed list.
   */
  arrayDepth?: number;
  /** Generic type arguments (e.g. for Pagination<Post> → [{ name: 'Post' }]). */
  generics?: TypeRef[];
  /** Whether `null` belongs to the type. */
  nullable?: boolean;
  /** Whether absence (`undefined` or `void`) belongs to the type. */
  undefined?: boolean;
  /** Whether this is a Promise wrapper (unwrapped in output). */
  promise?: boolean;
}

/** One parameter of a signature. */
export interface Param {
  name: string;
  type: TypeRef;
  optional?: boolean;
}

/** A method signature. */
export interface Signature {
  name: string;
  params: Param[];
  returnType?: TypeRef;
  /**
   * Came from a base class, not from the file being scanned. What a prefab
   * handler declares about its own ops beats this — the scan reads a signature
   * and guesses, the builder knows.
   */
  inherited?: boolean;
  /**
   * The operation in words — the first sentence of the method's doc comment.
   *
   * Not a new thing to write: handlers already carry it (`/** Judge: the author,
   * a draft… *&#47;`), the AST already holds it, and nothing read it. A caller that
   * discovers an operation over the wire has its name and its schema; what the
   * operation is FOR lived only in the source.
   */
  description?: string;
}
