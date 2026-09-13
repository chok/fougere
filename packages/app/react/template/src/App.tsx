import { useQuery } from '@fougere/react';
// Written by the scan: one export per address, carrying the handler that answers there.
// Replace `post` with a facade your own frond serves.
import { post } from '@fronds/facade';

/**
 * One read. `items` is typed by what the handler's `list` answers, and `error.code` by what
 * it can refuse — neither is written here, and neither can drift from the handler.
 */
export default function App() {
  const { items, loading, error } = useQuery(post, 'list');

  return (
    <main style={{ maxWidth: 720, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>Fougere</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b00' }}>{error.message}</p>}
      {items.map((row) => <pre key={String(row.id)}>{JSON.stringify(row, null, 2)}</pre>)}
    </main>
  );
}
