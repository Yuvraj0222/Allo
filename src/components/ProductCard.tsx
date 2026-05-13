'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastProvider';
import type { ProductWithStock, StockInfo } from '@/lib/validators';

interface ProductCardProps {
  product: ProductWithStock;
}

const categoryEmoji: Record<string, string> = {
  Electronics: '📱',
  Fashion: '👗',
  Home: '🏠',
  Sports: '⚽',
  Books: '📚',
  Beauty: '💄',
  Food: '🍕',
  Toys: '🧸',
  General: '📦',
};

function getStockLevel(available: number, total: number) {
  const ratio = total > 0 ? available / total : 0;
  if (ratio > 0.5) return { color: 'var(--success)', label: 'In Stock', class: 'badge-success' };
  if (ratio > 0.2) return { color: 'var(--warning)', label: 'Low Stock', class: 'badge-warning' };
  if (available > 0) return { color: 'var(--danger)', label: 'Very Low', class: 'badge-danger' };
  return { color: 'var(--text-muted)', label: 'Out of Stock', class: 'badge-neutral' };
}

export default function ProductCard({ product }: ProductCardProps) {
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isReserving, setIsReserving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const emoji = categoryEmoji[product.category] || '📦';
  const totalAvailable = product.stocks.reduce((sum, s) => sum + s.availableUnits, 0);

  const handleReserve = async () => {
    if (!selectedStock) return;
    setIsReserving(true);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `reserve-${product.id}-${selectedStock.warehouseId}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedStock.warehouseId,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        showToast('error', `⚠️ ${data.message || 'Not enough stock available'}`);
        return;
      }

      if (!res.ok) {
        showToast('error', data.message || 'Failed to create reservation');
        return;
      }

      showToast('success', `Reserved ${quantity} unit(s) of ${product.name}!`);
      setShowDialog(false);
      router.push(`/checkout/${data.id}`);
    } catch {
      showToast('error', 'Network error. Please try again.');
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <>
      <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        {/* Category badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <span className="badge badge-neutral">
            {emoji} {product.category}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: {product.sku}</span>
        </div>

        {/* Product info */}
        <h3
          style={{
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '6px',
            letterSpacing: '-0.01em',
          }}
        >
          {product.name}
        </h3>
        {product.description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
            {product.description}
          </p>
        )}

        {/* Price */}
        <div
          style={{
            fontSize: '24px',
            fontWeight: '800',
            marginBottom: '20px',
            letterSpacing: '-0.02em',
          }}
          className="gradient-text"
        >
          ₹{product.price.toLocaleString('en-IN')}
        </div>

        {/* Stock per warehouse */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Stock by Warehouse
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {product.stocks.map((stock) => {
              const level = getStockLevel(stock.availableUnits, stock.totalUnits);
              return (
                <div
                  key={stock.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{stock.warehouseName}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stock.warehouseLocation}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>{stock.availableUnits}</span>
                    <span className={`badge ${level.class}`} style={{ fontSize: '10px' }}>
                      {level.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reserve button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={totalAvailable === 0}
          onClick={() => {
            const firstAvailable = product.stocks.find((s) => s.availableUnits > 0);
            setSelectedStock(firstAvailable || null);
            setQuantity(1);
            setShowDialog(true);
          }}
          id={`reserve-btn-${product.id}`}
        >
          {totalAvailable > 0 ? '🛒 Reserve Stock' : 'Out of Stock'}
        </button>

        {/* Glow accent */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-50%',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'var(--accent-glow)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
            opacity: 0.3,
          }}
        />
      </div>

      {/* Reserve Dialog */}
      {showDialog && (
        <div className="modal-overlay" onClick={() => setShowDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
              Reserve Stock
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {product.name} — holds for 10 minutes
            </p>

            {/* Warehouse selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Warehouse
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {product.stocks
                  .filter((s) => s.availableUnits > 0)
                  .map((stock) => (
                    <label
                      key={stock.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${selectedStock?.id === stock.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        background: selectedStock?.id === stock.id ? 'var(--accent-glow)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="warehouse"
                        checked={selectedStock?.id === stock.id}
                        onChange={() => {
                          setSelectedStock(stock);
                          if (quantity > stock.availableUnits) setQuantity(stock.availableUnits);
                        }}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{stock.warehouseName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stock.warehouseLocation}</div>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>{stock.availableUnits} avail.</span>
                    </label>
                  ))}
              </div>
            </div>

            {/* Quantity selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Quantity
              </label>
              <div className="qty-selector">
                <button
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <div className="qty-value">{quantity}</div>
                <button
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.min(selectedStock?.availableUnits || 1, q + 1))}
                  disabled={quantity >= (selectedStock?.availableUnits || 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDialog(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleReserve}
                disabled={isReserving || !selectedStock}
                id="confirm-reserve-btn"
              >
                {isReserving ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    Reserving...
                  </>
                ) : (
                  `Reserve ${quantity} unit${quantity > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
