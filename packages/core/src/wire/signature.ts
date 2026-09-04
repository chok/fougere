/** A method's signature, as a contract is built from it — the shape, never the reading. */
/** A type reference — primitives, entities, arrays, generics. */
export interface TypeRef {
  /** Raw type text as written in source (e.g. 'Pagination<Post>'). */
  raw: string;
  /** Base type name (e.g. 'Pagination', 'string', 'Post'). */
  name: string;
  /** Whether this is an array (T[] or Array<T>) — true at any depth. */
  array?: boolean;
  /** How MANY array levels: */
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
  /** Came from a base class, not from the file being scanned. */
  inherited?: boolean;
  /** The operation in words — the first sentence of the method's doc comment. */
  description?: string;
}
