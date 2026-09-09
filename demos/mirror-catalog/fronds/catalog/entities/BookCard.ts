import { entity, primary, text, number, updated } from '@fougere/schema';

/**
 * The local copy of a partner's book. `pulledAt` says when WE wrote the row — the storage
 * stamps it. It is not the mark a pass resumes from: the partner compares `?since=`
 * against its own clock, and `PartnerCatalog` keeps that mark itself.
 */
export default class BookCard extends entity({
  isbn: primary(),
  title: text({ min: 1 }),
  author: text({ min: 1 }),
  priceCents: number({ min: 0 }),
  pulledAt: updated(),
}) {}
