import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

const COLORS = [
  '#f59e0b', '#fcd34d', '#10b981', '#34d399',
  '#3b82f6', '#93c5fd', '#8b5cf6', '#c4b5fd',
  '#ef4444', '#fca5a5', '#ec4899', '#f9a8d4',
];
const CONFETTI_COUNT = 90;

// Pre-compute confetti data once per page load for stable animation
const CONFETTI_DATA = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  color: COLORS[i % COLORS.length],
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2.5 + Math.random() * 2.5,
  size: 7 + Math.random() * 9,
  rotation: Math.random() * 360,
  isRect: i % 3 !== 0,
  swayAmount: 20 + Math.random() * 60,
  swayDirection: Math.random() > 0.5 ? 1 : -1,
}));

function formatCurrency(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealCelebration() {
  const { profile, isAuthenticated } = useAuth();
  const [celebration, setCelebration] = useState(null);
  const celebratedIds = useRef(new Set());
  const dismissTimer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(dismissTimer.current);
    setCelebration(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !profile?.organization_id) return;
    const orgId = profile.organization_id;

    const channel = supabase
      .channel(`deal-celebrations-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'engage_pipeline_deals',
          filter: `organization_id=eq.${orgId}`,
        },
        async (payload) => {
          const deal = payload.new;
          if (deal.stage !== 'closed_won') return;
          if (celebratedIds.current.has(deal.id)) return;
          celebratedIds.current.add(deal.id);

          let ownerName = null;
          if (deal.owner_id) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name, first_name, last_name')
              .eq('id', deal.owner_id)
              .single();
            if (data) {
              ownerName =
                data.full_name ||
                `${data.first_name || ''} ${data.last_name || ''}`.trim() ||
                null;
            }
          }

          setCelebration({ dealName: deal.deal_name, dealValue: deal.deal_value, ownerName });

          clearTimeout(dismissTimer.current);
          dismissTimer.current = setTimeout(() => setCelebration(null), 8000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(dismissTimer.current);
    };
  }, [isAuthenticated, profile?.organization_id]);

  if (!celebration) return null;

  const { dealName, dealValue, ownerName } = celebration;
  const formattedValue = formatCurrency(dealValue);

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes dealCardIn {
          0%   { transform: translate(-50%, -45%); opacity: 0; }
          60%  { transform: translate(-50%, -51%); }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes dealValueGlow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.85; }
        }
        @keyframes trophySpin {
          0%   { transform: scale(1) rotate(-5deg); }
          50%  { transform: scale(1.1) rotate(5deg); }
          100% { transform: scale(1) rotate(-5deg); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          cursor: 'pointer',
        }}
      >
        {/* Confetti layer */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {CONFETTI_DATA.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: -16,
                left: `${p.left}%`,
                width: p.size,
                height: p.isRect ? p.size * 0.55 : p.size,
                borderRadius: p.isRect ? 2 : '50%',
                backgroundColor: p.color,
                animation: `confettiFall ${p.duration}s ${p.delay}s linear forwards`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </div>

        {/* Celebration card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            animation: 'dealCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            background: 'linear-gradient(145deg, #0A0A0B 0%, #27272A 50%, #0A0A0B 100%)',
            border: '2px solid rgba(245, 158, 11, 0.5)',
            borderRadius: 28,
            padding: '52px 72px 44px',
            textAlign: 'center',
            minWidth: 460,
            maxWidth: '88vw',
            cursor: 'default',
            boxShadow: `
              0 0 0 1px rgba(245, 158, 11, 0.15),
              0 0 80px rgba(245, 158, 11, 0.25),
              0 40px 80px rgba(0, 0, 0, 0.6)
            `,
          }}
        >
          {/* Decorative stars */}
          <span style={{ position: 'absolute', top: 18, left: 22, fontSize: 20, opacity: 0.45 }}>⭐</span>
          <span style={{ position: 'absolute', top: 14, right: 20, fontSize: 24, opacity: 0.4 }}>✨</span>
          <span style={{ position: 'absolute', bottom: 48, right: 18, fontSize: 16, opacity: 0.3 }}>🎉</span>

          {/* Trophy */}
          <div style={{
            fontSize: 72,
            lineHeight: 1,
            marginBottom: 20,
            display: 'inline-block',
            animation: 'trophySpin 2s ease-in-out infinite',
          }}>
            🏆
          </div>

          {/* Badge */}
          <div style={{ marginBottom: 20 }}>
            <span style={{
              display: 'inline-block',
              background: 'linear-gradient(90deg, #d97706, #f59e0b, #fcd34d, #f59e0b, #d97706)',
              backgroundSize: '200% 100%',
              borderRadius: 999,
              padding: '5px 22px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: '#000',
              textTransform: 'uppercase',
            }}>
              Closed Won
            </span>
          </div>

          {/* Deal name */}
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#f8fafc',
            marginBottom: 10,
            lineHeight: 1.25,
            maxWidth: 380,
            margin: '0 auto 10px',
          }}>
            {dealName}
          </div>

          {/* Deal value */}
          {formattedValue && (
            <div style={{
              fontSize: 52,
              fontWeight: 900,
              background: 'linear-gradient(90deg, #f59e0b 0%, #fde68a 50%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.1,
              marginBottom: 20,
              animation: 'dealValueGlow 2s ease-in-out infinite',
            }}>
              {formattedValue}
            </div>
          )}

          {/* Owner */}
          {ownerName && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Closed by </span>
              <span style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700 }}>{ownerName}</span>
            </div>
          )}

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)',
            margin: '28px 0 18px',
          }} />

          {/* Dismiss hint */}
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, letterSpacing: '0.05em' }}>
            Click anywhere to dismiss
          </div>
        </div>
      </div>
    </>
  );
}
