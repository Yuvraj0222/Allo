'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductCard from '@/components/ProductCard';
import { ToastProvider } from '@/components/ToastProvider';
import type { ProductWithStock } from '@/lib/validators';

function ProductListingContent() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          <div className="skeleton" style={{ width: '300px', height: '36px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '500px', height: '18px' }} />
        </div>
        <div className="product-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: '380px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Failed to Load Products</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => { setLoading(true); setError(null); fetchProducts(); }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Hero section */}
      <div style={{ marginBottom: '36px' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            marginBottom: '8px',
          }}
        >
          Product <span className="gradient-text">Inventory</span>
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '600px' }}>
          Browse products and reserve stock across our warehouse network. Reservations hold for 10 minutes during checkout.
        </p>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginTop: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800' }}>{products.length}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Products</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800' }}>
              {new Set(products.flatMap((p) => p.stocks.map((s) => s.warehouseId))).size}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Warehouses</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800' }}>
              {products.reduce((sum, p) => sum + p.stocks.reduce((s, st) => s + st.availableUnits, 0), 0).toLocaleString()}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Units Available</span>
          </div>
        </div>
      </div>

      {/* Product grid */}
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>No Products Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Run the seed script to populate the database.</p>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <ToastProvider>
      <ProductListingContent />
    </ToastProvider>
  );
}
