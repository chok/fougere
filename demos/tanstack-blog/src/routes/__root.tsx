import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Fougere — TanStack Start demo' },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', margin: '0 auto', maxWidth: 720, padding: '2rem 1rem', lineHeight: 1.55 }}>
        <header style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e5e5', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <strong>fougere · tanstack start</strong>
          <nav style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
            <Link to="/">Published</Link>
            <Link to="/drafts">Drafts</Link>
            <Link to="/new">New</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
