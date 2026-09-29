import { Lifecycle } from '@fougere/schema';
import { Shapes, lowerFirst, Role, Visibility } from '@fougere/schema';
import type { Field, SchemaView, ShapeType, ValidationError } from '@fougere/schema';
import type { FormField } from './FormField.js';
import type { TableColumn } from './TableColumn.js';

/** What an entity class exposes to a form — the schema statics it already has. */
export type FormEntity = SchemaView;

/** The row an entity class builds, which is what its form fills and what `create` answers. */
export type FormRow<E> = E extends abstract new (...args: never[]) => infer Row ? Row : Record<string, unknown>;

/** What the form holds — any field, none of them yet. */
export type FormValues<E> = Partial<FormRow<E>>;

/** A field of that row, by name. */
export type FormFieldName<E> = keyof FormRow<E> & string;

/** One message per refused field. */
export type FormErrors<E> = Partial<Record<FormFieldName<E>, string>>;

/** The literal a field is born with, when it declares one. */
function defaultOf(field: Field): unknown {
  return Lifecycle.of(field).literal?.value;
}

/** The formats a browser has an input type for — the rest stay `text`, validated later. */
const CONTROL_BY_FORMAT: Record<string, FormField['control']> = {
  'date-time': 'date',
  email: 'email',
  uri: 'url',
};

/** What the type alone decides. A `text` still asks its format — that list is open. */
const CONTROL_BY_TYPE: Record<Exclude<ShapeType, 'text'>, FormField['control']> = {
  choice: 'select',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  date: 'date',
  object: 'text',
  array: 'text',
};

function controlOf(field: Field): FormField['control'] {
  if (enumOf(field)) return 'select';

  const type = Shapes.typeOf(field.shape);
  if (type && type !== 'text') return CONTROL_BY_TYPE[type];

  const base = Shapes.of(field.shape).base;
  const format = base?.type === 'string' ? base.format : undefined;

  return (format && CONTROL_BY_FORMAT[format]) ?? 'text';
}

/** A closed set's members, when the shape declares one — `oneOf('draft','live')`. */
function enumOf(field: Field): readonly (string | number | null)[] | undefined {
  const base = Shapes.of(field.shape).base;

  return base && 'enum' in base ? base.enum : undefined;
}

/** The `<input type>`s a browser checks — `text` is an input's default, and the only one a `<textarea>` may stand for. */
const INPUT_TYPES = new Set(['email', 'url', 'number']);

/** The shape's bounds, under the names a browser already enforces. */
function attrsOf(field: Field, control: FormField['control'], required: boolean): NonNullable<FormField['attrs']> {
  const base = Shapes.of(field.shape).base;
  const text = base?.type === 'string' ? base : undefined;
  const numeric = base?.type === 'number' || base?.type === 'integer' ? base : undefined;
  const attrs = {
    type: INPUT_TYPES.has(control) ? control : undefined,
    required: (required && control !== 'boolean') || undefined,
    minLength: text?.minLength,
    maxLength: text?.maxLength,
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
export function formFieldsOf<E extends FormEntity>(entity: E, entityKey: string): FormField<FormFieldName<E>>[] {
  const fields = Object.entries(Visibility.of(entity.getFields()).input).map(([name, field]) => {
    const f = field;
    const control = controlOf(f);
    const required = Lifecycle.of(f).requiredAtCreate();
    const attrs = attrsOf(f, control, required);
    const members = enumOf(f);

    return {
      name,
      control,
      required,
      ...labelOf(name, entityKey),
      ...(members ? { options: members.filter((value) => value !== null) } : {}),
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(defaultOf(f) !== undefined ? { default: defaultOf(f) } : {}),
    };
  });

  return fields as FormField<FormFieldName<E>>[];
}

/** Asked of the relation before the shape: a reference's own shape is a bare string. */
const RENDER_BY_TYPE: Record<ShapeType, TableColumn['render']> = {
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  object: 'json',
  array: 'json',
  date: 'date',
  choice: 'text',
  text: 'text',
};

function renderOf(field: Field): TableColumn['render'] {
  if (Role.of(field).isReference()) return 'link';
  const type = Shapes.typeOf(field.shape);

  return type ? RENDER_BY_TYPE[type] : 'text';
}

/** The columns a list is made of. */
export function tableColumnsOf(entity: FormEntity, entityKey: string): TableColumn[] {
  return Object.entries(Visibility.of(entity.getFields()).output)
    .filter(([, field]) => !Role.of(field).isCollection())
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
 * (absence is validated by the lifecycle axis, an empty string would be validated as a present bad
 * value).
 */
export function payloadOf(
  entity: FormEntity,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const fields = entity.getFields();

  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([name, value]) => [name, Shapes.fromText(fields[name]?.shape, value)]),
  );
}

/** Index validator errors by field — local validator and remote validator share this shape. */
export function errorsByField<E>(errors: ValidationError[]): FormErrors<E> {
  const byField: Record<string, string> = {};
  for (const err of errors) {
    const field = err.path[0];
    if (field === undefined) continue;
    byField[field] ??= err.message;
  }

  return byField as FormErrors<E>;
}
