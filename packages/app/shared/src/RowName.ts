import { Role, Shapes, Visibility, type Fields } from '@fougere/schema';

/** The field that names a row: the first visible text that is neither its key nor a reference. */
export function rowNameOf(fields: Fields): string | undefined {
  const named = Object.entries(Visibility.of(fields).output).find(([, field]) =>
    Shapes.typeOf(field.shape) === 'text' && !Role.of(field).isPrimary() && !Role.of(field).isRelation());

  return named?.[0];
}
