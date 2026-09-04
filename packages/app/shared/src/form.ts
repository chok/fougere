import { Lifecycle } from '@fougere/schema';
/**
 * Form contract, pure part — derives what a create/edit form is made of from the entity's field
 * axes.
 */
import { Shapes, lowerFirst, Role, Visibility } from '@fougere/schema';
import type { Field, SchemaView, ValidationError, ValidationResult } from '@fougere/schema';

/** What an entity class exposes to a form — the schema statics it already has. */
export type FormEntity = SchemaView;

/** The literal a field is born with, when it declares one. */
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
  const base = Shapes.of(field.shape).base;
  if (base?.type === 'string' && base.enum?.length) return 'select';
  if (base?.type === 'number' || base?.type === 'integer') return 'number';
  if (base?.type === 'boolean') return 'boolean';
  if (base?.type === 'string' && base.format) return CONTROL_BY_FORMAT[base.format] ?? 'text';
  return 'text';
}

/** A closed set's members, when the shape declares one — `oneOf('draft','live')`. */
function enumOf(field: Field): readonly (string | null)[] | undefined {
  const base = Shapes.of(field.shape).base;
  return base?.type === 'string' ? base.enum : undefined;
}

/** Controls that ARE an `<input type>` — see the two absences on {@link FormField.attrs}. */
const INPUT_TYPES = new Set(['text', 'email', 'url', 'number']);

/** The shape's bounds, under the names a browser already enforces. */
function attrsOf(field: Field, control: FormField['control'], required: boolean): NonNullable<FormField['attrs']> {
  const base = Shapes.of(field.shape).base;
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

/** The fields a create form is made of. */
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
  /** The entity a `link` points at, under the key its door is named by. */
  to?: string;
}

/** Asked of the relation before the shape: a reference's own shape is a bare string. */
function renderOf(field: Field): TableColumn['render'] {
  if (Role.of(field).isReference) return 'link';
  const base = Shapes.of(field.shape).base;
  if (base?.type === 'number' || base?.type === 'integer') return 'number';
  if (base?.type === 'boolean') return 'boolean';
  if (base?.type === 'object' || base?.type === 'array') return 'json';
  if (base?.type === 'string' && base.format === 'date-time') return 'date';
  return 'text';
}

/** The columns a list is made of. */
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
 * The wire body of the form's values — an empty control is an absent value at the create boundary
 * (absence is judged by the lifecycle axis, an empty string would be judged as a present bad
 * value).
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
