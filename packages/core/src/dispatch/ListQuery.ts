import { Shapes, type Fields } from '@fougere/schema';
import { LIST_OPTION_KEYS } from '../storage/Storage.js';

/**
 * A list's options as a URL writes them: text values, criteria by field name.
 * Ex: `?limit=20&name=Bob`.
 */
export class ListQuery {
  private static readonly SHAPES = {
    limit: { type: 'integer' },
    offset: { type: 'integer' },
    page: { type: 'integer' },
    count: { type: 'boolean' },
  } as const;

  static read(query: Record<string, unknown> | undefined, fields: Fields | undefined): Record<string, unknown> | undefined {
    if (!query) return query;

    const options: Record<string, unknown> = {};
    const where: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      const field = LIST_OPTION_KEYS.includes(key) ? undefined : fields?.[key];
      if (field && typeof value === 'string') where[key] = Shapes.fromText(field.shape, value);
      else options[key] = Shapes.fromText(ListQuery.SHAPES[key as keyof typeof ListQuery.SHAPES], value);
    }
    if (Object.keys(where).length === 0) return options;

    return { ...options, where: { ...(options.where as Record<string, unknown> | undefined), ...where } };
  }
}
