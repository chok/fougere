import { Lifecycle } from '@fougere/schema';
/**
 * Form contract, pure part — derives what a create/edit form is made of
 * from the entity's field axes. No Vue, no Nuxt: testable headless,
 * usable by any renderer (the page owns the widgets).
 */
import { Anatomy, lowerFirst, Role, Visibility } from '@fougere/schema';
import type { Field, SchemaView, ValidationError, ValidationResult } from '@fougere/schema';

/**
 * What an entity class exposes to a form — the schema statics it already has.
 *
 * `SchemaView` and the real `Field`, not a local re-description of the axes: this file
 * used to declare its own `FieldLike` with `shape?` optional, so it kept judging by a
 * looser contract than the schema's own and would never have seen `shape` become
 * required.
 */
export type FormEntity = SchemaView;

/**
 * The literal a field is born with, when it declares one.
 *
 * `text({ default: 'x' })` and `oneOf('a', 'b', { default: 'a' })` both compile to
 * `lifecycle.create = { value }` — the create rule that answers the field's absence.
 * The other create rules ('now', { generate }, 'optional') name no literal: their value
 * is decided at write time, so a form has nothing to show for them.
 */
function defaultOf(field: Field): unknown {
  return Lifecycle.of(field).literal?.value;
}

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
   * What the browser enforces, under the names it already knows — spread this on the
   * input and the page states no rule of its own.
   *
   * The shape holds `minLength`/`maximum`/`pattern`; a browser holds `minlength`/
   * `max`/`pattern` and enforces them with no JavaScript at all. Carrying them here
   * is a projection, not a second rule: the judge reads the same shape, and a form
   * that ignores these still gets the same verdict — it just gets it later, and a
   * screen reader never gets it at all.
   *
   * `type` is part of the contract, not decoration: `email` and `url` are formats the
   * shape states and the browser checks live, per field, as one types. A page writing
   * `type="email"` by hand is spelling a second time what the card already said.
   *
   * Three deliberate absences, each one a place where the attribute would mean
   * something the shape does not say:
   * - a `date` field gets no `type` — neither `date` nor `datetime-local` produces the
   *   RFC 3339 string a `date-time` shape judges, so the browser would accept what the
   *   judge refuses;
   * - `select` and `boolean` are not inputs — the page picks the widget, `control` says
   *   which;
   * - a required `boolean` gets no `required` — on a checkbox that attribute means
   *   "must be CHECKED", where the shape only says the value must be supplied.
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
  /**
   * The value the field is born with — the literal its `lifecycle.create` rule names.
   * Present so the form can SHOW what is about to be written; the storage realizes it
   * either way, so a form that ignores this still produces the same row.
   */
  default?: unknown;
}

/** The base JSON type of a shape — unwraps the `[T,'null']` union. */
function baseType(type: unknown): string {
  if (Array.isArray(type)) return (type.find((t) => t !== 'null') as string) ?? 'string';
  return (type as string) ?? 'string';
}

/** The formats a browser has an input type for — the rest stay `text`, judged later. */
const CONTROL_BY_FORMAT: Record<string, FormField['control']> = {
  'date-time': 'date',
  email: 'email',
  uri: 'url',
};

function controlOf(field: Field): FormField['control'] {
  // Through `anatomy`, never `shape.type` directly: the nullable form is the `[T,'null']`
  // union, which a direct comparison misses in silence. It is also what narrows the shape
  // union, so `enum` and `format` are only reachable on the branches that carry them.
  const base = Anatomy.of(field.shape).base;
  if (base?.type === 'string' && base.enum?.length) return 'select';
  if (base?.type === 'number' || base?.type === 'integer') return 'number';
  if (base?.type === 'boolean') return 'boolean';
  if (base?.type === 'string' && base.format) return CONTROL_BY_FORMAT[base.format] ?? 'text';
  return 'text';
}

/** A closed set's members, when the shape declares one — `oneOf('draft','live')`. */
function enumOf(field: Field): readonly (string | null)[] | undefined {
  const base = Anatomy.of(field.shape).base;
  return base?.type === 'string' ? base.enum : undefined;
}

/** Controls that ARE an `<input type>` — see the two absences on {@link FormField.attrs}. */
const INPUT_TYPES = new Set(['text', 'email', 'url', 'number']);

