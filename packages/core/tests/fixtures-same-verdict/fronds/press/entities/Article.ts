import { entity, primary, text, readOnly, auto, oneOf } from '@fougere/schema';

/**
 * Chosen for its axes, not its domain: one field per branch of the judge's
 * decision table — a required one, a read-only one, a bounded one, a stamped one.
 */
export default class Article extends entity({
  id: primary(),
  title: text({ min: 3, max: 40 }),
  body: text(),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  createdAt: auto(),
}) {}
