import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Building2, Users, Mail, Linkedin, Globe, Sparkles,
  RefreshCw, ExternalLink, ChevronDown, ChevronUp, Copy, Check,
  AlertTriangle, TrendingUp, Target, Briefcase, DollarSign,
  Star, Clock, Send, BookOpen, Trash2, History, Eye,
  Phone, UserPlus, Cpu, ArrowRight, ChevronRight, Bookmark, BookmarkCheck,
  MapPin, Twitter, PhoneCall, ClipboardList, X, FileText
} from 'lucide-react';
import { engageApi, engageDb } from '../utils/engageApi';
import PromptTemplateSelector from './PromptTemplateSelector';
import { supabase } from '../supabaseClient';

// ── Default titles/seniority are now resolved server-side via ICP profiles ───
// These are only used as client-side fallback for technology search mode
const DEFAULT_PEOPLE_TITLES = [
  'VP Sales', 'VP of Sales', 'Vice President of Sales',
  'Director of Sales', 'Director Sales', 'Head of Sales',
  'Sales Manager', 'Regional Sales Manager', 'Area Sales Manager',
  'CRO', 'Chief Revenue Officer',
  'VP Revenue Operations', 'Head of Revenue Operations', 'Director Revenue Operations',
  'VP Business Development', 'Director of Business Development', 'Head of Business Development',
  'Business Development Manager',
  'Account Executive', 'Senior Account Executive', 'Enterprise Account Executive',
  'SDR Manager', 'BDR Manager', 'Sales Development Manager',
  'Head of Sales Enablement', 'Director of Sales Enablement',
  'VP of Sales Operations', 'Director Sales Operations',
  'VP of Growth', 'Head of Growth',
];
const DEFAULT_PEOPLE_SENIORITY = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager', 'senior'];

const PERSONA_MODES = [
  { key: 'icp', label: 'ICP Personas', icon: 'Target', desc: 'Uses your configured job titles' },
  { key: 'leadership', label: 'Leadership', icon: 'Briefcase', desc: 'C-suite, VP, Director' },
  { key: 'all', label: 'All Contacts', icon: 'Users', desc: 'No title/seniority filter' },
  { key: 'custom', label: 'Custom', icon: 'ClipboardList', desc: 'Specify your own titles' },
];

// ── Helpers ──────────────────────────────────────────────────

function ScoreBadge({ score, label }) {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700' :
    score >= 60 ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' :
    score >= 40 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Star size={10} /> {score} {label && <span className="font-normal text-[10px] opacity-80">/ 100</span>}
    </span>
  );
}

