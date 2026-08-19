/**
 * The source, and it is not a database. It answers `?page=&since=` over HTTP and
 * nothing else — no filter of our choosing, no join, no order. That is when a mirror
 * earns its place: a real database is queried where it is.
 */
import { createServer } from 'node:http';

interface Book {
  isbn: string;
  title: string;
  author: string;
  priceCents: number;
  /** The partner's own clock. `?since=` compares against this and nothing else. */
  changedAt: Date;
}

const PAGE_SIZE = 3;

export interface Partner {
  url: string;
  close(): Promise<void>;
  /** Move a book, stamped now — what the second pass must find and the first must not. */
  change(isbn: string, priceCents: number): void;
  add(book: Omit<Book, 'changedAt'>): void;
  /** Ship a row the shape refuses, to show what a mirror does with it. */
  corrupt(isbn: string): void;
}

export async function startPartner(): Promise<Partner> {
  const now = new Date();
  const books: Book[] = [
    { isbn: '9780262510875', title: 'Structure and Interpretation', author: 'Abelson', priceCents: 5400, changedAt: now },
    { isbn: '9780201835953', title: 'The Mythical Man-Month', author: 'Brooks', priceCents: 3200, changedAt: now },
    { isbn: '9780132350884', title: 'Clean Code', author: 'Martin', priceCents: 3900, changedAt: now },
    { isbn: '9781617294945', title: 'Grokking Algorithms', author: 'Bhargava', priceCents: 2900, changedAt: now },
    { isbn: '9780134757599', title: 'Refactoring', author: 'Fowler', priceCents: 4700, changedAt: now },
  ];

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const page = Number(url.searchParams.get('page') ?? 0);
    const raw = url.searchParams.get('since');
    const since = raw ? new Date(raw) : undefined;

    const matching = books.filter((b) => !since || b.changedAt > since);
    const slice = matching.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const next = (page + 1) * PAGE_SIZE < matching.length ? page + 1 : null;

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      items: slice.map(({ changedAt: _, ...card }) => card),
      next,
    }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    change(isbn, priceCents) {
      const book = books.find((b) => b.isbn === isbn);
      if (book) Object.assign(book, { priceCents, changedAt: new Date() });
    },
    add(book) {
      books.push({ ...book, changedAt: new Date() });
    },
    corrupt(isbn) {
      const book = books.find((b) => b.isbn === isbn);
      if (book) Object.assign(book, { priceCents: -1, changedAt: new Date() });
    },
  };
}
