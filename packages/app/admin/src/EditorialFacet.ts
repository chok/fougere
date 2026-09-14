export interface EditorialFacet {
  /** The field that carries the human-readable title. */
  title: string;
  /** The lifecycle vocabulary, grouped by meaning rather than by raw enum value. */
  state?: {
    field: string;
    draft?: readonly string[];
    published?: readonly string[];
  };
  createdAt?: string;
  updatedAt?: string;
}
