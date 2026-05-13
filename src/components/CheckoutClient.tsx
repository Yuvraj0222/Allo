'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import type { ReservationInfo } from '@/lib/validators';

interface CheckoutClientProps {
  reservation: ReservationInfo;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function CheckoutClient({ reservation: initialReservation }: CheckoutClientProps) {
  const [reservation, setReservation] = useState(initialReservation);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  // Calculate time left
  useEffect(() => {
    if (reservation.status !== 'PENDING') return;

    const updateTimer = () => {
      const remaining = new Date(reservation.expiresAt).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [reservation.expiresAt, reservation.status]);

  // Auto-expire on client side
  useEffect(() => {
    if (timeLeft === 0 && reservation.status === 'PENDING') {
      setReservation((prev) => ({ ...prev, status: 'EXPIRED' }));
      showToast('error', 'Reservation has expired. Stock has been released.');
    }
  }, [timeLeft, reservation.status, showToast]);

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': `confirm-${reservation.id}-${Date.now()}`,
        },
      });

      const data = await res.json();

      if (res.status === 410) {
        setReservation((prev) => ({ ...prev, status: 'EXPIRED' }));
        showToast('error', `⏰ ${data.message || 'Reservation has expired'}`);
        return;
      }

      if (res.status === 409) {
        showToast('error', `⚠️ ${data.message || 'Reservation conflict'}`);
        return;
      }

      if (!res.ok) {
        showToast('error', data.message || 'Failed to confirm reservation');
        return;
      }

      setReservation(data);
      showToast('success', '✅ Purchase confirmed! Stock has been permanently allocated.');
    } catch {
      showToast('error', 'Network error. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  }, [reservation.id, showToast]);

  const handleRelease = useCallback(async () => {
    setIsReleasing(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        showToast('error', data.message || 'Failed to cancel reservation');
        return;
      }

      setReservation(data);
      showToast('info', 'Reservation cancelled. Stock has been released.');
    } catch {
      showToast('error', 'Network error. Please try again.');
    } finally {
      setIsReleasing(false);
    }
  }, [reservation.id, showToast]);

  const isUrgent = timeLeft > 0 && timeLeft < 120000; // less than 2 minutes
  const isPending = reservation.status === 'PENDING' && timeLeft > 0;

  const statusConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    PENDING: { icon: '⏳', label: 'Pending Payment', color: 'var(--warning)', bg: 'var(--warning-bg)' },
    CONFIRMED: { icon: '✅', label: 'Confirmed', color: 'var(--success)', bg: 'var(--success-bg)' },
    RELEASED: { icon: '↩️', label: 'Cancelled', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' },
    EXPIRED: { icon: '⏰', label: 'Expired', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  };

  const status = statusConfig[reservation.status] || statusConfig.PENDING;

  return (
    <div className="page-enter" style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Status header */}
      <div
        className={reservation.status === 'CONFIRMED' ? 'status-confirmed' : reservation.status === 'RELEASED' ? 'status-released' : ''}
        style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>{status.icon}</div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          {reservation.status === 'CONFIRMED'
            ? 'Purchase Confirmed!'
            : reservation.status === 'RELEASED'
            ? 'Reservation Cancelled'
            : reservation.status === 'EXPIRED'
            ? 'Reservation Expired'
            : 'Complete Your Purchase'}
        </h1>
        <div
          className="badge"
          style={{
            background: status.bg,
            color: status.color,
            border: `1px solid ${status.color}33`,
            fontSize: '13px',
            padding: '6px 14px',
          }}
        >
          {status.label}
        </div>
      </div>

      {/* Countdown timer (only for pending) */}
      {isPending && (
        <div
          className="glass-card"
          style={{
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center',
            border: isUrgent ? '1px solid rgba(239,68,68,0.3)' : undefined,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Time Remaining
          </div>
          <div
            className={`countdown ${isUrgent ? 'countdown-urgent' : ''}`}
            style={{
              fontSize: '42px',
              fontWeight: '800',
              color: isUrgent ? 'var(--danger)' : 'var(--text-primary)',
              letterSpacing: '0.05em',
            }}
          >
            {formatCountdown(timeLeft)}
          </div>
          {isUrgent && (
            <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '6px' }}>
              ⚠️ Hurry! Your reservation is about to expire
            </div>
          )}
        </div>
      )}

      {/* Reservation details */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
          Reservation Details
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Product</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{reservation.product.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>SKU</span>
            <span style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'monospace' }}>{reservation.product.sku}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Category</span>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{reservation.product.category}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Warehouse</span>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{reservation.warehouse.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Location</span>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{reservation.warehouse.location}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Quantity</span>
            <span style={{ fontSize: '14px', fontWeight: '700' }}>{reservation.quantity} unit{reservation.quantity > 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Unit Price</span>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>₹{reservation.product.price.toLocaleString('en-IN')}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: '700' }}>Total</span>
            <span className="gradient-text" style={{ fontSize: '22px', fontWeight: '800' }}>
              ₹{(reservation.product.price * reservation.quantity).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Reservation ID */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reservation ID</span>
        <code style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {reservation.id}
        </code>
      </div>

      {/* Action buttons */}
      {isPending && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={handleRelease}
            disabled={isReleasing || isConfirming}
            id="cancel-reservation-btn"
          >
            {isReleasing ? 'Cancelling...' : '✕ Cancel'}
          </button>
          <button
            className="btn btn-success"
            style={{ flex: 2 }}
            onClick={handleConfirm}
            disabled={isConfirming || isReleasing}
            id="confirm-purchase-btn"
          >
            {isConfirming ? 'Confirming...' : '✓ Confirm Purchase'}
          </button>
        </div>
      )}

      {/* Back to products */}
      {!isPending && (
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => router.push('/')}
          id="back-to-products-btn"
        >
          ← Back to Products
        </button>
      )}
    </div>
  );
}
