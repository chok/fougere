export interface AdminFieldExtension {
  /** Changes the fallback in every derived view of this field. */
  label?: string;
  /** Removes the field from derived tables, shows and forms. */
  hidden?: boolean;
}