/** The shape's bounds, under the names a browser already enforces. */
function attrsOf(field: Field, control: FormField['control'], required: boolean): NonNullable<FormField['attrs']> {
  const base = Anatomy.of(field.shape).base;
  const text = base?.type === 'string' ? base : undefined;
  const numeric = base?.type === 'number' || base?.type === 'integer' ? base : undefined;
  const attrs = {
    type: INPUT_TYPES.has(control) ? control : undefined,
    required: (required && control !== 'boolean') || undefined,
    minlength: text?.minLength,
    maxlength: text?.maxLength,
    min: numeric?.minimum,
    max: numeric?.maximum,
    pattern: text?.pattern,
  };
  return Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== undefined));
}

/**
 * The label convention, spelled once for both projections: an i18n key by convention and
 * the field's own name as the fallback. The schema never carries display text.
 */
function labelOf(name: string, entityKey: string): Pick<FormField, 'labelKey' | 'label'> {
  return { labelKey: `${entityKey}.${name}`, label: name.charAt(0).toUpperCase() + name.slice(1) };
}

/**
 * The fields a create form is made of: membership from the io projection
 * (`Visibility.input` — what a client may supply), requiredness from the
 * lifecycle axis (any create rule makes absence legal).
 */
export function formFieldsOf(entity: FormEntity, entityKey: string): FormField[] {
  return Object.entries(Visibility.of(entity.getFields()).input).map(([name, field]) => {
    const f = field;
    const control = controlOf(f);
    const required = Lifecycle.of(f).requiredAtCreate;
    const attrs = attrsOf(f, control, required);
    return {
      name,
      control,
      required,
      ...labelOf(name, entityKey),
      ...(Array.isArray(enumOf(f))
        ? { options: enumOf(f)!.filter((value): value is string => typeof value === 'string') }
        : {}),
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(defaultOf(f) !== undefined ? { default: defaultOf(f) } : {}),
    };
  });
}

export interface TableColumn {
  name: string;
  /**
   * How to print the value — the dual of {@link FormField.control}, and deliberately not
   * the same list: a closed set prints as its value, a reference prints as a link.
   */
  render: 'text' | 'number' | 'boolean' | 'date' | 'json' | 'link';
  /** The same key a form uses for the same field — one convention, two projections. */
  labelKey: string;
  label: string;
  /**
   * The entity a `link` points at, under the key its door is named by. Always present on a
   * reference: the card carries the target's name, and a card rebuilt with no sibling to
   * resolve to keeps it as a stand-in rather than losing it.
   */
  to?: string;
}

/** Asked of the relation before the shape: a reference's own shape is a bare string. */
function renderOf(field: Field): TableColumn['render'] {
  if (Role.of(field).isReference) return 'link';
  const base = Anatomy.of(field.shape).base;
  if (base?.type === 'number' || base?.type === 'integer') return 'number';
  if (base?.type === 'boolean') return 'boolean';
  if (base?.type === 'object' || base?.type === 'array') return 'json';
  if (base?.type === 'string' && base.format === 'date-time') return 'date';
  return 'text';
}

/**
 * The columns a list is made of: membership from the io projection (`Visibility.output` — what
 * may leave), minus collections, because a cell holds one value and a `many()` is a page.
 *
 * Which column identifies the row is NOT answered here — `FieldSet.primary` answers it for a
 * shape, and its own doc records what five private copies of that loop cost.
 */
export function tableColumnsOf(entity: FormEntity, entityKey: string): TableColumn[] {
  return Object.entries(Visibility.of(entity.getFields()).output)
    .filter(([, field]) => !Role.of(field).isCollection)
    .map(([name, field]) => {
      const target = Role.of(field).target;
      return {
        name,
        render: renderOf(field),
        ...labelOf(name, entityKey),
        ...(target ? { to: lowerFirst(target.name) } : {}),
      };
    });
}

/**
 * The wire body of the form's values — an empty control is an absent value
 * at the create boundary (absence is judged by the lifecycle axis, an empty
 * string would be judged as a present bad value).
 */
export function payloadOf(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
  );
}

/** Index judge errors by field — local judge and remote judge share this shape. */
export function errorsByField(errors: ValidationError[]): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const err of errors) {
    const field = err.path.split('.')[0] || err.path;
    byField[field] ??= err.message;
  }
  return byField;
}
