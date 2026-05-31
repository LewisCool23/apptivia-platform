import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Eye, RefreshCw, Sparkles, ChevronDown, ChevronRight, Clock, Loader2, Search, User, Briefcase, Building2, Target, MessageSquare, Phone, Mail, Linkedin, ExternalLink, AlertCircle, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { engageApi, engageDb } from '../utils/engageApi';
import { useAuth } from '../AuthContext';
import { useModalBehavior } from '../hooks/useModalBehavior';

const FRESHNESS = (date) => {
  if (!date) return { label: 'Not researched', color: 'bg-apptivia-carbon-100 text-apptivia-carbon-500' };
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 3) return { label: `Researched ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`}`, color: 'bg-emerald-50 text-emerald-700' };
  if (days <= 7) return { label: `Researched ${days}d ago`, color: 'bg-amber-50 text-amber-700' };
  return { label: `Researched ${days}d ago (stale)`, color: 'bg-apptivia-carbon-100 text-apptivia-carbon-500' };
};

function CollapsibleSection({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-apptivia-ink hover:bg-apptivia-paper/50 transition-colors">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-4 pb-3 border-t border-apptivia-carbon-50">{children}</div>}
    </div>
  );
}

export default function SavedBriefModal({ isOpen, onClose, prospect, organizationId, onResearchComplete }) {
  useModalBehavior(isOpen, onClose);
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState(null);
  const [briefSaved, setBriefSaved] = useState(false);
  const autoTriggeredRef = useRef(false);

  const prospectName = useMemo(() => {
    if (!prospect) return 'Unknown';
    return prospect.full_name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || prospect.email || 'Unknown';
  }, [prospect]);

  const lookupCachedReport = useCallback(async () => {
    if (!prospect || !organizationId) return;
    setLoading(true);
    setError(null);
    try {
      // Try by subject_name match (case-insensitive)
      const { data } = await supabase
        .from('engage_research_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('report_type', 'prospect')
        .order('created_at', { ascending: false })
        .limit(50);

      const name = prospectName.toLowerCase();
      const email = (prospect.email || '').toLowerCase();

      const match = (data || []).find(r => {
        // Primary: match by prospect_id if available
        if (prospect.id && r.prospect_id === prospect.id) return true;
        // Secondary: match by email
        const contentEmail = (r.content?.prospect?.email || r.content?.email || '').toLowerCase();
        if (email && contentEmail && contentEmail === email) return true;
        // Tertiary: match by subject name
        const sn = (r.subject_name || '').toLowerCase();
        return sn && (sn === name || sn.includes(name) || name.includes(sn));
      });

      setReport(match || null);
      setBriefSaved(match?.saved_by_user || false);
    } catch (err) {
      console.error('Failed to load cached report:', err);
    } finally {
      setLoading(false);
    }
  }, [prospect, organizationId, prospectName]);

  useEffect(() => {
    if (isOpen && prospect) {
      autoTriggeredRef.current = false;
      setBriefSaved(false);
      lookupCachedReport();
    }
    if (!isOpen) {
      setReport(null);
      setError(null);
      autoTriggeredRef.current = false;
    }
  }, [isOpen, prospect, lookupCachedReport]);

  // Auto-trigger research once when no cached brief exists
  useEffect(() => {
    if (isOpen && !loading && !report && !researching && !error && prospect && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      handleResearch();
    }
  }, [isOpen, loading, report, researching, error, prospect]);

  const handleResearch = async () => {
    if (!prospect) return;
    setResearching(true);
    setError(null);
    try {
      const identifier = {};
      if (prospect.email) identifier.email = prospect.email;
      if (prospect.first_name) identifier.first_name = prospect.first_name;
      if (prospect.last_name) identifier.last_name = prospect.last_name;
      if (prospect.company_name) identifier.company_name = prospect.company_name;
      if (prospect.linkedin_url) identifier.linkedin_url = prospect.linkedin_url;

      const result = await engageApi.researchProspect(identifier);
      if (!result?.ok) throw new Error('Research failed');

      // Save the report
      await engageDb.saveReport({
        organization_id: organizationId,
        report_type: 'prospect',
        prospect_id: prospect.id || undefined,
        title: `Prospect Brief: ${prospectName}`,
        subject_name: prospectName,
        content: { prospect: result.prospect, brief: result.brief, data_sources: result.data_sources, tokens_used: result.tokens_used },
        data_sources: result.data_sources || [],
        tokens_used: result.tokens_used || 0,
        model_used: 'claude-sonnet-4',
        created_by: user?.id,
      });

      // Write enrichment data back to the prospect row
      if (prospect.id) {
        const prospectUpdates = { last_researched_at: new Date().toISOString() };
        // Fit score from AI brief
        if (result.brief?.fit_score) prospectUpdates.fit_score = result.brief.fit_score;
        // Enrichment fields from person data
        const person = result.prospect || {};
        if (person.department) prospectUpdates.department = person.department;
        if (person.tenure_months) prospectUpdates.tenure_months = person.tenure_months;
        // Derive influence score from seniority
        const seniorityMap = { c_suite: 95, vp: 85, director: 70, manager: 55, senior: 40, entry: 20 };
        const sen = (person.seniority || person.seniority_level || '').toLowerCase();
        if (seniorityMap[sen]) prospectUpdates.influence_score = seniorityMap[sen];
        await supabase.from('engage_prospects').update(prospectUpdates).eq('id', prospect.id);
      }

      // Reload the cached report
      await lookupCachedReport();
      onResearchComplete?.();
    } catch (err) {
      setError(err.message || 'Research failed');
    } finally {
      setResearching(false);
    }
  };

  if (!isOpen) return null;

  const brief = report?.content?.brief || null;
  const prospectData = report?.content?.prospect || null;
  const dataSources = report?.content?.data_sources || report?.data_sources || [];
  const tokensUsed = report?.content?.tokens_used || report?.tokens_used || 0;
  const freshness = FRESHNESS(report?.created_at);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-apptivia-paper w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-apptivia-coral to-apptivia-coral/80 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Eye size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Prospect Brief</h2>
              <p className="text-white/70 text-xs">{prospectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={handleResearch}
                disabled={researching}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={researching ? 'animate-spin' : ''} />
                Refresh
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Freshness + data source badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${freshness.color}`}>
              <Clock size={9} className="inline mr-1" />
              {freshness.label}
            </span>
            {dataSources.map(ds => (
              <span key={ds} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-apptivia-ink/5 text-apptivia-ink capitalize">{ds}</span>
            ))}
            {tokensUsed > 0 && (
              <span className="text-[10px] text-apptivia-carbon-400">{tokensUsed.toLocaleString()} tokens</span>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-apptivia-coral mr-2" />
              <span className="text-sm text-apptivia-carbon-500">Loading cached research...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* No cached report — show CTA */}
          {!loading && !report && !researching && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-apptivia-coral-tone-50 rounded-full flex items-center justify-center mb-4">
                <Search size={28} className="text-apptivia-coral" />
              </div>
              <h3 className="text-base font-semibold text-apptivia-ink mb-1">No research on file</h3>
              <p className="text-xs text-apptivia-carbon-500 mb-4 max-w-sm">
                Research {prospectName} to get an AI-generated prospect brief with professional background, talking points, and outreach recommendations.
              </p>
              <button
                onClick={handleResearch}
                className="flex items-center gap-2 px-5 py-2.5 bg-apptivia-coral hover:bg-apptivia-coral/90 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                <Sparkles size={14} />
                Research this contact
              </button>
            </div>
          )}

          {/* Researching state */}
          {researching && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 size={32} className="animate-spin text-apptivia-coral mb-3" />
              <h3 className="text-sm font-semibold text-apptivia-ink mb-1">Researching {prospectName}...</h3>
              <p className="text-xs text-apptivia-carbon-500">Enriching via Apollo, searching the web, generating AI brief</p>
            </div>
          )}

          {/* Cached brief display */}
          {!loading && report && brief && !researching && (
            <>
              {/* Prospect header card */}
              {prospectData && (
                <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-apptivia-ink rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-apptivia-ink text-sm">{prospectData.name || prospectName}</div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {(prospectData.title || prospect.title) && (
                          <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                            <Briefcase size={10} /> {prospectData.title || prospect.title}
                          </span>
                        )}
                        {(prospectData.organization?.name || prospect.company_name) && (
                          <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                            <Building2 size={10} /> {prospectData.organization?.name || prospect.company_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {(prospectData.email || prospect.email) && (
                          <span className="text-[10px] text-apptivia-coral bg-apptivia-coral-tone-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Mail size={9} /> {prospectData.email || prospect.email}
                          </span>
                        )}
                        {prospectData.linkedin_url && (
                          <a href={prospectData.linkedin_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-blue-100">
                            <Linkedin size={9} /> LinkedIn <ExternalLink size={7} />
                          </a>
                        )}
                      </div>
                    </div>
                    {brief.fit_score != null && (
                      <div className="flex flex-col items-center">
                        <div className={`text-lg font-bold ${brief.fit_score >= 70 ? 'text-emerald-600' : brief.fit_score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                          {brief.fit_score}
                        </div>
                        <span className="text-[9px] text-apptivia-carbon-400 uppercase tracking-wider">Fit</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              {brief.summary && (
                <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-apptivia-coral" />
                    <span className="text-xs font-semibold text-apptivia-ink">Summary</span>
                  </div>
                  <p className="text-xs text-apptivia-carbon-600 leading-relaxed">{brief.summary}</p>
                </div>
              )}

              {/* Professional Background */}
              {brief.professional_background && (
                <CollapsibleSection title="Professional Background" icon={<Briefcase size={12} className="text-apptivia-coral" />} defaultOpen>
                  <p className="text-xs text-apptivia-carbon-600 leading-relaxed mt-2">{brief.professional_background}</p>
                </CollapsibleSection>
              )}

              {/* Recent Activity */}
              {brief.recent_activity?.length > 0 && (
                <CollapsibleSection title={`Recent Activity (${brief.recent_activity.length})`} icon={<Clock size={12} className="text-amber-500" />}>
                  <ul className="mt-2 space-y-1">
                    {brief.recent_activity.map((a, i) => (
                      <li key={i} className="text-xs text-apptivia-carbon-600 flex items-start gap-2">
                        <span className="text-apptivia-carbon-300 mt-0.5">•</span>{a}
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}

              {/* Talking Points */}
              {brief.talking_points?.length > 0 && (
                <CollapsibleSection title={`Talking Points (${brief.talking_points.length})`} icon={<MessageSquare size={12} className="text-emerald-500" />} defaultOpen>
                  <ul className="mt-2 space-y-1">
                    {brief.talking_points.map((tp, i) => (
                      <li key={i} className="text-xs text-apptivia-carbon-600 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">•</span>{tp}
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}

              {/* Outreach Angles */}
              {brief.outreach_angles?.length > 0 && (
                <CollapsibleSection title={`Outreach Angles (${brief.outreach_angles.length})`} icon={<Target size={12} className="text-apptivia-coral" />} defaultOpen>
                  <ul className="mt-2 space-y-1">
                    {brief.outreach_angles.map((oa, i) => (
                      <li key={i} className="text-xs text-apptivia-carbon-600 flex items-start gap-2">
                        <span className="text-apptivia-coral mt-0.5">•</span>{oa}
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}

              {/* Best Channel + Time */}
              {(brief.best_channel || brief.best_time_to_reach) && (
                <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
                  <div className="flex items-center gap-4">
                    {brief.best_channel && (
                      <div>
                        <span className="text-[10px] text-apptivia-carbon-400 uppercase tracking-wider">Best Channel</span>
                        <div className="text-xs font-semibold text-apptivia-ink capitalize mt-0.5">{brief.best_channel}</div>
                      </div>
                    )}
                    {brief.best_time_to_reach && (
                      <div>
                        <span className="text-[10px] text-apptivia-carbon-400 uppercase tracking-wider">Best Time</span>
                        <div className="text-xs font-semibold text-apptivia-ink mt-0.5">{brief.best_time_to_reach}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fit Reasoning */}
              {brief.fit_reasoning && (
                <CollapsibleSection title="Fit Analysis" icon={<Target size={12} className="text-apptivia-coral" />}>
                  <p className="text-xs text-apptivia-carbon-600 leading-relaxed mt-2">{brief.fit_reasoning}</p>
                </CollapsibleSection>
              )}

              {/* Shared Connections */}
              {brief.shared_connections && (
                <CollapsibleSection title="Shared Connections" icon={<User size={12} className="text-blue-500" />}>
                  <p className="text-xs text-apptivia-carbon-600 leading-relaxed mt-2">{brief.shared_connections}</p>
                </CollapsibleSection>
              )}
            </>
          )}
        </div>

        {/* Footer — Save / Refresh actions when brief is displayed */}
        {!loading && report && brief && !researching && (
          <div className="px-6 py-3 border-t border-apptivia-carbon-100 flex items-center justify-between flex-shrink-0 bg-white">
            <div className="text-[10px] text-apptivia-carbon-400">
              {briefSaved ? (
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={10} /> Saved{report?.saved_at ? ` ${new Date(report.saved_at).toLocaleDateString()}` : ''}</span>
              ) : (
                <span>Brief auto-saved on research</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!report?.id) return;
                  const { error } = await supabase.from('engage_research_reports')
                    .update({ saved_by_user: true, saved_at: new Date().toISOString() })
                    .eq('id', report.id);
                  if (error) { toast.error('Failed to save brief'); return; }
                  setBriefSaved(true);
                  setReport(prev => prev ? { ...prev, saved_by_user: true, saved_at: new Date().toISOString() } : prev);
                  toast.success('Brief saved');
                }}
                disabled={briefSaved}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${briefSaved ? 'text-apptivia-carbon-400 bg-apptivia-carbon-100 cursor-not-allowed' : 'text-apptivia-ink bg-apptivia-paper border border-apptivia-carbon-200 hover:bg-apptivia-carbon-100'}`}
              >
                <Save size={12} /> {briefSaved ? 'Saved' : 'Save Brief'}
              </button>
              <button
                onClick={() => { autoTriggeredRef.current = false; handleResearch(); }}
                disabled={researching}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={researching ? 'animate-spin' : ''} /> Refresh Brief
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
