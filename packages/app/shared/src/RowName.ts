import { Role, Shapes, Visibility, type Fields } from '@fougere/schema';

/**
 * The field that names a row: the first text a reader may see that is neither its key nor a
 * reference. A choice shows it, a line of a list leads with it, and a search looks in it.
 */
export function rowNameOf(fields: Fields): string | undefined {
  const named = Object.entries(Visibility.of(fields).output).find(([, field]) =>
    Shapes.typeOf(field.shape) === 'text' && !Role.of(field).isPrimary() && !Role.of(field).isRelation());

  return named?.[0];
}
