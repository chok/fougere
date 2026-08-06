/**
 * Form contract, pure part — derives what a create/edit form is made of
 * from the entity's field axes. No Vue, no Nuxt: testable headless,
 * usable by any renderer (the page owns the widgets).
 */
import { inputFields } from '@fougere/schema';
import type { ValidationError } from '@fougere/schema';

/** What an entity class exposes to a form — the schema statics it already has. */
export interface FormEntity {
  name: string;
  getFields(): Record<string, FieldLike>;
  validate(input: unknown): { success: true; data: unknown } | { success: false; errors: ValidationError[] };
}

interface FieldLike {
  shape?: { type?: unknown; enum?: readonly unknown[]; format?: string; properties?: unknown };
  lifecycle?: { create?: unknown };
  role?: { primary?: boolean; relation?: { kind: string } };
}

/**
 * The literal a field is born with, when it declares one.
 *
 * `text({ default: 'x' })` and `oneOf('a', 'b', { default: 'a' })` both compile to
 * `lifecycle.create = { value }` — the create rule that answers the field's absence.
 * The other create rules ('now', { generate }, 'optional') name no literal: their value
 * is decided at write time, so a form has nothing to show for them.
 */
function defaultOf(field: FieldLike): unknown {
  const create = field.lifecycle?.create;
  return create !== null && typeof create === 'object' && 'value' in create
    ? (create as { value: unknown }).value
    : undefined;
}

export interface FormField {
  name: string;
  /** Rendering hint derived from the shape — the page maps it to widgets. */
  control: 'text' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  /** i18n key by convention: `entity.field`. The schema never carries display text. */
  labelKey: string;
  /** Fallback label when no i18n message fills the key. */
  label: string;
  /** Enum values, when control is 'select'. */
  options?: string[];
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

function controlOf(field: FieldLike): FormField['control'] {
  const shape = field.shape ?? {};
  if (Array.isArray(shape.enum) && shape.enum.length) return 'select';
  const base = baseType(shape.type);
  if (base === 'number' || base === 'integer') return 'number';
  if (base === 'boolean') return 'boolean';
  if (base === 'string' && shape.format === 'date-time') return 'date';
  return 'text';
}

/**
 * The fields a create form is made of: membership from the io projection
 * (`inputFields` — what a client may supply), requiredness from the
 * lifecycle axis (any create rule makes absence legal).
 */
export function formFieldsOf(entity: FormEntity, entityKey: string): FormField[] {
  return Object.entries(inputFields(entity.getFields() as never)).map(([name, field]) => {
    const f = field as FieldLike;
    return {
      name,
      control: controlOf(f),
      required: f.lifecycle?.create === undefined,
      labelKey: `${entityKey}.${name}`,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      ...(Array.isArray(f.shape?.enum)
        ? { options: f.shape.enum.filter((value): value is string => typeof value === 'string') }
        : {}),
      ...(defaultOf(f) !== undefined ? { default: defaultOf(f) } : {}),
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
