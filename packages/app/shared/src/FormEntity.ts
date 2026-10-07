import { Lifecycle } from '@fougere/schema';
import { FieldSet, Shapes, lowerFirst, Role, Visibility } from '@fougere/schema';
import type { Field, SchemaView, ShapeType, ValidationError } from '@fougere/schema';
import type { FormField, FormReference } from './FormField.js';
import type { FormErrors, FormFieldName } from './FormRow.js';
import { rowNameOf } from './RowName.js';
import type { TableColumn } from './TableColumn.js';

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
  if (Role.of(field).isReference()) return 'reference';
  if (enumOf(field)) return 'select';

  const type = Shapes.typeOf(field.shape);
  if (type && type !== 'text') return CONTROL_BY_TYPE[type];

  const base = Shapes.of(field.shape).base;
  const format = base?.type === 'string' ? base.format : undefined;

  return (format && CONTROL_BY_FORMAT[format]) ?? 'text';
}

/**
 * What a reference field chooses among. The label is the first text the target shows — never a
 * `writeOnly` one, since a choice is read by whoever fills the form — and its key when it shows none,
 * or when the target is known only by name.
 */
function referenceOf(field: Field): FormReference | undefined {
  const target = Role.of(field).target;
  if (!target) return undefined;
  const fields = (target as Partial<SchemaView>).getFields?.() ?? {};
  const key = FieldSet.of(fields).primary ?? 'id';

  return { to: lowerFirst(target.name), key, label: rowNameOf(fields) ?? key };
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
export function formFieldsOf<E extends SchemaView>(entity: E, entityKey: string): FormField<FormFieldName<E>>[] {
  const fields = Object.entries(Visibility.of(entity.getFields()).input).map(([name, field]) => {
    const f = field;
    const control = controlOf(f);
    const required = Lifecycle.of(f).requiredAtCreate() && !Shapes.of(f.shape).nullable;
    const attrs = attrsOf(f, control, required);
    const members = enumOf(f);
    const reference = referenceOf(f);

    return {
      name,
      control,
      required,
      ...labelOf(name, entityKey),
      ...(members ? { options: members.filter((value) => value !== null) } : {}),
      ...(reference ? { reference } : {}),
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(defaultOf(f) !== undefined ? { default: defaultOf(f) } : {}),
    };
  });

  return fields as FormField<FormFieldName<E>>[];
}

/**
 * What a form opens on. `initial` wins over the declared default: editing a row shows the row,
 * including a value the author deliberately changed away from that default. With no `initial` the
 * form creates, so it opens on what is about to be written — and opens on it again once a row is
 * answered, since the next submission is another row.
 */
export function openingOf(fields: FormField[], initial?: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.name, initial?.[field.name] ?? field.default]));
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
export function tableColumnsOf(entity: SchemaView, entityKey: string): TableColumn[] {
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
 * The wire body of the form's values. A control left empty or never touched is `null` for a field
 * that admits it — no choice is the answer there — and absent for any other, where the lifecycle axis judges the absence
 * and an empty string would be judged as a present bad value.
 */
export function payloadOf(
  entity: SchemaView,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const fields = entity.getFields();

  return Object.fromEntries(
    Object.entries(values).flatMap(([name, value]) => {
      const shape = fields[name]?.shape;
      if (value === undefined || value === '') return Shapes.of(shape).nullable ? [[name, null]] : [];

      return [[name, Shapes.fromText(shape, value)]];
    }),
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
