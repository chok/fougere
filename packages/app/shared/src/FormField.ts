/** The entity a reference points at, and which of its fields names one of its rows. */
export interface FormReference {
  /** Its address — what a call to it names. */
  to: string;
  /** Its primary field: what the reference holds. */
  key: string;
  /** What a choice shows, and what a search looks in. */
  label: string;
}

export interface FormField<Name extends string = string> {
  name: Name;
  /** Rendering hint derived from the shape — the page maps it to widgets. */
  control: 'text' | 'email' | 'url' | 'number' | 'boolean' | 'date' | 'select' | 'reference';
  required: boolean;
  /** i18n key by convention: `entity.field`. The schema never carries display text. */
  labelKey: string;
  /** Fallback label when no i18n message fills the key. */
  label: string;
  /** Enum values, when control is 'select'. */
  options?: (string | number)[];
  /** What a `reference` control chooses among. */
  reference?: FormReference;
  /**
   * What the browser enforces, under the names it already knows — spread this on the input and the
   * page states no rule of its own.
   */
  attrs?: {
    type?: 'email' | 'url' | 'number';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  /** The value the field is born with — the literal its `lifecycle.create` rule names. */
  default?: unknown;
}
