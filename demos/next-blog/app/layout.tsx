import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = { title: 'Fougere — Next demo' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', margin: '0 auto', maxWidth: 720, padding: '2rem 1rem', lineHeight: 1.55 }}>
        <header style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e5e5', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <strong>fougere · next</strong>
          <nav style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
            <Link href="/">Published</Link>
            <Link href="/drafts">Drafts</Link>
            <Link href="/new">New</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
