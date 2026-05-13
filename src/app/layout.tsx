import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Allo — Inventory Reservation System',
  description:
    'Real-time inventory reservation platform for multi-warehouse retail and D2C brands. Reserve stock during checkout to prevent overselling.',
  keywords: ['inventory', 'reservation', 'warehouse', 'e-commerce', 'stock management'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="header">
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: '800',
                  color: 'white',
                }}
              >
                A
              </div>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Allo
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '10px', marginLeft: '4px' }}>
                Inventory
              </span>
            </a>
            <nav style={{ display: 'flex', gap: '8px' }}>
              <a href="/" className="btn btn-ghost" style={{ fontSize: '13px', padding: '8px 14px' }}>
                Products
              </a>
            </nav>
          </div>
        </header>
        <main
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '32px 24px',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
