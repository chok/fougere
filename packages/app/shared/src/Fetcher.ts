export type Fetcher = <T>(url: string, options: { method: 'POST'; body: unknown }) => Promise<T>;
