import { Lifecycle } from '@fougere/schema';
import { Shapes, lowerFirst, Role, Visibility } from '@fougere/schema';
import type { Field, SchemaView, ShapeType, ValidationError } from '@fougere/schema';
import type { FormField } from './FormField.js';
import type { TableColumn } from './TableColumn.js';

/** What an entity class exposes to a form — the schema statics it already has. */
export type FormEntity = SchemaView;

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
export function errorsByField(errors: ValidationError[]): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const err of errors) {
    const field = err.path[0];
    if (field === undefined) continue;
    byField[field] ??= err.message;
  }

  return byField;
}
