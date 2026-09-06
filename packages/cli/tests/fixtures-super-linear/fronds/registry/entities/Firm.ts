import { entity, json, primary, text } from '@fougere/schema';

class Filing extends entity({ reference: text({ pattern: '^(\\d+)+$' }) }) {}

/** `code` nests a repetition, `filing` nests one under an object, `slug` states neither. */
export default class Firm extends entity({
  id: primary(),
  code: text({ pattern: '^(a+)+$' }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
  filing: json(Filing),
}) {}
