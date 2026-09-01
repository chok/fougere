import type { Refreshed } from '@fougere/core';
import PartnerCatalog from '../services/PartnerCatalog.js';
import BookCard from '../entities/BookCard.js';

export default class CatalogHandler {
  constructor(private catalog: PartnerCatalog) {}

  /** Run one pass and say what it wrote. */
  async refresh(): Promise<Refreshed> {
    return await this.catalog.refresh();
  }

  /** Read the copy — an ordinary local query, which the source could not have served. */
  async findCheapest(): Promise<BookCard[]> {
    return await this.catalog.storage.list({ orderBy: 'priceCents', order: 'asc', limit: 3 }) as BookCard[];
  }
}
