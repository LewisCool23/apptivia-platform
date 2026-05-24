import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ApptiviaLogo } from './ApptiviaLogo';

// ─── Confetti (same palette as DealCelebration) ──────────────────────────────
const COLORS = [
  '#FF4D2E', '#FF8A6B', '#F59E0B', '#16A34A', '#06B6D4',
  '#FF4D2E', '#71717A', '#FF8A6B', '#C8341B', '#F59E0B',
  '#FF4D2E', '#16A34A',
];
const CONFETTI_COUNT = 90;
const CONFETTI_DATA = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  color: COLORS[i % COLORS.length],
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2.5 + Math.random() * 2.5,
  size: 7 + Math.random() * 9,
  rotation: Math.random() * 360,
  isRect: i % 3 !== 0,
}));

// ─── Theme per celebration type ──────────────────────────────────────────────
const THEMES = {
  badge_earned: {
    border: 'rgba(59, 130, 246, 0.5)',
    glow: 'rgba(59, 130, 246, 0.25)',
    label: 'New Badge!',
    gradient: 'linear-gradient(90deg, #3B82F6, #60A5FA, #93C5FD, #60A5FA, #3B82F6)',
    divider: 'rgba(59, 130, 246, 0.3)',
    accent: '⭐',
  },
  rare_badge_earned: {
    border: 'rgba(255, 77, 46, 0.5)',
    glow: 'rgba(255, 77, 46, 0.25)',
    label: 'Rare Badge!',
    gradient: 'linear-gradient(90deg, #FF4D2E, #FF6B54, #FF8A75, #FF6B54, #FF4D2E)',
    divider: 'rgba(255, 77, 46, 0.3)',
    accent: '💎',
  },
  achievement_earned: {
    border: 'rgba(16, 185, 129, 0.5)',
    glow: 'rgba(16, 185, 129, 0.25)',
    label: 'Achievement Unlocked!',
    gradient: 'linear-gradient(90deg, #059669, #10B981, #34D399, #10B981, #059669)',
    divider: 'rgba(16, 185, 129, 0.3)',
    accent: '🌟',
  },
  contest_winner: {
    border: 'rgba(245, 158, 11, 0.5)',
    glow: 'rgba(245, 158, 11, 0.25)',
    label: 'Contest Winner!',
    gradient: 'linear-gradient(90deg, #d97706, #f59e0b, #fcd34d, #f59e0b, #d97706)',
    divider: 'rgba(245, 158, 11, 0.3)',
    accent: '🎉',
  },
  contest_2nd: {
    border: 'rgba(192, 192, 192, 0.5)',
    glow: 'rgba(192, 192, 192, 0.2)',
    label: '2nd Place!',
    gradient: 'linear-gradient(90deg, #6B7280, #9CA3AF, #D1D5DB, #9CA3AF, #6B7280)',
    divider: 'rgba(192, 192, 192, 0.3)',
    accent: '🎊',
  },
};

