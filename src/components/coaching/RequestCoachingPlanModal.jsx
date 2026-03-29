import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { buildLabel } from '../../constants/kpiGuidance';

function getMonday(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
const fmt = d => d.toISOString().split('T')[0];

export default function RequestCoachingPlanModal({ isOpen, onClose }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [avgScore, setAvgScore] = useState(null);
  const [scoreTrend, setScoreTrend] = useState(null); // 'up' | 'down' | 'flat'
  const [laggingKpis, setLaggingKpis] = useState([]);
  const [managerId, setManagerId] = useState(null);
  const [loading, setLoading] = useState(true);

  // On open: find team manager + fetch 5-week KPI trends
  useEffect(() => {
    if (!isOpen || !user?.id || !profile?.team_id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // 1. Find manager for this user's team
        const { data: mgrs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('team_id', profile.team_id)
          .eq('role', 'manager')
          .limit(1);
        if (cancelled) return;
        if (mgrs?.length > 0) {
          setManagerId(mgrs[0].id);
        }

        // 2. Fetch KPI metrics
        const { data: metrics } = await supabase
          .from('kpi_metrics')
          .select('id, key, goal, weight, direction')
          .eq('is_active', true)
          .eq('show_on_scorecard', true);

        if (!metrics?.length || cancelled) { if (!cancelled) setLoading(false); return; }

        // 3. Compute 5-week date range (last 5 completed weeks)
        const now = new Date();
        const thisMonday = getMonday(now);
        const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000); // last completed week
        const rangeStart = new Date(anchorMonday.getTime() - 4 * 7 * 86400000); // 5 weeks back
        const rangeEnd = new Date(anchorMonday.getTime() + 6 * 86400000); // last completed Sunday

        // 4. Fetch all KPI values for 5-week window in one query
        const kpiIds = metrics.map(m => m.id);
        const { data: vals } = await supabase
          .from('kpi_values')
          .select('kpi_id, value, period_start')
          .eq('profile_id', user.id)
          .in('kpi_id', kpiIds)
          .gte('period_start', fmt(rangeStart))
          .lte('period_start', fmt(rangeEnd));
        if (cancelled) return;

        // 5. Bucket values by week
        const weekScores = []; // array of per-week weighted scores
        const kpiWeeklyPcts = {}; // { kpiKey: [pct per week] }
        metrics.forEach(m => { kpiWeeklyPcts[m.key] = []; });

        for (let w = 4; w >= 0; w--) {
          const wMonday = new Date(anchorMonday.getTime() - w * 7 * 86400000);
          const wSunday = new Date(wMonday.getTime() + 6 * 86400000);
          const wStart = fmt(wMonday);
          const wEnd = fmt(wSunday);

          // Sum values for this week
          const sums = {};
          (vals || []).forEach(v => {
            if (v.period_start >= wStart && v.period_start <= wEnd) {
              sums[v.kpi_id] = (sums[v.kpi_id] || 0) + (v.value || 0);
            }
          });

          let totalWPct = 0, totalW = 0;
          metrics.forEach(m => {
            const dir = m.direction || 'higher';
            const val = sums[m.id] || 0;
            const pct = m.goal > 0
              ? Math.round(dir === 'lower' ? (val > 0 ? Math.min((m.goal / val) * 100, 200) : 200) : (val / m.goal) * 100)
              : 0;
            totalWPct += pct * (m.weight || 0);
            totalW += m.weight || 0;
            kpiWeeklyPcts[m.key].push(pct);
          });

          weekScores.push(totalW > 0 ? Math.round(totalWPct / totalW) : 0);
        }

        // 6. Compute 5-week average score
        const avg = Math.round(weekScores.reduce((s, v) => s + v, 0) / weekScores.length);
        setAvgScore(avg);

        // 7. Determine trend (compare last 2 weeks vs first 2 weeks)
        const recentAvg = (weekScores[3] + weekScores[4]) / 2;
        const earlyAvg = (weekScores[0] + weekScores[1]) / 2;
        const delta = recentAvg - earlyAvg;
        setScoreTrend(delta > 5 ? 'up' : delta < -5 ? 'down' : 'flat');

        // 8. Find consistently lagging KPIs (avg below 80% over 5 weeks)
        const lagging = [];
        metrics.forEach(m => {
          const pcts = kpiWeeklyPcts[m.key];
          const kpiAvg = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
          if (kpiAvg < 80) {
            const recentPct = pcts[pcts.length - 1];
            const earlyPct = pcts[0];
            const kpiTrend = recentPct - earlyPct > 5 ? 'up' : recentPct - earlyPct < -5 ? 'down' : 'flat';
            lagging.push({ key: m.key, label: buildLabel(m.key), pct: kpiAvg, trend: kpiTrend });
          }
        });

        setLaggingKpis(lagging.sort((a, b) => a.pct - b.pct).slice(0, 5));
      } catch (err) {
        console.error('Request modal load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isOpen, user?.id, profile?.team_id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('coaching_plan_requests')
        .insert({
          organization_id: profile.organization_id,
          requested_by: user.id,
          manager_id: managerId,
          message: message.trim() || null,
          current_score: avgScore,
          lagging_kpis: laggingKpis,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification to manager
      await supabase.rpc('create_notification', {
        p_profile_id: managerId,
        p_type: 'coaching_suggestion',
        p_title: `${profile.first_name} ${profile.last_name} requested a coaching plan`,
        p_message: message.trim() || 'A team member has requested coaching support.',
        p_action_url: '/coaching-plans',
        p_dedupe_key: `plan_request_${data.id}`,
      });

      toast.success('Coaching plan request sent to your manager!');
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Request submit error:', err);
      toast.error('Failed to send request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Request Coaching Plan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Your manager will be notified and can create a personalized plan for you.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* 5-week performance snapshot */}
              {avgScore !== null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">5-Week Avg Score</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${avgScore >= 80 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {avgScore}%
                      </span>
                      {scoreTrend === 'up' && <TrendingUp size={14} className="text-emerald-500" />}
                      {scoreTrend === 'down' && <TrendingDown size={14} className="text-red-500" />}
                      {scoreTrend === 'flat' && <Minus size={14} className="text-gray-400" />}
                    </div>
                  </div>
                  {laggingKpis.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium text-gray-500 uppercase">Consistently below target (5-week avg)</span>
                      <div className="space-y-1">
                        {laggingKpis.map(k => (
                          <div key={k.key} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-red-50 border border-red-100">
                            <span className="text-red-700 font-medium">{k.label}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-red-600 font-semibold">{k.pct}%</span>
                              {k.trend === 'up' && <TrendingUp size={10} className="text-emerald-500" />}
                              {k.trend === 'down' && <TrendingDown size={10} className="text-red-500" />}
                              {k.trend === 'flat' && <Minus size={10} className="text-gray-400" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Optional message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Let your manager know what areas you'd like to focus on..."
                />
              </div>

              {!managerId && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  No manager found for your team. The request will be visible to admins.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
