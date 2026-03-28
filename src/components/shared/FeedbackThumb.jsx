import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../AuthContext';

/**
 * Minimal "Was this helpful?" feedback widget.
 * Inserts a row into feedback_signals on click and shows a brief confirmation.
 *
 * Props:
 *   featureArea  {string}  — e.g. 'coaching_opportunity', 'kpi_watchdog'
 *   contentKey   {string}  — optional identifier (KPI key, plan ID, etc.)
 *   context      {object}  — optional metadata for richer analytics
 */
export default function FeedbackThumb({ featureArea, contentKey, context }) {
  const { user, profile } = useAuth();
  const storageKey = `apptivia.feedback.${featureArea}.${contentKey || 'default'}`;
  const [voted, setVoted] = useState(() => {
    try { return !!localStorage.getItem(storageKey); } catch { return false; }
  });
  const [submitting, setSubmitting] = useState(false);

  const handleVote = async (helpful) => {
    if (voted || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('feedback_signals').insert({
        organization_id: profile?.organization_id || null,
        user_id: user?.id || null,
        feature_area: featureArea,
        content_key: contentKey || null,
        helpful,
        context: context || null,
      });
      try { localStorage.setItem(storageKey, '1'); } catch {}
      setVoted(true);
    } catch (e) {
      console.warn('Feedback signal failed:', e);
      setVoted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (voted) {
    return <span className="text-[10px] text-gray-400 italic">Thanks for the feedback!</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-400">
      <span>Helpful?</span>
      <button
        type="button"
        onClick={() => handleVote(true)}
        disabled={submitting}
        className="hover:text-emerald-600 transition-colors disabled:opacity-50 cursor-pointer"
        aria-label="Mark as helpful"
      >
        Yes
      </button>
      <span className="text-gray-300">|</span>
      <button
        type="button"
        onClick={() => handleVote(false)}
        disabled={submitting}
        className="hover:text-red-500 transition-colors disabled:opacity-50 cursor-pointer"
        aria-label="Mark as not helpful"
      >
        No
      </button>
    </span>
  );
}