// ─── Message parsers ─────────────────────────────────────────────────────────
const extractQuoted = (msg) => {
  const m = msg?.match(/"([^"]+)"/);
  return m ? m[1] : null;
};
const extractPoints = (msg) => {
  const m = msg?.match(/\+(\d+)\s*pts/);
  return m ? `+${m[1]} pts` : null;
};
const extractSkillset = (msg) => {
  const m = msg?.match(/in\s+(.+?)\s+\(/);
  return m ? m[1] : null;
};
const extractReward = (msg) => {
  const m = msg?.match(/\s-\s(.+)$/);
  return m ? m[1] : null;
};

// ─── Content renderers ───────────────────────────────────────────────────────
function renderBadgeContent(c) {
  const name = extractQuoted(c.message) || c.title;
  const pts = extractPoints(c.message);
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#F7F5F2', marginBottom: pts ? 8 : 0, lineHeight: 1.25, maxWidth: 380, margin: '0 auto' }}>
        {name}
      </div>
      {pts && (
        <div style={{
          fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 12,
          background: 'linear-gradient(90deg, #3B82F6 0%, #93C5FD 50%, #3B82F6 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {pts}
        </div>
      )}
    </>
  );
}

function renderRareBadgeContent(c) {
  const name = extractQuoted(c.message) || c.title;
  const pts = extractPoints(c.message);
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#F7F5F2', lineHeight: 1.25, maxWidth: 380, margin: '0 auto' }}>
        {name}
      </div>
      {pts && (
        <div style={{
          fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 12,
          background: 'linear-gradient(90deg, #FF4D2E 0%, #FF8A75 50%, #FF4D2E 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {pts}
        </div>
      )}
    </>
  );
}

function renderAchievementContent(c) {
  const name = extractQuoted(c.message) || c.title;
  const skillset = extractSkillset(c.message);
  const pts = extractPoints(c.message);
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#F7F5F2', lineHeight: 1.25, maxWidth: 380, margin: '0 auto' }}>
        {name}
      </div>
      {skillset && (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          {skillset}
        </div>
      )}
      {pts && (
        <div style={{
          fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 12,
          background: 'linear-gradient(90deg, #10B981 0%, #34D399 50%, #10B981 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {pts}
        </div>
      )}
    </>
  );
}

function renderContestContent(c) {
  const name = extractQuoted(c.message) || c.title;
  const reward = extractReward(c.message);
  const isWinner = c.celebType === 'contest_winner';
  return (
    <>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#F7F5F2', lineHeight: 1.25, maxWidth: 380, margin: '0 auto' }}>
        {name}
      </div>
      {reward && (
        <div style={{
          fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 12,
          background: isWinner
            ? 'linear-gradient(90deg, #f59e0b 0%, #fde68a 50%, #f59e0b 100%)'
            : 'linear-gradient(90deg, #9CA3AF 0%, #D1D5DB 50%, #9CA3AF 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          {reward}
        </div>
      )}
    </>
  );
}

const CONTENT_RENDERERS = {
  badge_earned: renderBadgeContent,
  rare_badge_earned: renderRareBadgeContent,
  achievement_earned: renderAchievementContent,
  contest_winner: renderContestContent,
  contest_2nd: renderContestContent,
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CelebrationModal() {
  const [celebration, setCelebration] = useState(null);
  const celebratedIds = useRef(new Set());
  const dismissTimer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(dismissTimer.current);
    setCelebration(null);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (!data) return;
      const key = data.dedupe_key || data.id;
      if (celebratedIds.current.has(key)) return;
      celebratedIds.current.add(key);

      // Determine celebration type
      let celebType = data.type;
      if (data.type === 'contest_top_3') {
        // Only celebrate 2nd place, not 3rd
        if (data.title?.includes('2nd')) {
          celebType = 'contest_2nd';
        } else {
          return; // 3rd place — no celebration
        }
      }

      const theme = THEMES[celebType];
      if (!theme) return;

      setCelebration({ ...data, celebType, theme });
      clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setCelebration(null), 8000);
    };

    window.addEventListener('apptivia:celebration', handler);
    return () => {
      window.removeEventListener('apptivia:celebration', handler);
      clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!celebration) return null;

  const { celebType, theme } = celebration;
  const icon = celebration.icon || '🏆';
  const renderContent = CONTENT_RENDERERS[celebType];

  return (
    <>
      <style>{`
        @keyframes celebConfettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes celebCardIn {
          0%   { transform: translate(-50%, -45%); opacity: 0; }
          60%  { transform: translate(-50%, -51%); }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
        @keyframes celebIconSpin {
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
                animation: `celebConfettiFall ${p.duration}s ${p.delay}s linear forwards`,
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
            animation: 'celebCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            background: 'linear-gradient(145deg, #0A0A0B 0%, #27272A 50%, #0A0A0B 100%)',
            border: `2px solid ${theme.border}`,
            borderRadius: 28,
            padding: '44px 64px 40px',
            textAlign: 'center',
            minWidth: 420,
            maxWidth: '88vw',
            cursor: 'default',
            boxShadow: `
              0 0 0 1px ${theme.border.replace('0.5', '0.15')},
              0 0 80px ${theme.glow},
              0 40px 80px rgba(0, 0, 0, 0.6)
            `,
          }}
        >
          {/* Decorative accents */}
          <span style={{ position: 'absolute', top: 16, left: 20, fontSize: 18, opacity: 0.4 }}>{theme.accent}</span>
          <span style={{ position: 'absolute', top: 12, right: 18, fontSize: 22, opacity: 0.35 }}>✨</span>
          <span style={{ position: 'absolute', bottom: 44, right: 16, fontSize: 14, opacity: 0.25 }}>🎉</span>

          {/* Apptivia logo */}
          <div style={{ marginBottom: 20 }}>
            <ApptiviaLogo className="text-xl" dark />
          </div>

          {/* Icon */}
          <div style={{
            fontSize: 72,
            lineHeight: 1,
            marginBottom: 18,
            display: 'inline-block',
            animation: 'celebIconSpin 2s ease-in-out infinite',
          }}>
            {icon}
          </div>

          {/* Label pill */}
          <div style={{ marginBottom: 18 }}>
            <span style={{
              display: 'inline-block',
              background: theme.gradient,
              backgroundSize: '200% 100%',
              borderRadius: 999,
              padding: '5px 22px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: '#000',
              textTransform: 'uppercase',
            }}>
              {theme.label}
            </span>
          </div>

          {/* Type-specific content */}
          {renderContent && renderContent(celebration)}

          {/* Divider */}
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${theme.divider}, transparent)`,
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
