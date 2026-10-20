import { entity, json, primary, text } from '@fougere/schema';

/** The values a caller keeps in its session, by name — each one signed, as it would have left. */
export default class StateSession extends entity({
  id: primary(text()),
  values: json<Record<string, string>>(),
}) {}
