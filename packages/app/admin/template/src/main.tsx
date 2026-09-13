/**
 * The panel derives itself from the app it is pointed at.
 *
 * It asks `rpc.discover` on mount and builds the collections, their fields and the five CRUD
 * operations from the identity card that comes back. Nothing below names an entity, a column
 * or a form: add a frond to the app and its collection appears here on the next reload.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FougereAdmin } from '@fougere/admin/react';

/**
 * No `endpoint`, so it stays `/_fougere/call` — a relative address the dev proxy in
 * `vite.config.ts` forwards to the app next door.
 *
 * The integrated shape is the same component with nothing changed at all: mount it on a route
 * of the app that serves the frond, and same-origin does the rest. Standalone against another
 * host is one prop — `endpoint="https://shop.internal/_fougere/call"` — and the CORS that
 * comes with crossing an origin.
 */
function App() {
  return <FougereAdmin title="Admin" />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
