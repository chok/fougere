export interface FormField {
  name: string;
  /** Rendering hint derived from the shape — the page maps it to widgets. */
  control: 'text' | 'email' | 'url' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  /** i18n key by convention: `entity.field`. The schema never carries display text. */
  labelKey: string;
  /** Fallback label when no i18n message fills the key. */
  label: string;
  /** Enum values, when control is 'select'. */
  options?: string[];
  /**
   * What the browser enforces, under the names it already knows — spread this on the input and the
   * page states no rule of its own.
   */
  attrs?: {
    type?: 'text' | 'email' | 'url' | 'number';
    required?: boolean;
    minlength?: number;
    maxlength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  /** The value the field is born with — the literal its `lifecycle.create` rule names. */
  default?: unknown;
}