function DataSourceBadges({ sources }) {
  const badges = {
    apollo: { label: 'Apollo', color: 'bg-apptivia-coral-tone-50 text-apptivia-coral' },
    tavily: { label: 'Tavily', color: 'bg-apptivia-carbon-100 text-apptivia-ink' },
    claude: { label: 'Claude AI', color: 'bg-orange-50 text-orange-600' },
    pdl: { label: 'PDL', color: 'bg-green-50 text-green-600' },
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">Sources:</span>
      {(sources || []).map((s) => {
        const b = badges[s] || { label: s, color: 'bg-apptivia-paper text-apptivia-carbon-500' };
        return <span key={s} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.color}`}>{b.label}</span>;
      })}
    </div>
  );
}

function TokensUsed({ tokens }) {
  if (!tokens) return null;
  return (
    <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-1">
      <Sparkles size={10} /> {tokens.toLocaleString()} tokens used
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors" title="Copy">
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

// ── Company Brief Panel ──────────────────────────────────────

function CompanyBriefPanel({ company, brief: rawBrief, dataSources, tokensUsed, errors }) {
  const [expanded, setExpanded] = useState({ findings: true, outreach: true, tech: false, news: false, funding: false, competitors: false, risks: false });
  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // If brief arrived as a JSON string, try to parse it
  const brief = React.useMemo(() => {
    if (!rawBrief) return null;
    if (typeof rawBrief === 'object') return rawBrief;
    try {
      const cleaned = String(rawBrief).replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { summary: String(rawBrief) };
    }
  }, [rawBrief]);

  // Fallback when research returned no usable data
  if (!company && !brief) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-yellow-600" />
          <span className="text-sm font-semibold text-yellow-700">Company research unavailable</span>
        </div>
        <p className="text-xs text-yellow-600 mb-2">Could not retrieve company data. Try searching by domain (e.g. drift.com) for better results.</p>
        {errors?.length > 0 && errors.map((e, i) => (
          <p key={i} className="text-[10px] text-yellow-500">{e.step}: {e.error}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Company Header */}
      {company && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
          <div className="flex items-start gap-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="w-12 h-12 rounded-lg border border-apptivia-carbon-100 object-contain" />
            ) : (
              <div className="w-12 h-12 bg-apptivia-ink rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-apptivia-ink">{company.name || company.domain}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {company.industry && (
                  <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                    <Briefcase size={10} /> {company.industry}
                  </span>
                )}
                {company.estimated_num_employees && (
                  <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                    <Users size={10} /> {company.estimated_num_employees.toLocaleString()} employees
                  </span>
                )}
                {(company.annual_revenue_printed || company.annual_revenue) && (
                  <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                    <DollarSign size={10} /> {company.annual_revenue_printed || company.annual_revenue}
                  </span>
                )}
                {company.website_url && (
                  <a href={company.website_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-apptivia-coral hover:text-apptivia-coral flex items-center gap-1">
                    <Globe size={10} /> Website <ExternalLink size={8} />
                  </a>
                )}
                {company.linkedin_url && (
                  <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-apptivia-coral hover:text-apptivia-coral flex items-center gap-1">
                    <Linkedin size={10} /> LinkedIn <ExternalLink size={8} />
                  </a>
                )}
              </div>
              {company.short_description && (
                <p className="text-xs text-apptivia-carbon-500 mt-2 leading-relaxed">{company.short_description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Brief */}
      {brief && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-white" />
              <span className="text-sm font-semibold text-white">AI Company Brief</span>
            </div>
            <div className="flex items-center gap-3">
              <TokensUsed tokens={tokensUsed} />
              <DataSourceBadges sources={dataSources} />
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Summary */}
            {brief.summary && (
              <div className="bg-apptivia-coral-tone-50/50 border border-apptivia-coral-tone-100 rounded-lg p-4">
                <p className="text-sm text-apptivia-ink leading-relaxed">{brief.summary}</p>
              </div>
            )}

            {/* ICP Fit */}
            {brief.icp_fit_score != null && (
              <div className="flex items-center gap-3 bg-apptivia-paper rounded-lg p-3">
                <span className="text-xs font-medium text-apptivia-carbon-500">ICP Fit:</span>
                <ScoreBadge score={brief.icp_fit_score} label />
                {brief.icp_reasoning && <span className="text-xs text-apptivia-carbon-500 flex-1">{brief.icp_reasoning}</span>}
              </div>
            )}

            {/* Collapsible sections */}
            {brief.key_findings?.length > 0 && (
              <CollapsibleSection title="Key Findings" icon={TrendingUp} expanded={expanded.findings} onToggle={() => toggle('findings')}>
                <ul className="space-y-1.5">
                  {brief.key_findings.map((f, i) => (
                    <li key={i} className="text-xs text-apptivia-carbon-700 flex items-start gap-2">
                      <span className="text-apptivia-coral mt-0.5">•</span> {f}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Outreach Strategy */}
            {(brief.talking_points?.length > 0 || brief.outreach_angles?.length > 0) && (
              <CollapsibleSection title="Outreach Strategy" icon={Target} expanded={expanded.outreach} onToggle={() => toggle('outreach')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {brief.talking_points?.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-apptivia-carbon-400 block mb-2">Talking Points</span>
                      <ul className="space-y-1.5">
                        {brief.talking_points.map((p, i) => (
                          <li key={i} className="text-xs text-apptivia-carbon-700 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5 flex-shrink-0">{'\u2713'}</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    {brief.outreach_angles?.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-apptivia-carbon-400 block mb-2">Approach Angles</span>
                        <ul className="space-y-1">
                          {brief.outreach_angles.slice(0, 3).map((a, i) => (
                            <li key={i} className="text-xs text-apptivia-carbon-700 flex items-start gap-2">
                              <span className="text-apptivia-coral mt-0.5 flex-shrink-0">{'\u2022'}</span> {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {brief.best_channel && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-medium text-apptivia-carbon-500">Best Channel:</span>
                        <span className="text-xs font-semibold text-apptivia-ink capitalize">{brief.best_channel}</span>
                      </div>
                    )}
                    {brief.best_time_to_reach && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-apptivia-carbon-500">Best Timing:</span>
                        <span className="text-xs font-semibold text-apptivia-ink">{brief.best_time_to_reach}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {brief.tech_stack?.length > 0 && (
              <CollapsibleSection title="Tech Stack" icon={Briefcase} expanded={expanded.tech} onToggle={() => toggle('tech')}>
                <div className="flex flex-wrap gap-1.5">
                  {brief.tech_stack.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-medium rounded-full">{t}</span>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {brief.competitors?.length > 0 && (
              <CollapsibleSection title="Competitors" icon={Target} expanded={expanded.competitors} onToggle={() => toggle('competitors')}>
                <div className="flex flex-wrap gap-1.5">
                  {brief.competitors.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-full">{c}</span>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {brief.recent_news?.length > 0 && (
              <CollapsibleSection title="Recent News" icon={Globe} expanded={expanded.news} onToggle={() => toggle('news')}>
                <ul className="space-y-2">
                  {brief.recent_news.map((n, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium text-apptivia-ink">{n.headline}</span>
                      {n.date && <span className="text-apptivia-carbon-400 ml-2">{n.date}</span>}
                      {n.url && (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-apptivia-coral ml-2 hover:underline">
                          Source <ExternalLink size={8} className="inline" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {brief.funding_history?.length > 0 && (
              <CollapsibleSection title="Funding History" icon={DollarSign} expanded={expanded.funding} onToggle={() => toggle('funding')}>
                <div className="space-y-2">
                  {brief.funding_history.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-apptivia-ink">{f.round}</span>
                      <span className="text-emerald-600 font-medium">{f.amount}</span>
                      {f.date && <span className="text-apptivia-carbon-400">{f.date}</span>}
                      {f.investors?.length > 0 && <span className="text-apptivia-carbon-500">— {f.investors.join(', ')}</span>}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {brief.risk_factors?.length > 0 && (
              <CollapsibleSection title="Risk Factors" icon={AlertTriangle} expanded={expanded.risks} onToggle={() => toggle('risks')}>
                <ul className="space-y-1.5">
                  {brief.risk_factors.map((r, i) => (
                    <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                      <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </div>
        </div>
      )}

      {/* Errors */}
      {errors?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700">Partial Results — Some data sources had issues</span>
          </div>
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-yellow-600">{e.step}: {e.error}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Prospect Brief Panel ─────────────────────────────────────

function ProspectBriefPanel({ prospect, brief: rawBrief, dataSources, tokensUsed, errors, onCallContact, onSaveContact, isSaved, savingContact, onGenerateDraft }) {
  const [copied, setCopied] = React.useState(null); // tracks which field was copied
  // If brief arrived as a JSON string (e.g. Claude wrapped in markdown fences), try to parse it
  const brief = React.useMemo(() => {
    if (!rawBrief) return null;
    if (typeof rawBrief === 'object') return rawBrief;
    // It's a string — try to extract JSON from it
    try {
      const cleaned = String(rawBrief).replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { summary: String(rawBrief) };
    }
  }, [rawBrief]);

  const copyField = (field, value) => {
    navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const prospectName = prospect?.name || prospect?.full_name || `${prospect?.first_name || ''} ${prospect?.last_name || ''}`.trim() || 'Unknown';
  const phone = prospect?.sanitized_phone || prospect?.phone_number || prospect?.phone || prospect?.mobile_phone || prospect?.phone_numbers?.[0]?.sanitized_number || prospect?.phone_numbers?.[0]?.raw_number || '';
  const location = prospect ? [prospect.city, prospect.state, prospect.country].filter(Boolean).join(', ') : '';
  const companyWebsite = prospect?.organization?.website_url || prospect?.organization?.primary_domain || '';
  const twitterUrl = prospect?.twitter_url || '';

  const handleCopyAll = () => {
    const lines = [prospectName];
    if (prospect?.title) lines.push(prospect.title);
    if (prospect?.organization?.name || prospect?.company_name) lines.push(prospect.organization?.name || prospect.company_name);
    if (prospect?.email) lines.push(`Email: ${prospect.email}`);
    if (phone) lines.push(`Phone: ${phone}`);
    if (prospect?.linkedin_url) lines.push(`LinkedIn: ${prospect.linkedin_url}`);
    if (location) lines.push(`Location: ${location}`);
    copyField('all', lines.join('\n'));
  };

  return (
    <div className="space-y-4">
      {/* Prospect Header */}
      {prospect && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
          <div className="flex items-start gap-4">
            {prospect.photo_url || prospect.avatar_url ? (
              <img src={prospect.photo_url || prospect.avatar_url} alt="" className="w-14 h-14 rounded-full border-2 border-apptivia-carbon-100 object-cover" />
            ) : (
              <div className="w-14 h-14 bg-apptivia-ink rounded-full flex items-center justify-center">
                <Users size={22} className="text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-apptivia-ink">{prospectName}</h3>
                {prospect.seniority && (
                  <span className="text-[10px] text-apptivia-ink bg-apptivia-carbon-100 px-2 py-0.5 rounded-full font-medium capitalize">{prospect.seniority}</span>
                )}
              </div>

              {/* Row 1: Title + Company */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {prospect.title && (
                  <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                    <Briefcase size={10} /> {prospect.title}
                  </span>
                )}
                {(prospect.organization?.name || prospect.company_name) && (
                  <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                    <Building2 size={10} /> {prospect.organization?.name || prospect.company_name}
                  </span>
                )}
                {location && (
                  <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                    <MapPin size={10} /> {location}
                  </span>
                )}
              </div>

              {/* Row 2: Contact info with copy buttons */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {prospect.email ? (
                  <button
                    onClick={() => copyField('email', prospect.email)}
                    className="group/email text-xs text-apptivia-coral hover:text-apptivia-coral flex items-center gap-1 bg-apptivia-coral-tone-50 hover:bg-apptivia-coral-tone-50 px-2 py-1 rounded-lg transition-colors"
                    title={`Copy: ${prospect.email}`}
                  >
                    <Mail size={10} />
                    <span className="max-w-[180px] truncate">{prospect.email}</span>
                    {copied === 'email' ? <Check size={9} className="text-emerald-500" /> : <Copy size={9} className="opacity-50 group-hover/email:opacity-100" />}
                  </button>
                ) : (
                  <span className="text-xs text-apptivia-carbon-400 flex items-center gap-1 bg-apptivia-paper px-2 py-1 rounded-lg">
                    <Mail size={10} /> Email not available
                  </span>
                )}
                {phone ? (
                  <button
                    onClick={() => copyField('phone', phone)}
                    className="group/phone text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors"
                    title={`Copy: ${phone}`}
                  >
                    <Phone size={10} />
                    <span>{phone}</span>
                    {copied === 'phone' ? <Check size={9} className="text-emerald-500" /> : <Copy size={9} className="opacity-50 group-hover/phone:opacity-100" />}
                  </button>
                ) : (
                  <span className="text-xs text-apptivia-carbon-400 flex items-center gap-1 bg-apptivia-paper px-2 py-1 rounded-lg">
                    <Phone size={10} /> Phone not available
                  </span>
                )}
                {prospect.linkedin_url ? (
                  <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-apptivia-coral hover:text-apptivia-coral flex items-center gap-1 bg-apptivia-coral-tone-50 hover:bg-apptivia-coral-tone-50 px-2 py-1 rounded-lg transition-colors">
                    <Linkedin size={10} /> LinkedIn <ExternalLink size={8} />
                  </a>
                ) : (
                  <span className="text-xs text-apptivia-carbon-400 flex items-center gap-1 bg-apptivia-paper px-2 py-1 rounded-lg">
                    <Linkedin size={10} /> LinkedIn not available
                  </span>
                )}
                {twitterUrl && (
                  <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg transition-colors">
                    <Twitter size={10} /> Twitter <ExternalLink size={8} />
                  </a>
                )}
                {companyWebsite && (
                  <a href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700 flex items-center gap-1 bg-apptivia-paper hover:bg-apptivia-carbon-100 px-2 py-1 rounded-lg transition-colors">
                    <Globe size={10} /> Website <ExternalLink size={8} />
                  </a>
                )}
              </div>

              {/* Row 3: Action buttons */}
              <div className="flex items-center gap-2 mt-3">
                {phone && onCallContact && (
                  <button
                    onClick={() => onCallContact({ name: prospectName, phone, company_name: prospect.organization?.name || prospect.company_name })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <PhoneCall size={11} /> Call
                  </button>
                )}
                {prospect.email && (
                  <a
                    href={`mailto:${prospect.email}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-apptivia-coral hover:bg-apptivia-coral text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <Mail size={11} /> Email
                  </a>
                )}
                {onSaveContact && (
                  <button
                    onClick={() => { console.log('Save Contact clicked', prospect?.email, prospect?.first_name); onSaveContact(prospect); }}
                    disabled={isSaved || savingContact}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shadow-sm ${
                      isSaved
                        ? 'bg-apptivia-carbon-100 text-apptivia-carbon-400 cursor-default'
                        : savingContact
                          ? 'bg-apptivia-ink text-white cursor-wait'
                          : 'bg-apptivia-ink hover:bg-apptivia-ink text-white'
                    }`}
                  >
                    {isSaved ? <><BookmarkCheck size={11} /> Saved</> : savingContact ? <><UserPlus size={11} /> Saving...</> : <><UserPlus size={11} /> Save Contact</>}
                  </button>
                )}
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-apptivia-carbon-200 hover:border-apptivia-carbon-300 text-apptivia-carbon-600 hover:text-apptivia-ink text-xs font-medium rounded-lg transition-colors"
                  title="Copy all contact info"
                >
                  {copied === 'all' ? <><Check size={11} className="text-emerald-500" /> Copied!</> : <><ClipboardList size={11} /> Copy All</>}
                </button>
                {onGenerateDraft && (
                  <button
                    onClick={onGenerateDraft}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:opacity-90 text-white text-xs font-medium rounded-lg transition-opacity shadow-sm"
                    title="Generate AI outreach draft"
                  >
                    <FileText size={11} /> Generate Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Brief */}
      {brief && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="bg-apptivia-ink px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-white" />
              <span className="text-sm font-semibold text-white">AI Prospect Brief</span>
            </div>
            <div className="flex items-center gap-3">
              <TokensUsed tokens={tokensUsed} />
              <DataSourceBadges sources={dataSources} />
            </div>
          </div>

          <div className="p-5 space-y-4">
            {brief.summary && (
              <div className="bg-apptivia-carbon-100/50 border border-apptivia-carbon-300 rounded-lg p-4">
                <p className="text-sm text-apptivia-ink leading-relaxed">{brief.summary}</p>
              </div>
            )}

            {brief.fit_score != null && (
              <div className="flex items-center gap-3 bg-apptivia-paper rounded-lg p-3">
                <span className="text-xs font-medium text-apptivia-carbon-500">Prospect Fit:</span>
                <ScoreBadge score={brief.fit_score} label />
                {brief.fit_reasoning && <span className="text-xs text-apptivia-carbon-500 flex-1">{brief.fit_reasoning}</span>}
              </div>
            )}

            {brief.professional_background && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Professional Background</span>
                <p className="text-xs text-apptivia-carbon-700 leading-relaxed">{brief.professional_background}</p>
              </div>
            )}

            {brief.recent_activity?.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-2">Recent Activity</span>
                <ul className="space-y-1.5">
                  {brief.recent_activity.map((a, i) => (
                    <li key={i} className="text-xs text-apptivia-carbon-700 flex items-start gap-2">
                      <span className="text-apptivia-coral mt-0.5">●</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.shared_connections && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Shared Connections &amp; Common Ground</span>
                <p className="text-xs text-apptivia-carbon-700 leading-relaxed">{brief.shared_connections}</p>
              </div>
            )}

            {brief.outreach_angles?.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-2">Outreach Angles</span>
                <ul className="space-y-1.5">
                  {brief.outreach_angles.map((a, i) => (
                    <li key={i} className="text-xs text-apptivia-carbon-700 flex items-start gap-2">
                      <span className="text-apptivia-ink mt-0.5">→</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.talking_points?.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-2">Talking Points</span>
                <ul className="space-y-1.5">
                  {brief.talking_points.map((p, i) => (
                    <li key={i} className="text-xs text-apptivia-carbon-700 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.best_channel && (
              <div className="flex items-center gap-4 bg-apptivia-paper rounded-lg p-3">
                <div>
                  <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block">Best Channel</span>
                  <span className="text-xs font-semibold text-apptivia-carbon-700 capitalize">{brief.best_channel}</span>
                </div>
                {brief.best_time_to_reach && (
                  <div>
                    <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block">Best Time</span>
                    <span className="text-xs font-semibold text-apptivia-carbon-700">{brief.best_time_to_reach}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {errors?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700">Partial Results</span>
          </div>
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-yellow-600">{e.step}: {e.error}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Outreach Draft Panel ────────────────────────────────────

function OutreachDraftPanel({ draft, tokensUsed }) {
  if (!draft) return null;

  const angleColors = [
    { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', accent: 'text-red-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', accent: 'text-amber-500' },
    { bg: 'bg-apptivia-coral-tone-50', border: 'border-apptivia-coral-tone-100', badge: 'bg-apptivia-coral-tone-50 text-apptivia-coral', accent: 'text-apptivia-coral' },
    { bg: 'bg-apptivia-carbon-100', border: 'border-apptivia-carbon-300', badge: 'bg-apptivia-carbon-100 text-apptivia-ink', accent: 'text-apptivia-ink' },
  ];

  // Multi-message format (from multi-angle template)
  if (draft.messages?.length > 0) {
    return (
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
        <div className="bg-emerald-500 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={14} className="text-white" />
            <span className="text-sm font-semibold text-white">AI Outreach Drafts</span>
            <span className="text-[10px] text-emerald-100 bg-emerald-600/30 px-2 py-0.5 rounded-full">{draft.messages.length} variants</span>
          </div>
          <TokensUsed tokens={tokensUsed} />
        </div>
        <div className="p-4">
          <p className="text-[10px] text-apptivia-carbon-400 mb-3 flex items-center gap-1">
            <Target size={10} /> Each card is a separate, ready-to-send message. Pick the angle that fits best.
          </p>
          <div className="space-y-3">
            {draft.messages.map((msg, i) => {
              const colors = angleColors[i % angleColors.length];
              const fullText = [msg.subject && `Subject: ${msg.subject}`, msg.body].filter(Boolean).join('\n\n');
              return (
                <div key={i} className={`${colors.bg} ${colors.border} border rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        Option {i + 1}
                      </span>
                      {msg.angle && <span className="text-[10px] font-medium text-apptivia-carbon-500">{msg.angle}</span>}
                    </div>
                    <CopyButton text={fullText} />
                  </div>
                  {msg.subject && (
                    <p className="text-xs font-semibold text-apptivia-ink mb-1.5">Subject: {msg.subject}</p>
                  )}
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-xs text-apptivia-ink leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  </div>
                  {msg.personalization_points?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.personalization_points.map((p, j) => (
                        <span key={j} className="px-1.5 py-0.5 bg-white/60 text-apptivia-carbon-500 text-[9px] font-medium rounded-full">{p}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Standard single-message format
  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
      <div className="bg-emerald-500 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={14} className="text-white" />
          <span className="text-sm font-semibold text-white">AI Outreach Draft</span>
        </div>
        <TokensUsed tokens={tokensUsed} />
      </div>
      <div className="p-5 space-y-3">
        {draft.subject && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">Subject</span>
              <CopyButton text={draft.subject} />
            </div>
            <p className="text-sm font-semibold text-apptivia-ink mt-0.5">{draft.subject}</p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">Message</span>
            <CopyButton text={draft.body} />
          </div>
          <div className="bg-apptivia-paper rounded-lg p-4 mt-1">
            <p className="text-xs text-apptivia-ink leading-relaxed whitespace-pre-wrap">{draft.body}</p>
          </div>
        </div>
        {draft.personalization_points?.length > 0 && (
          <div>
            <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Personalization Used</span>
            <div className="flex flex-wrap gap-1.5">
              {draft.personalization_points.map((p, i) => (
                <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-medium rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Outreach Modal ──────────────────────────────────────────

function OutreachModal({
  open, onClose, prospect, brief,
  channel, setChannel, tone, setTone,
  selectedTemplate, setSelectedTemplate,
  onGenerate, loading, draft, draftTokens,
}) {
  // Track whether a draft has been generated so tone/channel changes auto-regenerate
  const hasGenerated = useRef(false);
  if (draft && !hasGenerated.current) hasGenerated.current = true;

  // Reset when modal closes
  useEffect(() => {
    if (!open) hasGenerated.current = false;
  }, [open]);

  if (!open) return null;

  const outreachAngles = brief?.outreach_angles?.length || 0;
  const fitScore = brief?.fit_score;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-lg shadow-2xl w-full max-w-lg ${draft ? 'max-h-[85vh] overflow-y-auto' : 'overflow-visible'}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Send size={14} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-apptivia-ink">Generate AI Outreach</h3>
              {prospect && (
                <p className="text-[10px] text-apptivia-carbon-400">
                  For {prospect.name || prospect.full_name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim()}
                  {(prospect.organization?.name || prospect.company_name) ? ` at ${prospect.organization?.name || prospect.company_name}` : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Context line */}
        {(outreachAngles > 0 || fitScore != null) && (
          <div className="px-5 py-2 bg-apptivia-carbon-100/50 border-b border-apptivia-carbon-300/50">
            <p className="text-[10px] text-apptivia-ink flex items-center gap-2">
              <Sparkles size={10} />
              Using: {outreachAngles > 0 && `${outreachAngles} outreach angle${outreachAngles > 1 ? 's' : ''}`}
              {outreachAngles > 0 && fitScore != null && ' · '}
              {fitScore != null && `Prospect fit ${fitScore}/100`}
              {brief?.talking_points?.length > 0 && ` · ${brief.talking_points.length} talking points`}
            </p>
          </div>
        )}

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          {/* Prompt Template */}
          <div>
            <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Prompt Template</label>
            <PromptTemplateSelector
              category="outreach"
              value={selectedTemplate?.id}
              onChange={(template) => setSelectedTemplate(template)}
              placeholder="Use library prompt or default..."
            />
            {selectedTemplate && (
              <p className="text-[10px] text-apptivia-ink mt-1 flex items-center gap-1">
                <BookOpen size={10} /> Using: {selectedTemplate.name}
              </p>
            )}
          </div>

          {/* Channel + Tone row */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => {
                  const newTone = e.target.value;
                  setTone(newTone);
                  if (hasGenerated.current && !loading) {
                    onGenerate({ tone: newTone });
                  }
                }}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="direct">Direct</option>
                <option value="consultative">Consultative</option>
              </select>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={onGenerate}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCw size={12} className="animate-spin" /> Generating...</>
            ) : (
              <><Sparkles size={12} /> Generate Draft</>
            )}
          </button>
        </div>

        {/* Draft result inside modal */}
        {draft && (
          <div className="px-5 pb-5">
            <OutreachDraftPanel draft={draft} tokensUsed={draftTokens} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Collapsible Section ─────────────────────────────────────

function CollapsibleSection({ title, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="border border-apptivia-carbon-100 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 bg-apptivia-paper/50 hover:bg-apptivia-paper transition-colors">
        <div className="flex items-center gap-2">
          <Icon size={12} className="text-apptivia-carbon-400" />
          <span className="text-xs font-semibold text-apptivia-carbon-700">{title}</span>
        </div>
        {expanded ? <ChevronUp size={12} className="text-apptivia-carbon-400" /> : <ChevronDown size={12} className="text-apptivia-carbon-400" />}
      </button>
      {expanded && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

// ── Main Discover Component ─────────────────────────────────

export default function EngageDiscover({ organizationId, userId, initialSearch, onInitialSearchConsumed, onCallContact, onContactSaved }) {
  const [mode, setMode] = useState('company'); // 'company' | 'prospect' | 'people_search'
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Company research results
  const [companyResult, setCompanyResult] = useState(null);

  // Prospect research results
  const [prospectResult, setProspectResult] = useState(null);

  // People search results (multiple prospects from Apollo)
  const [peopleSearchResults, setPeopleSearchResults] = useState(null);
  const [peopleSearchFilters, setPeopleSearchFilters] = useState(null);
  const [personaMode, setPersonaMode] = useState('all');
  const [customPersonaTitles, setCustomPersonaTitles] = useState('');
  const [savedContactIds, setSavedContactIds] = useState(new Set());
  const [savingContact, setSavingContact] = useState(false);

  // Save to Accounts
  const [savedAccountId, setSavedAccountId] = useState(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Suggested contacts (shown after company research) — declared early for saveToAccounts
  const [suggestedContacts, setSuggestedContacts] = useState(null);
  const [suggestedContactsLoading, setSuggestedContactsLoading] = useState(false);

  // Add to Buying Committee
  const [committeeAccounts, setCommitteeAccounts] = useState(null);
  const [committeeModal, setCommitteeModal] = useState(null); // { person } or null

  // Pre-load saved contact IDs from DB so "Saved" state persists across page refreshes
  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('engage_prospects')
      .select('email, first_name, last_name')
      .eq('organization_id', organizationId)
      .then(({ data, error }) => {
        if (error) { console.warn('Pre-load saved contacts failed:', error.message); return; }
        if (data?.length) {
          const ids = new Set(data.map(p => p.email || `${p.first_name || ''}${p.last_name || ''}`));
          setSavedContactIds(ids);
        }
      });
  }, [organizationId]);

  // Fetch accounts for Committee + feature (lazy, cached)
  const fetchCommitteeAccounts = useCallback(async () => {
    if (committeeAccounts) return committeeAccounts;
    const { data } = await supabase
      .from('engage_accounts')
      .select('id, account_name, domain, buying_committee')
      .eq('organization_id', organizationId)
      .order('account_name');
    const list = data || [];
    setCommitteeAccounts(list);
    return list;
  }, [organizationId, committeeAccounts]);

  const openCommitteeModal = useCallback(async (person) => {
    const accts = await fetchCommitteeAccounts();
    if (accts.length === 0) {
      setError('No accounts found. Add accounts in Account Intelligence first.');
      return;
    }
    setCommitteeModal({ person });
  }, [fetchCommitteeAccounts]);

  // Check if company is already saved as an account when results load
  useEffect(() => {
    if (!companyResult?.company || !organizationId) { setSavedAccountId(null); return; }
    const domain = (companyResult.company.domain || companyResult.company.primary_domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase();
    const name = (companyResult.company.name || '').toLowerCase();
    if (!domain && !name) return;
    supabase
      .from('engage_accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .or([domain && `domain.eq.${domain}`, name && `account_name.ilike.${name}`].filter(Boolean).join(','))
      .limit(1)
      .then(({ data }) => {
        setSavedAccountId(data?.[0]?.id || null);
      });
  }, [companyResult, organizationId]);

  const saveToAccounts = useCallback(async () => {
    if (!companyResult?.company || !organizationId || savingAccount) return;
    setSavingAccount(true);
    try {
      const co = companyResult.company;
      const domain = (co.domain || co.primary_domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
      const { data, error: err } = await supabase
        .from('engage_accounts')
        .insert({
          organization_id: organizationId,
          account_name: co.name || domain,
          domain: domain || null,
          industry: co.industry || null,
          tier: 'untiered',
          status: 'active',
          source: 'company_research',
          metadata: {
            signal_contacts: suggestedContacts || [],
            employee_count: co.estimated_num_employees || null,
            revenue: co.annual_revenue_printed || co.annual_revenue || null,
            description: co.short_description || co.description || null,
            logo_url: co.logo_url || null,
            linkedin_url: co.linkedin_url || null,
            website_url: co.website_url || null,
          },
        })
        .select('id')
        .single();
      if (err) throw err;
      setSavedAccountId(data.id);
      // Log activity
      engageDb.logActivityEvent({
        organization_id: organizationId,
        actor_id: userId || undefined,
        event_type: 'account.created',
        title: `Saved ${co.name || domain} to Accounts`,
        description: 'Promoted from Discover company research',
        metadata: { account_id: data.id, source: 'discover_research' },
      });
    } catch (err) {
      console.error('[EngageDiscover] Save to accounts failed:', err);
      setError(`Failed to save account: ${err.message}`);
    } finally {
      setSavingAccount(false);
    }
  }, [companyResult, organizationId, userId, savingAccount, suggestedContacts]);

  // Company disambiguation
  const [disambiguationResults, setDisambiguationResults] = useState(null);
  const [disambiguationLoading, setDisambiguationLoading] = useState(false);

  // Find People sub-mode: 'company' (by domain) or 'technology' (by tech name)
  const [findPeopleMode, setFindPeopleMode] = useState('technology');

  // Outreach
  const [outreachDraft, setOutreachDraft] = useState(null);
  const [outreachTokens, setOutreachTokens] = useState(0);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState('email');
  const [outreachTone, setOutreachTone] = useState('professional');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [outreachModalOpen, setOutreachModalOpen] = useState(false);

  // Track whether we've consumed the initial search to avoid re-triggering
  const [initialSearchApplied, setInitialSearchApplied] = useState(false);

  // Auto-research flag: when set to true, fires handleResearch after mode/input state settles
  const [autoResearchPending, setAutoResearchPending] = useState(false);

  // Known contact data: when navigating Find People → Prospect Research, carry over email/phone/LinkedIn
  const [knownContactData, setKnownContactData] = useState(null);

  // Force refresh flag — bypasses cache when user explicitly clicks refresh
  const [forceRefresh, setForceRefresh] = useState(false);

  // Track whether current people results came from cache
  const [peopleResultCached, setPeopleResultCached] = useState(false);

  // ── Search History ──────────────────────────────────────

  const [searchHistory, setSearchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Handle initialSearch from Signal Prospecting cross-tab nav ──
  useEffect(() => {
    if (initialSearch && !initialSearchApplied && !loading) {
      const newMode = initialSearch.mode || 'company';
      setMode(newMode);
      setSearchInput(initialSearch.query || '');
      if (initialSearch.filters) setPeopleSearchFilters(initialSearch.filters);
      if (newMode === 'people_search') {
        setFindPeopleMode(initialSearch.findPeopleMode || 'technology');
      }
      setCompanyResult(null);
      setProspectResult(null);
      setPeopleSearchResults(null);
      setOutreachDraft(null);
      setDisambiguationResults(null);
      setSuggestedContacts(null);
      setError(null);
      setInitialSearchApplied(true);
      if (onInitialSearchConsumed) onInitialSearchConsumed();
    }
  }, [initialSearch, initialSearchApplied, loading, onInitialSearchConsumed]);

  // Auto-trigger research when initialSearch populates the input
  useEffect(() => {
    if (initialSearchApplied && searchInput.trim() && !loading && !companyResult && !prospectResult && !peopleSearchResults) {
      // Small delay to let the UI render the populated input before firing
      const timer = setTimeout(() => {
        handleResearchRef.current?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialSearchApplied, searchInput, loading, companyResult, prospectResult, peopleSearchResults]);

  // Auto-trigger research when the Eye icon sets the pending flag
  // NOTE: Do NOT call setAutoResearchPending(false) here — it causes a re-render
  // that runs cleanup (clearTimeout) before the timer fires. The flag is cleared
  // inside handleResearch instead.
  useEffect(() => {
    if (autoResearchPending && mode === 'prospect' && searchInput.trim() && !loading) {
      const timer = setTimeout(() => {
        handleResearchRef.current?.();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoResearchPending, mode, searchInput, loading]);

  const fetchSearchHistory = useCallback(async () => {
    if (!organizationId) return;
    setHistoryLoading(true);
    try {
      const { data } = await engageDb.getReports(organizationId);
      setSearchHistory(data || []);
    } catch {
      // non-blocking
    } finally {
      setHistoryLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchSearchHistory();
  }, [fetchSearchHistory]);

  const saveToHistory = useCallback(async (searchType, query, result) => {
    if (!organizationId) return;
    try {
      let title;
      let content;
      let companyId = null;
      let prospectId = null;

      if (searchType === 'company') {
        title = result?.company?.name || result?.company?.domain || query;
        content = {
          query,
          search_type: searchType,
          company: result?.company || null,
          prospect: null,
          brief: result?.brief || null,
          data_sources: result?.data_sources || [],
        };
        // Upsert engage_companies record to satisfy CHECK constraint
        const domain = (result?.company?.domain || query || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
        if (domain) {
          try {
            const { data: co } = await engageDb.upsertCompany({
              organization_id: organizationId,
              name: result?.company?.name || domain,
              domain,
              industry: result?.company?.industry || null,
              description: result?.company?.description || null,
              source: 'research',
            });
            if (co?.id) companyId = co.id;
          } catch { /* proceed without company_id */ }
        }
      } else if (searchType === 'people_search') {
        const count = result?.people?.length || 0;
        title = `${count} people — ${query}`;
        content = {
          query,
          search_type: 'people_search',
          people: result?.people || [],
          mode: result?.mode || 'technology',
          company: null,
          prospect: null,
          brief: null,
          data_sources: ['apollo'],
        };
        // People search by company domain — upsert the company
        const domain = query.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
        if (domain && domain.includes('.')) {
          try {
            const { data: co } = await engageDb.upsertCompany({
              organization_id: organizationId,
              name: domain,
              domain,
              source: 'people_search',
            });
            if (co?.id) companyId = co.id;
          } catch { /* proceed without company_id */ }
        }
      } else {
        title = result?.prospect?.full_name || result?.prospect?.email || query;
        content = {
          query,
          search_type: searchType,
          company: null,
          prospect: result?.prospect || null,
          brief: result?.brief || null,
          data_sources: result?.data_sources || [],
        };
        // Upsert prospect record to satisfy CHECK constraint
        const prospect = result?.prospect;
        const email = prospect?.email || (query.includes('@') ? query : null);
        if (email) {
          try {
            const { data: p } = await engageDb.upsertProspect({
              organization_id: organizationId,
              email,
              first_name: prospect?.first_name || null,
              last_name: prospect?.last_name || null,
              title: prospect?.title || null,
              company_name: prospect?.organization?.name || null,
              source: 'research',
            });
            if (p?.id) prospectId = p.id;
          } catch { /* proceed without prospect_id */ }
        }
        // Also try company from prospect's org data
        const orgDomain = prospect?.organization?.primary_domain || prospect?.organization?.website_url;
        if (!prospectId && orgDomain) {
          const domain = orgDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
          try {
            const { data: co } = await engageDb.upsertCompany({
              organization_id: organizationId,
              name: prospect?.organization?.name || domain,
              domain,
              source: 'prospect_research',
            });
            if (co?.id) companyId = co.id;
          } catch { /* proceed without company_id */ }
        }
      }

      // Only save report if we have at least one FK (CHECK constraint requires it)
      if (!companyId && !prospectId) return;

      // Compute subject_domain for matching on account pages
      const subjectDomain = searchType === 'company'
        ? (result?.company?.domain || query || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim()
        : searchType === 'prospect'
          ? (result?.prospect?.organization?.primary_domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim()
          : '';

      await engageDb.saveReport({
        organization_id: organizationId,
        report_type: searchType,
        title,
        content,
        company_id: companyId || undefined,
        prospect_id: prospectId || undefined,
        model_used: searchType === 'people_search' ? 'apollo' : 'claude',
        data_sources: content.data_sources,
        tokens_used: result?.tokens_used || 0,
        created_by: userId || undefined,
        subject_name: title,
        subject_domain: subjectDomain || undefined,
      });

      // Log activity event so research appears in Activity Feed and Account Activity
      const eventType = searchType === 'company' ? 'account.researched' : searchType === 'prospect' ? 'prospect.researched' : 'people.searched';
      engageDb.logActivityEvent({
        organization_id: organizationId,
        actor_id: userId || undefined,
        event_type: eventType,
        title: `Researched ${title}`,
        description: `Via Discover (${(content.data_sources || []).join(', ') || 'research'})`,
        icon: '\uD83D\uDD0D',
        color: '#FF4D2E',
      }).catch(() => { /* non-blocking */ });

      await fetchSearchHistory();
    } catch {
      // non-blocking
    }
  }, [organizationId, userId, fetchSearchHistory]);

  // Consistent key for saved-contact dedup (email preferred, fallback to name)
  const getSavedKey = useCallback((person) => {
    return person.email || `${person.first_name || ''}${person.last_name || ''}`;
  }, []);

  const saveContact = useCallback(async (person) => {
    const key = getSavedKey(person);
    if (savedContactIds.has(key)) return;
    setSavingContact(true);
    try {
      const row = {
        organization_id: organizationId,
        first_name: person.first_name || null,
        last_name: person.last_name || null,
        email: person.email || null,
        phone: person.sanitized_phone || person.phone_number || person.phone || null,
        linkedin_url: person.linkedin_url || null,
        title: person.title || person.headline || null,
        company_name: person.organization?.name || person.organization_name || null,
        source: 'discover',
      };
      const { error } = await supabase.from('engage_prospects').insert(row);
      if (error) {
        console.error('Save contact error:', error.message, error);
        setSavingContact(false);
        return;
      }
      setSavedContactIds(prev => new Set([...prev, key]));
      onContactSaved?.();
    } catch (err) {
      console.error('Save contact exception:', err);
    }
    setSavingContact(false);
  }, [organizationId, savedContactIds, onContactSaved, getSavedKey]);

  const deleteFromHistory = useCallback(async (id) => {
    if (!organizationId) return;
    try {
      await supabase.from('engage_research_reports').delete().eq('id', id).eq('organization_id', organizationId);
      setSearchHistory(prev => prev.filter(h => h.id !== id));
    } catch {
      // non-blocking
    }
  }, [organizationId]);

  const loadFromHistory = useCallback((report) => {
    const content = report.content || {};
    setOutreachDraft(null);
    setError(null);
    setDisambiguationResults(null);
    setSuggestedContacts(null);

    if (report.report_type === 'company') {
      setMode('company');
      setSearchInput(content.query || report.title || '');
      setCompanyResult({
        company: content.company,
        brief: content.brief,
        data_sources: content.data_sources || [],
        tokens_used: 0,
      });
      setProspectResult(null);
      setPeopleSearchResults(null);
      // Re-fetch suggested contacts if we have a domain
      const domain = content.company?.primary_domain || content.company?.domain || content.query;
      if (domain) fetchSuggestedContacts(domain);
    } else if (report.report_type === 'people_search') {
      setMode('people_search');
      setSearchInput(content.query || '');
      setFindPeopleMode(content.mode || 'technology');
      setPeopleSearchResults(content.people || []);
      setCompanyResult(null);
      setProspectResult(null);
    } else {
      setMode('prospect');
      setSearchInput(content.query || report.title || '');
      setProspectResult({
        prospect: content.prospect,
        brief: content.brief,
        data_sources: content.data_sources || [],
        tokens_used: 0,
      });
      setCompanyResult(null);
      setPeopleSearchResults(null);
    }
  }, []);

  // ── Research Handlers ───────────────────────────────────

  const handleResearchRef = useRef(null);

  // Helper: fetch company research with cache check
  const fetchCompanyResearchWithCache = async (domain) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh && organizationId) {
      const cached = await engageDb.getCachedReport(organizationId, 'company', domain);
      if (cached?.content) {
        return {
          ok: true,
          company: cached.content.company || null,
          brief: cached.content.brief || null,
          data_sources: cached.content.data_sources || [],
          tokens_used: 0,
          errors: [],
          _cached: true,
        };
      }
    }
    return engageApi.researchCompany(domain);
  };

  // Helper: fetch people at company with cache check
  const fetchPeopleWithCache = async (domain, opts) => {
    if (!forceRefresh && organizationId) {
      const cached = await engageDb.getCachedReport(organizationId, 'people_search', domain);
      if (cached?.content?.people?.length) {
        return { _cached: true, people: cached.content.people };
      }
    }
    const result = await engageApi.findPeopleAtCompany(domain, opts);
    const people = result?.data?.people || result?.data?.contacts || result?.data || [];
    return { _cached: false, people: Array.isArray(people) ? people : [] };
  };

  // Helper: fetch prospect research with cache check
  const fetchProspectWithCache = async (identifier, query) => {
    if (!forceRefresh && organizationId) {
      const cached = await engageDb.getCachedReport(organizationId, 'prospect', query);
      if (cached?.content) {
        return {
          ok: true,
          prospect: cached.content.prospect || null,
          brief: cached.content.brief || null,
          data_sources: cached.content.data_sources || [],
          tokens_used: 0,
          errors: [],
          _cached: true,
        };
      }
    }
    return engageApi.researchProspect(identifier);
  };

  const handleResearch = async () => {
    if (!searchInput.trim()) return;
    setAutoResearchPending(false); // Clear auto-research flag (set by Eye icon click)
    setLoading(true);
    setError(null);
    setCompanyResult(null);
    setProspectResult(null);
    setPeopleSearchResults(null);
    setPeopleResultCached(false);
    setOutreachDraft(null);
    setDisambiguationResults(null);
    setSuggestedContacts(null);
    setInitialSearchApplied(false); // Reset so it doesn't re-trigger

    try {
      if (mode === 'company') {
        const input = searchInput.trim();
        // If it looks like a domain (has a dot and no spaces), go straight to research
        const looksLikeDomain = input.includes('.') && !input.includes(' ');
        if (looksLikeDomain) {
          const result = await fetchCompanyResearchWithCache(input);
          setCompanyResult(result);
          if (!result._cached) saveToHistory('company', input, result);
          // Fetch suggested contacts in background
          fetchSuggestedContacts(input);
        } else {
          // Disambiguate: search for matching companies
          setDisambiguationLoading(true);
          setLoading(false); // Don't show full loading, just disambiguation loading
          try {
            const resp = await engageApi.searchOrganizations(input);
            const companies = resp?.companies || [];
            if (companies.length === 1) {
              // Only one match — go straight to research
              setLoading(true);
              setDisambiguationLoading(false);
              const domain = companies[0].primary_domain || companies[0].website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || input;
              const result = await fetchCompanyResearchWithCache(domain);
              setCompanyResult(result);
              if (!result._cached) saveToHistory('company', domain, result);
              fetchSuggestedContacts(domain);
              setLoading(false);
            } else if (companies.length > 1) {
              setDisambiguationResults(companies);
              setDisambiguationLoading(false);
            } else {
              // No results — try as-is
              setDisambiguationLoading(false);
              setLoading(true);
              const result = await fetchCompanyResearchWithCache(input);
              setCompanyResult(result);
              if (!result._cached) saveToHistory('company', input, result);
              fetchSuggestedContacts(input);
              setLoading(false);
            }
          } catch (disambErr) {
            // Disambiguation failed — fall back to direct research
            setDisambiguationLoading(false);
            setLoading(true);
            const result = await fetchCompanyResearchWithCache(input);
            setCompanyResult(result);
            if (!result._cached) saveToHistory('company', input, result);
            fetchSuggestedContacts(input);
            setLoading(false);
          }
          return; // Don't hit the final finally block
        }
      } else if (mode === 'people_search') {
        if (findPeopleMode === 'company') {
          // Find people at a specific company domain — persona-based filtering
          const domain = searchInput.trim();
          const companyOpts = {};
          if (peopleSearchFilters?.titles?.length) {
            companyOpts.titles = peopleSearchFilters.titles;
          } else {
            companyOpts.persona = personaMode;
            if (personaMode === 'custom' && customPersonaTitles.trim()) {
              companyOpts.customTitles = customPersonaTitles.split(',').map(t => t.trim()).filter(Boolean);
            }
          }
          if (peopleSearchFilters?.seniority?.length) companyOpts.seniority = peopleSearchFilters.seniority;
          const { _cached, people } = await fetchPeopleWithCache(domain, Object.keys(companyOpts).length ? companyOpts : undefined);
          setPeopleSearchResults(people);
          setPeopleResultCached(!!_cached);
          if (!_cached) saveToHistory('people_search', domain, { people, mode: 'company' });
        } else {
          // Technology search — find people at companies using this technology
          const filters = peopleSearchFilters || {};
          const searchFilters = {
            titles: filters.titles || DEFAULT_PEOPLE_TITLES,
            seniority: filters.seniority || DEFAULT_PEOPLE_SENIORITY,
            technology: searchInput.trim(), // uses currently_using_any_of_technology_uids
            employee_ranges: filters.employee_ranges || [],
            per_page: 25,
          };
          const result = await engageApi.searchProspects(searchFilters);
          const people = result?.data?.people || result?.data?.contacts || result?.data || [];
          setPeopleSearchResults(Array.isArray(people) ? people : []);
          saveToHistory('people_search', searchInput.trim(), { people: Array.isArray(people) ? people : [], mode: 'technology' });
        }
      } else {
        // Parse prospect input — support email or "First Last at Company"
        const input = searchInput.trim();
        let identifier = {};

        if (input.includes('@')) {
          identifier = { email: input };
        } else if (input.includes('linkedin.com')) {
          identifier = { linkedin_url: input };
        } else {
          // Try "First Last at Company" or just "First Last"
          const atSplit = input.split(/\s+at\s+/i);
          const nameParts = atSplit[0].trim().split(/\s+/);
          identifier = {
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            company_name: atSplit[1]?.trim() || '',
          };
        }

        const result = await fetchProspectWithCache(identifier, input);
        // Merge known contact data from Find People / Suggested Contacts if available
        if (knownContactData && result?.prospect) {
          if (!result.prospect.email && knownContactData.email) result.prospect.email = knownContactData.email;
          if (!result.prospect.linkedin_url && knownContactData.linkedin_url) result.prospect.linkedin_url = knownContactData.linkedin_url;
          const existingPhone = result.prospect.sanitized_phone || result.prospect.phone_number || result.prospect.phone;
          if (!existingPhone && knownContactData.phone) result.prospect.phone_number = knownContactData.phone;
          if (!result.prospect.title && knownContactData.title) result.prospect.title = knownContactData.title;
          if (!result.prospect.organization && knownContactData.organization) result.prospect.organization = knownContactData.organization;
        }
        setKnownContactData(null); // Clear after use
        setProspectResult(result);
        if (!result._cached) saveToHistory('prospect', input, result);
      }
    } catch (err) {
      setError(err.message || 'Research failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
      setForceRefresh(false); // Reset force refresh after any search
    }
  };

  // Handle disambiguation selection
  const handleDisambiguationSelect = async (company) => {
    setDisambiguationResults(null);
    setLoading(true);
    setError(null);
    try {
      const domain = company.primary_domain || company.website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || company.name;
      setSearchInput(domain);
      const result = await fetchCompanyResearchWithCache(domain);
      setCompanyResult(result);
      if (!result._cached) saveToHistory('company', domain, result);
      fetchSuggestedContacts(domain);
    } catch (err) {
      setError(err.message || 'Research failed');
    } finally {
      setLoading(false);
    }
  };

  // Fetch suggested contacts for a company in the background
  const fetchSuggestedContacts = async (domain) => {
    setSuggestedContacts(null);
    setSuggestedContactsLoading(true);
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      const resp = await engageApi.getSuggestedContacts(cleanDomain);
      const people = resp?.data?.people || resp?.data?.contacts || resp?.data || [];
      setSuggestedContacts(Array.isArray(people) ? people : []);
    } catch {
      // non-blocking — just don't show suggestions
      setSuggestedContacts([]);
    } finally {
      setSuggestedContactsLoading(false);
    }
  };

  // Keep ref in sync so the auto-trigger effect can call handleResearch
  handleResearchRef.current = handleResearch;

  const handleGenerateOutreach = async (overrides = {}) => {
    const prospect = prospectResult?.prospect || companyResult?.company;
    const brief = prospectResult?.brief || companyResult?.brief;
    if (!prospect || !brief) return;

    setOutreachLoading(true);
    try {
      const result = await engageApi.generateOutreach(prospect, brief, {
        channel: overrides.channel || outreachChannel,
        tone: overrides.tone || outreachTone,
        template_id: selectedTemplate?.id || undefined,
        template_system_prompt: selectedTemplate?.system_prompt || undefined,
        template_user_prompt: selectedTemplate?.user_prompt || undefined,
      });
      setOutreachDraft(result.content);
      setOutreachTokens(result.tokens_used);
    } catch (err) {
      setError(err.message || 'Outreach generation failed');
    } finally {
      setOutreachLoading(false);
    }
  };

  const hasResults = companyResult || prospectResult || (peopleSearchResults && peopleSearchResults.length > 0) || disambiguationResults;
  const canGenerateOutreach = (companyResult || prospectResult) && !loading;

  return (
    <div className="space-y-4">
      {/* Search Panel */}
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
        <div className="bg-apptivia-coral px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Research & Discovery</h2>
              <p className="text-xs text-white/70">Research companies and prospects with Apollo, Tavily &amp; Claude AI</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => { setMode('company'); setSearchInput(''); setError(null); setCompanyResult(null); setProspectResult(null); setPeopleSearchResults(null); setOutreachDraft(null); setDisambiguationResults(null); setSuggestedContacts(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'company'
                  ? 'bg-white text-apptivia-coral shadow-sm'
                  : 'bg-white/20 text-white/80 hover:bg-white/30'
              }`}
            >
              <Building2 size={12} /> Company Research
            </button>
            <button
              onClick={() => { setMode('people_search'); setSearchInput(''); setError(null); setCompanyResult(null); setProspectResult(null); setPeopleSearchResults(null); setPeopleSearchFilters(null); setOutreachDraft(null); setDisambiguationResults(null); setSuggestedContacts(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'people_search'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'bg-white/20 text-white/80 hover:bg-white/30'
              }`}
            >
              <UserPlus size={12} /> Find People
            </button>
            <button
              onClick={() => { setMode('prospect'); setSearchInput(''); setError(null); setCompanyResult(null); setProspectResult(null); setPeopleSearchResults(null); setOutreachDraft(null); setDisambiguationResults(null); setSuggestedContacts(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'prospect'
                  ? 'bg-white text-apptivia-ink shadow-sm'
                  : 'bg-white/20 text-white/80 hover:bg-white/30'
              }`}
            >
              <Users size={12} /> Prospect Research
            </button>
          </div>

          {/* Find People Sub-Mode Toggle */}
          {mode === 'people_search' && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/60 uppercase font-medium mr-1">Search by:</span>
                <button
                  onClick={() => { setFindPeopleMode('technology'); setSearchInput(''); setPeopleSearchResults(null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                    findPeopleMode === 'technology'
                      ? 'bg-white/30 text-white shadow-sm'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <Cpu size={10} /> Technology
                </button>
                <button
                  onClick={() => { setFindPeopleMode('company'); setSearchInput(''); setPeopleSearchResults(null); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                    findPeopleMode === 'company'
                      ? 'bg-white/30 text-white shadow-sm'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <Building2 size={10} /> Company Domain
                </button>
              </div>
              {/* Persona Mode Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/60 uppercase font-medium mr-1">Personas:</span>
                {PERSONA_MODES.map(pm => (
                  <button
                    key={pm.key}
                    onClick={() => setPersonaMode(pm.key)}
                    title={pm.desc}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                      personaMode === pm.key
                        ? 'bg-white/30 text-white shadow-sm'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {pm.key === 'icp' && <Target size={10} />}
                    {pm.key === 'leadership' && <Briefcase size={10} />}
                    {pm.key === 'all' && <Users size={10} />}
                    {pm.key === 'custom' && <ClipboardList size={10} />}
                    {pm.label}
                  </button>
                ))}
              </div>
              {/* Custom titles input */}
              {personaMode === 'custom' && (
                <input
                  type="text"
                  value={customPersonaTitles}
                  onChange={(e) => setCustomPersonaTitles(e.target.value)}
                  placeholder="e.g. Project Manager, VDC Leader, Preconstruction Manager"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-xs placeholder-white/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              )}
            </div>
          )}

          {/* Search Input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                placeholder={
                  mode === 'company'
                    ? 'Enter company name or domain (e.g., Gong, salesloft.com, Ambition)'
                    : mode === 'people_search' && findPeopleMode === 'company'
                    ? 'Enter company domain (e.g., gong.io, salesloft.com, outreach.io)'
                    : mode === 'people_search'
                    ? 'Enter a technology or software name (e.g., Ambition, Gong, Salesloft, Outreach)'
                    : 'Enter email, LinkedIn URL, or "First Last at Company"'
                }
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-sm text-apptivia-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300 shadow-sm"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleResearch}
              disabled={loading || !searchInput.trim()}
              className="px-5 py-3 bg-white text-apptivia-coral rounded-lg text-sm font-semibold hover:bg-apptivia-coral-tone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {mode === 'people_search' ? 'Searching...' : 'Researching...'}
                </>
              ) : (
                <>
                  <Search size={14} />
                  {mode === 'people_search' ? 'Find People' : 'Research'}
                </>
              )}
            </button>
          </div>

          {/* Hint */}
          <div className="mt-2 text-[10px] text-white/50">
            {mode === 'company'
              ? 'Enter a name like "Ambition" to see matching companies, or a domain like gong.io for instant research'
              : mode === 'people_search' && findPeopleMode === 'company'
              ? 'Enter a company domain to find up to 25 sales leaders • Includes email & phone from Apollo'
              : mode === 'people_search'
              ? 'Finds sales leaders at companies using that technology • Includes email & phone from Apollo'
              : 'Try: john@gong.io • linkedin.com/in/someone • "Jane Doe at Salesforce"'}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-sm font-semibold text-red-700 block">Research Error</span>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Company Disambiguation Picker */}
      {disambiguationLoading && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-6 text-center">
          <RefreshCw size={20} className="animate-spin text-apptivia-coral mx-auto mb-2" />
          <p className="text-sm text-apptivia-carbon-600">Finding matching companies...</p>
        </div>
      )}

      {disambiguationResults && disambiguationResults.length > 0 && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-apptivia-carbon-100 bg-apptivia-coral-tone-50">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-apptivia-coral" />
              <span className="text-sm font-semibold text-apptivia-ink">
                {disambiguationResults.length} companies match &ldquo;{searchInput}&rdquo;
              </span>
            </div>
            <p className="text-[10px] text-apptivia-carbon-500 mt-0.5">Select the company you want to research</p>
          </div>
          <div className="divide-y divide-gray-50">
            {disambiguationResults.map((company, idx) => {
              const domain = company.primary_domain || company.website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || '';
              return (
                <button
                  key={company.id || idx}
                  onClick={() => handleDisambiguationSelect(company)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-apptivia-coral-tone-50/50 transition-colors text-left group"
                >
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="" className="w-10 h-10 rounded-lg border border-apptivia-carbon-100 object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-apptivia-ink rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-apptivia-ink">{company.name}</span>
                      {domain && <span className="text-[10px] text-apptivia-carbon-400">{domain}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {company.industry && (
                        <span className="text-[10px] text-apptivia-carbon-500 flex items-center gap-0.5">
                          <Briefcase size={8} /> {company.industry}
                        </span>
                      )}
                      {company.estimated_num_employees && (
                        <span className="text-[10px] text-apptivia-carbon-500 flex items-center gap-0.5">
                          <Users size={8} /> {company.estimated_num_employees.toLocaleString()} employees
                        </span>
                      )}
                      {company.city && (
                        <span className="text-[10px] text-apptivia-carbon-500">{[company.city, company.state, company.country].filter(Boolean).join(', ')}</span>
                      )}
                    </div>
                    {company.short_description && (
                      <p className="text-[10px] text-apptivia-carbon-400 mt-1 line-clamp-1">{company.short_description}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-apptivia-carbon-300 group-hover:text-apptivia-coral transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search History */}
      {!loading && searchHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-apptivia-carbon-100 flex items-center justify-between bg-apptivia-paper/50">
            <div className="flex items-center gap-2">
              <History size={14} className="text-apptivia-carbon-500" />
              <span className="text-sm font-bold text-apptivia-ink">Research History</span>
              <span className="text-[10px] text-apptivia-carbon-400">({searchHistory.length})</span>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {searchHistory.map((report) => (
              <div
                key={report.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-apptivia-paper transition-colors group"
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => loadFromHistory(report)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    report.report_type === 'company'
                      ? 'bg-apptivia-coral-tone-50 text-apptivia-coral'
                      : report.report_type === 'people_search'
                      ? 'bg-cyan-50 text-cyan-600'
                      : 'bg-apptivia-carbon-100 text-apptivia-ink'
                  }`}>
                    {report.report_type === 'company' ? <Building2 size={14} /> : report.report_type === 'people_search' ? <UserPlus size={14} /> : <Users size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-apptivia-ink block truncate">{report.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-apptivia-carbon-400 capitalize">{report.report_type}</span>
                      <span className="text-[10px] text-apptivia-carbon-300">•</span>
                      <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-0.5">
                        <Clock size={8} />
                        {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {report.data_sources?.length > 0 && (
                        <>
                          <span className="text-[10px] text-apptivia-carbon-300">•</span>
                          <span className="text-[10px] text-apptivia-carbon-400">{report.data_sources.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => loadFromHistory(report)}
                    className="p-1.5 text-apptivia-carbon-400 hover:text-apptivia-coral hover:bg-apptivia-coral-tone-50 rounded transition-colors"
                    title="Load results"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={() => deleteFromHistory(report.id)}
                    className="p-1.5 text-apptivia-carbon-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-8 text-center">
          <RefreshCw size={24} className="animate-spin text-apptivia-coral mx-auto mb-3" />
          <p className="text-sm font-medium text-apptivia-carbon-700">
            {mode === 'company' ? 'Researching company...' : mode === 'people_search' ? 'Searching for people...' : 'Researching prospect...'}
          </p>
          <p className="text-xs text-apptivia-carbon-400 mt-1">
            {mode === 'people_search'
              ? 'Querying Apollo for people at companies using this technology • Enriching contacts'
              : 'Enriching from Apollo → Searching the web → Generating AI brief'}
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            {['Apollo', 'Tavily', 'Claude AI'].map((step, i) => (
              <span key={step} className="flex items-center gap-1.5 text-[10px] text-apptivia-carbon-400">
                <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-apptivia-coral animate-pulse' : i === 1 ? 'bg-apptivia-ink animate-pulse' : 'bg-orange-400 animate-pulse'}`} />
                {step}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cached result indicator with refresh button */}
      {!loading && ((companyResult?._cached) || (prospectResult?._cached)) && (
        <div className="flex items-center justify-between bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg px-4 py-2">
          <span className="text-xs text-apptivia-coral flex items-center gap-1.5">
            <Clock size={12} /> Showing cached result — no API credits used
          </span>
          <button
            onClick={() => { setForceRefresh(true); setTimeout(() => handleResearchRef.current?.(), 50); }}
            className="text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 font-medium flex items-center gap-1 bg-apptivia-coral-tone-50 hover:bg-apptivia-coral-tone-100 px-2.5 py-1 rounded transition-colors"
          >
            <RefreshCw size={11} /> Refresh with new data
          </button>
        </div>
      )}

      {/* Save to Accounts bar */}
      {!loading && companyResult && (
        <div className="flex items-center justify-between bg-white border border-apptivia-carbon-100 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-apptivia-ink" />
            <span className="text-sm font-medium text-apptivia-ink">{companyResult.company?.name || 'Company'}</span>
          </div>
          {savedAccountId ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <Check size={12} /> Saved to Accounts
            </span>
          ) : (
            <button
              onClick={saveToAccounts}
              disabled={savingAccount}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-apptivia-coral hover:bg-apptivia-coral-tone-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {savingAccount ? <RefreshCw size={12} className="animate-spin" /> : <Bookmark size={12} />}
              {savingAccount ? 'Saving...' : 'Save to Accounts'}
            </button>
          )}
        </div>
      )}

      {/* Company Research: side-by-side layout — Brief (left ~75%) + Suggested Contacts (right ~25%) */}
      {!loading && companyResult && (
        <div className="flex gap-4 items-start">
          {/* Company Research Brief — main column */}
          <div className="flex-1 min-w-0">
            <CompanyBriefPanel
              company={companyResult.company}
              brief={companyResult.brief}
              dataSources={companyResult.data_sources}
              tokensUsed={companyResult.tokens_used}
              errors={companyResult.errors}
            />
          </div>

          {/* Suggested Contacts — compact sidebar */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden sticky top-4">
              <div className="px-3 py-2.5 border-b border-apptivia-carbon-100 bg-gradient-to-r from-emerald-50 to-cyan-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserPlus size={12} className="text-emerald-600" />
                    <span className="text-xs font-semibold text-apptivia-ink">Suggested Contacts</span>
                    {suggestedContactsLoading && <RefreshCw size={10} className="animate-spin text-apptivia-carbon-400" />}
                  </div>
                  {suggestedContacts && suggestedContacts.length > 0 && (
                    <button
                      onClick={() => {
                        const domain = companyResult.company?.primary_domain || companyResult.company?.domain || searchInput;
                        setMode('people_search');
                        setFindPeopleMode('company');
                        setSearchInput(domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''));
                        setCompanyResult(null);
                        setSuggestedContacts(null);
                        setDisambiguationResults(null);
                        setTimeout(() => handleResearchRef.current?.(), 200);
                      }}
                      className="text-[9px] text-cyan-600 font-medium hover:text-cyan-700 flex items-center gap-0.5"
                    >
                      View all <ArrowRight size={8} />
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-apptivia-carbon-500 mt-0.5">Key people to reach out to</p>
              </div>
              {suggestedContactsLoading ? (
                <div className="p-4 text-center">
                  <RefreshCw size={14} className="animate-spin text-emerald-400 mx-auto mb-1" />
                  <p className="text-[10px] text-apptivia-carbon-400">Finding contacts...</p>
                </div>
              ) : suggestedContacts && suggestedContacts.length > 0 ? (
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                  {suggestedContacts.map((person, idx) => {
                    const name = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim();
                    const email = person.email || '';
                    const phone = person.phone_numbers?.[0]?.sanitized_number || person.phone_numbers?.[0]?.raw_number || person.sanitized_phone || person.phone_number || person.phone || '';
                    const linkedin = person.linkedin_url || '';
                    return (
                      <div key={person.id || idx} className="px-3 py-2 flex items-center gap-2 hover:bg-emerald-50/30 transition-colors group">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                          {(person.first_name?.[0] || '?')}{(person.last_name?.[0] || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-apptivia-ink truncate">{name || 'Unknown'}</span>
                            {person.seniority && (
                              <span className="text-[8px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded capitalize flex-shrink-0">{person.seniority}</span>
                            )}
                          </div>
                          <span className="text-[9px] text-apptivia-carbon-500 block truncate">{person.title || ''}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {email && (
                            <button onClick={() => navigator.clipboard.writeText(email)} className="text-apptivia-coral hover:text-apptivia-coral" title={email}>
                              <Mail size={10} />
                            </button>
                          )}
                          {phone && (
                            <button onClick={() => navigator.clipboard.writeText(phone)} className="text-emerald-500 hover:text-emerald-700" title={phone}>
                              <Phone size={10} />
                            </button>
                          )}
                          {linkedin && (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer" className="text-apptivia-coral hover:text-apptivia-coral">
                              <Linkedin size={10} />
                            </a>
                          )}
                          {(() => {
                            const saved = savedContactIds.has(getSavedKey(person));
                            return (
                              <button
                                onClick={() => saveContact(person)}
                                disabled={saved}
                                className={`transition-colors ${saved ? 'text-apptivia-coral' : 'text-apptivia-carbon-300 hover:text-apptivia-coral opacity-0 group-hover:opacity-100'}`}
                                title={saved ? 'Contact saved' : 'Save contact'}
                              >
                                {saved ? <BookmarkCheck size={10} /> : <Bookmark size={10} />}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => {
                              const org = person.organization?.name || person.organization_name || '';
                              setMode('prospect');
                              setSearchInput(org ? `${name} at ${org}` : name);
                              setKnownContactData({ email, phone, linkedin_url: linkedin, title: person.title, organization: person.organization });
                              setCompanyResult(null);
                              setSuggestedContacts(null);
                              setPeopleSearchResults(null);
                              setAutoResearchPending(true);
                            }}
                            className="text-apptivia-ink hover:text-apptivia-ink transition-colors"
                            title="Research this prospect"
                          >
                            <Eye size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : suggestedContacts && suggestedContacts.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-[10px] text-apptivia-carbon-400">No contacts found. Try "Find People".</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!loading && prospectResult && (
        <ProspectBriefPanel
          prospect={prospectResult.prospect}
          brief={prospectResult.brief}
          dataSources={prospectResult.data_sources}
          tokensUsed={prospectResult.tokens_used}
          errors={prospectResult.errors}
          onCallContact={onCallContact}
          onSaveContact={saveContact}
          savingContact={savingContact}
          isSaved={savedContactIds.has(getSavedKey(prospectResult.prospect || {}))}
          onGenerateDraft={() => setOutreachModalOpen(true)}
        />
      )}

      {/* Cached result indicator for people search */}
      {!loading && peopleResultCached && peopleSearchResults?.length > 0 && (
        <div className="flex items-center justify-between bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg px-4 py-2">
          <span className="text-xs text-apptivia-coral flex items-center gap-1.5">
            <Clock size={12} /> Showing cached result — no API credits used
          </span>
          <button
            onClick={() => { setForceRefresh(true); setTimeout(() => handleResearchRef.current?.(), 50); }}
            className="text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 font-medium flex items-center gap-1 bg-apptivia-coral-tone-50 hover:bg-apptivia-coral-tone-100 px-2.5 py-1 rounded transition-colors"
          >
            <RefreshCw size={11} /> Refresh with new data
          </button>
        </div>
      )}

      {/* People Search Results */}
      {!loading && peopleSearchResults && peopleSearchResults.length > 0 && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-apptivia-carbon-100 bg-apptivia-coral-tone-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-cyan-600" />
                <span className="text-sm font-semibold text-apptivia-ink">
                  {peopleSearchResults.length} People Found
                </span>
                <span className="text-xs text-apptivia-carbon-500">
                  matching &ldquo;{searchInput}&rdquo;
                </span>
              </div>
              <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-apptivia-coral" /> Apollo Data
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-apptivia-paper border-b border-apptivia-carbon-100">
                  <th className="text-left px-4 py-2.5 font-semibold text-apptivia-carbon-600">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-apptivia-carbon-600">Title</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-apptivia-carbon-600">Company</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-apptivia-carbon-600">Email</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-apptivia-carbon-600">Phone</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-apptivia-carbon-600">Location</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-apptivia-carbon-600">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {peopleSearchResults.map((person, idx) => {
                  const name = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim();
                  const org = person.organization?.name || person.organization_name || '';
                  const email = person.email || '';
                  const phone = person.phone_numbers?.[0]?.sanitized_number || person.phone_numbers?.[0]?.raw_number || person.sanitized_phone || person.phone_number || person.phone || '';
                  const linkedin = person.linkedin_url || '';
                  const location = [person.city, person.state, person.country].filter(Boolean).join(', ');
                  const title = person.title || person.headline || '';

                  return (
                    <tr key={person.id || idx} className="hover:bg-apptivia-coral-tone-50/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-apptivia-ink flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {(person.first_name?.[0] || '?')}{(person.last_name?.[0] || '')}
                          </div>
                          <span className="font-medium text-apptivia-ink whitespace-nowrap">{name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-apptivia-carbon-600 max-w-[200px]">
                        <span className="block truncate" title={title}>{title || '—'}</span>
                        {person.seniority && (
                          <span className="text-[10px] text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded mt-0.5 inline-block capitalize">{person.seniority}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-apptivia-carbon-600 whitespace-nowrap">
                        {org || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {email ? (
                          <button
                            onClick={() => { navigator.clipboard.writeText(email); }}
                            className="flex items-center gap-1 text-apptivia-coral hover:text-apptivia-coral-tone-700 transition-colors group/email"
                            title={`Copy: ${email}`}
                          >
                            <Mail size={11} className="flex-shrink-0" />
                            <span className="truncate max-w-[160px]">{email}</span>
                            <Copy size={9} className="opacity-0 group-hover/email:opacity-100 transition-opacity flex-shrink-0" />
                          </button>
                        ) : (
                          <span className="text-apptivia-carbon-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {phone ? (
                          <button
                            onClick={() => onCallContact
                              ? onCallContact({ name, phone, company_name: org })
                              : navigator.clipboard.writeText(phone)
                            }
                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 transition-colors group/phone"
                            title={onCallContact ? `Call ${name}` : `Copy: ${phone}`}
                          >
                            <Phone size={11} className="flex-shrink-0" />
                            <span className="whitespace-nowrap">{phone}</span>
                          </button>
                        ) : (
                          <span className="text-apptivia-carbon-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-apptivia-carbon-500 whitespace-nowrap max-w-[150px]">
                        <span className="block truncate" title={location}>{location || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {(() => {
                            const saved = savedContactIds.has(getSavedKey(person));
                            return (
                              <button
                                onClick={() => saveContact(person)}
                                disabled={saved}
                                className={saved ? 'text-apptivia-coral' : 'text-apptivia-carbon-300 hover:text-apptivia-coral transition-colors'}
                                title={saved ? 'Contact saved' : 'Save contact'}
                              >
                                {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                              </button>
                            );
                          })()}
                          {linkedin && (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer" className="text-apptivia-coral hover:text-apptivia-coral transition-colors" title="LinkedIn Profile">
                              <Linkedin size={13} />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              const fullName = name || '';
                              setMode('prospect');
                              setSearchInput(org ? `${fullName} at ${org}` : fullName);
                              // Carry over known contact data so Prospect Research shows it immediately
                              setKnownContactData({ email, phone, linkedin_url: linkedin, title, organization: person.organization });
                              setPeopleSearchResults(null);
                              setPeopleSearchFilters(null);
                              setAutoResearchPending(true);
                            }}
                            className="text-apptivia-ink hover:text-apptivia-ink transition-colors"
                            title="Research this prospect"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => openCommitteeModal({ name, title, email, organization: org })}
                            className="text-apptivia-carbon-300 hover:text-emerald-600 transition-colors"
                            title="Add to Buying Committee"
                          >
                            <UserPlus size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {peopleSearchResults.length >= 25 && (
            <div className="px-5 py-3 border-t border-apptivia-carbon-100 bg-apptivia-paper text-center">
              <span className="text-[10px] text-apptivia-carbon-400">Showing first 25 results. Refine your search for more specific results.</span>
            </div>
          )}
        </div>
      )}

      {/* People search empty state */}
      {!loading && peopleSearchResults && peopleSearchResults.length === 0 && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-8 text-center">
          <Users size={24} className="text-apptivia-carbon-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-apptivia-carbon-600">No people found</p>
          <p className="text-xs text-apptivia-carbon-400 mt-1">
            {findPeopleMode === 'company'
              ? 'No contacts found at this domain — try entering the full domain (e.g. cloudeagle.ai)'
              : 'Try a different technology name or broaden your search'}
          </p>
        </div>
      )}

      {/* Outreach Modal — for prospect research */}
      <OutreachModal
        open={outreachModalOpen}
        onClose={() => setOutreachModalOpen(false)}
        prospect={prospectResult?.prospect}
        brief={prospectResult?.brief ? (typeof prospectResult.brief === 'object' ? prospectResult.brief : (() => { try { return JSON.parse(String(prospectResult.brief).replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()); } catch { return { summary: String(prospectResult.brief) }; } })()) : null}
        channel={outreachChannel}
        setChannel={setOutreachChannel}
        tone={outreachTone}
        setTone={setOutreachTone}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        onGenerate={handleGenerateOutreach}
        loading={outreachLoading}
        draft={outreachDraft}
        draftTokens={outreachTokens}
      />

      {/* Empty State */}
      {!loading && !hasResults && !error && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-10 text-center">
          <div className="w-14 h-14 bg-apptivia-coral-tone-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-apptivia-coral" />
          </div>
          <h3 className="text-sm font-semibold text-apptivia-carbon-700 mb-1">Ready to Research</h3>
          <p className="text-xs text-apptivia-carbon-400 max-w-md mx-auto">
            Enter a company domain or prospect identifier above to generate an AI-powered research brief.
            Results include enrichment data, web intelligence, and personalized insights.
          </p>
          <div className="flex items-center justify-center gap-6 mt-5">
            {[
              { icon: Building2, label: 'Company Brief', desc: 'Funding, tech stack, competitors' },
              { icon: Users, label: 'Prospect Brief', desc: 'Background, outreach angles' },
              { icon: Mail, label: 'AI Outreach', desc: 'Personalized email & LinkedIn drafts' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="text-center">
                <div className="w-9 h-9 bg-apptivia-paper rounded-lg flex items-center justify-center mx-auto mb-1.5">
                  <Icon size={16} className="text-apptivia-carbon-400" />
                </div>
                <span className="text-[11px] font-medium text-apptivia-carbon-600 block">{label}</span>
                <span className="text-[10px] text-apptivia-carbon-400">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to Buying Committee Modal */}
      {committeeModal && committeeAccounts && (
        <AddToCommitteeModal
          person={committeeModal.person}
          accounts={committeeAccounts}
          onClose={() => setCommitteeModal(null)}
          onAdded={(accountId, updatedCommittee) => {
            setCommitteeAccounts(prev => prev.map(a =>
              a.id === accountId ? { ...a, buying_committee: updatedCommittee } : a
            ));
          }}
        />
      )}
    </div>
  );
}

// ── Add to Buying Committee Modal ─────────────────────────

function AddToCommitteeModal({ person, accounts, onClose, onAdded }) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [role, setRole] = useState('influencer');
  const [influence, setInfluence] = useState('medium');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Pre-select account if person's company matches
  useEffect(() => {
    if (!person?.organization || accounts.length === 0) return;
    const org = person.organization.toLowerCase();
    const match = accounts.find(a =>
      a.account_name.toLowerCase().includes(org) ||
      org.includes(a.account_name.toLowerCase()) ||
      (a.domain && org.includes(a.domain.toLowerCase()))
    );
    if (match) setSelectedAccountId(match.id);
  }, [person, accounts]);

  const filtered = search
    ? accounts.filter(a => a.account_name.toLowerCase().includes(search.toLowerCase()))
    : accounts;

  const handleAdd = async () => {
    if (!selectedAccountId) { setError('Please select an account.'); return; }
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    const newMember = {
      name: person.name || '',
      title: person.title || '',
      email: person.email || '',
      role,
      influence_level: influence,
    };

    const currentCommittee = Array.isArray(account.buying_committee) ? account.buying_committee : [];

    // Check for duplicates by name+email
    const isDupe = currentCommittee.some(m =>
      (m.email && m.email === newMember.email) ||
      (m.name && m.name.toLowerCase() === newMember.name.toLowerCase())
    );
    if (isDupe) { setError('This person is already on the buying committee.'); return; }

    const updated = [...currentCommittee, newMember];
    setAdding(true);
    setError('');

    const { error: dbError } = await supabase
      .from('engage_accounts')
      .update({ buying_committee: updated, updated_at: new Date().toISOString() })
      .eq('id', selectedAccountId);

    if (dbError) {
      setError(dbError.message);
      setAdding(false);
      return;
    }

    onAdded(selectedAccountId, updated);
    setSuccess(true);
    setTimeout(() => onClose(), 1500);
  };

  const ROLES = [
    { value: 'decision_maker', label: 'Decision Maker' },
    { value: 'champion', label: 'Champion' },
    { value: 'influencer', label: 'Influencer' },
    { value: 'blocker', label: 'Blocker' },
    { value: 'user', label: 'End User' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-apptivia-ink">Add to Buying Committee</h3>
            <p className="text-[10px] text-apptivia-carbon-400 mt-0.5">{person.name}{person.title ? ` · ${person.title}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={14} /></button>
        </div>

        {success ? (
          <div className="flex items-center justify-center gap-2 py-6 text-emerald-600">
            <Check size={16} /> <span className="text-sm font-medium">Added to committee!</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-apptivia-carbon-500 mb-1">ACCOUNT</label>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search accounts..."
                className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs mb-1"
              />
              <div className="max-h-[120px] overflow-y-auto border border-apptivia-carbon-100 rounded-lg">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-[10px] text-apptivia-carbon-400">No accounts found</div>
                ) : filtered.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAccountId(a.id); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-apptivia-paper transition-colors flex items-center justify-between ${
                      selectedAccountId === a.id ? 'bg-apptivia-coral-tone-50 text-apptivia-coral font-semibold' : 'text-apptivia-carbon-700'
                    }`}
                  >
                    <span>{a.account_name}</span>
                    {a.domain && <span className="text-[9px] text-apptivia-carbon-400">{a.domain}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-apptivia-carbon-500 mb-1">ROLE</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs bg-white">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-apptivia-carbon-500 mb-1">INFLUENCE</label>
                <select value={influence} onChange={e => setInfluence(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs bg-white">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {error && <p className="text-[10px] text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-1.5 text-xs text-apptivia-carbon-500 border border-apptivia-carbon-200 rounded-lg hover:bg-apptivia-paper">Cancel</button>
              <button onClick={handleAdd} disabled={adding || !selectedAccountId}
                className="flex-1 py-1.5 text-xs font-semibold text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add to Committee'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
