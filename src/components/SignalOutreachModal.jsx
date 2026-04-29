import React, { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, Copy, Check, Mail, Linkedin, MessageSquare, ChevronDown } from 'lucide-react';
import { engageApi } from '../utils/engageApi';

const SIGNAL_ICONS_MAP = {
  solution_search: '🔍',
  pain_point: '😤',
  icp_job_posting: '📋',
  tech_stack_churn: '🔄',
  competitor_comparison: '⚖️',
  competitor_complaint: '😠',
  competitor_engagement: '🎯',
  funding: '💰',
  leadership_change: '👔',
  expansion: '📈',
  layoffs: '📉',
  contract_win: '🏆',
  product_launch: '🚀',
  hiring: '👥',
  job_change: '💼',
  content_engagement: '📰',
  event_participation: '🎤',
  review_sentiment: '⭐',
  press_release: '📢',
  tech_adoption: '⚙️',
  sec_filing: '📑',
  glassdoor_sentiment: '🪟',
  reddit_signal: '💬',
  website_visit: '🌐',
  g2_review: '🌟',
  reddit_buying_intent: '💬',
  reddit_churn_risk: '💬',
  reddit_competitor_mention: '💬',
  product_hunt_launch: '🐱',
  hiring_velocity: '⚡',
  dept_expansion: '🏗️',
  capterra_review: '⭐',
  glassdoor_leadership_concern: '🪟',
  glassdoor_culture_issue: '🪟',
  glassdoor_rating_decline: '🪟',
  icp_prospector: '🎯',
};

const SIGNAL_OUTREACH_CONTEXT = {
  funding:             'They just announced a funding round. Frame around investing the new capital into scaling the sales team.',
  leadership_change:   'A new sales leader recently joined. They are likely evaluating and refreshing their current tool stack.',
  pain_point:          'They publicly expressed this specific pain point. Lead directly with solving it — be concrete.',
  tech_stack_churn:    'They are actively leaving or replacing a tool in this space. Position as the natural next step.',
  competitor_complaint:'They complained publicly about a competitor. Acknowledge the frustration and position as the better alternative.',
  icp_job_posting:     'They are hiring for sales roles, signaling growth and investment in the revenue team.',
  solution_search:     'They are actively searching for a solution like yours. Meet them where they are — be direct about fit.',
  competitor_comparison:'They are researching alternatives to their current vendor. Make the case for switching to you.',
  expansion:           'They are in a growth phase. Reach out around how you scale with them.',
  layoffs:             'They recently had layoffs, likely looking to do more with less. Lead with efficiency.',
  contract_win:        'They just won a major contract — they will need to scale the team to deliver.',
  product_launch:      'They just launched a product, indicating they are ramping up go-to-market activity.',
  sec_filing:          'They recently filed an SEC disclosure signaling a major business event — leadership change, acquisition, restructuring, or capital deployment. Reference the specific event type.',
  glassdoor_sentiment: 'Employee reviews show internal friction — leadership concerns or retention problems often precede tool and process changes. Position as a way to give the team better tools.',
  reddit_signal:       'They or their customers are talking publicly on Reddit. Reference the community discussion — it shows you are paying attention and adds authenticity.',
  review_sentiment:    'They or their customers left a public review. Reference specific feedback to show you have done your homework.',
  hiring:              'They are actively growing their team. Frame around equipping new hires and scaling team performance from day one.',
  job_change:          'A key contact recently changed roles. New roles mean fresh mandates and tool evaluations — reach out early.',
  website_visit:       'They visited your website today — they are actively evaluating. Strike while the interest is fresh. Reference that you noticed activity from their company.',
  g2_review:           'They or their customers left a review on G2. Reference the specific feedback — knowing what reviewers said about their current tool shows you have done your research and know their pain.',
  reddit_buying_intent:'Someone from their company or industry is publicly asking for recommendations on Reddit. This is rare and high-intent — reach out fast with a direct, helpful framing, not a sales pitch.',
  reddit_churn_risk:   'Reddit shows active frustration with their current vendor. Acknowledge the specific complaint, don\'t pile on the competitor, and position your product as the clean alternative.',
  reddit_competitor_mention: 'Their company or product was mentioned alongside competitor names on Reddit. Reference the community conversation — it makes your outreach feel personal and timely.',
  product_hunt_launch: 'They just launched on Product Hunt — they are in full go-to-market mode. Congratulate the launch, then tie your product to the scaling challenges that come right after a launch.',
  hiring_velocity:     'Their job postings have spiked significantly — they are in rapid growth mode. Every new hire creates tooling and coordination challenges. Lead with how you help fast-scaling teams stay aligned.',
  dept_expansion:      'A specific department (likely Sales or Marketing) is expanding fast. Department-level growth is the ideal moment to introduce tools that help the manager stay ahead of the curve.',
  capterra_review:     'They or their customers left a review on Capterra. Reference the specific feedback — Capterra reviewers are typically evaluators mid-purchase process, so this is warm intent.',
  glassdoor_leadership_concern: 'Employee reviews flag leadership or management issues. Internal friction at the top often triggers tool and process resets. Lead with how you help leaders build higher-performing teams.',
  glassdoor_culture_issue: 'Employees are publicly flagging cultural problems — poor morale, high turnover, or misalignment. Frame your product around giving reps visibility, clarity, and better day-to-day tools.',
  glassdoor_rating_decline: 'Their Glassdoor rating is trending down, signaling retention problems. Declining scores often precede leadership changes and tool evaluations. Lead with outcomes that improve rep experience.',
  icp_prospector: 'This is a direct ICP match found through a company database search. There is no specific trigger event — make the relevance clear upfront by tying your product directly to their industry, team size, and likely pain points.',
};

// 4F: Outreach style variants — pre-selected by buying stage
const OUTREACH_STYLES = [
  { key: 'direct', label: 'Direct', tone: 'direct', description: 'Straight to the point, clear ask' },
  { key: 'consultative', label: 'Consultative', tone: 'professional', description: 'Problem-solving framing, advisory' },
  { key: 'social_proof', label: 'Social Proof', tone: 'casual', description: 'Lead with results & similar companies' },
  { key: 'outcome', label: 'Outcome', tone: 'professional', description: 'Lead with the business outcome' },
];

const BUYING_STAGE_DEFAULT_STYLE = {
  awareness: 'consultative',    // early stage → educate & advise
  consideration: 'social_proof', // mid stage → show proof
  decision: 'direct',           // late stage → clear ask
};

export default function SignalOutreachModal({ isOpen, onClose, signal, contact }) {
  const [channel, setChannel] = useState('email');
  const [tone, setTone] = useState('professional');
  const [activeStyle, setActiveStyle] = useState('direct');
  const [variants, setVariants] = useState({}); // { [styleKey]: draft }
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Reset state when modal opens — pre-select style by buying stage
  useEffect(() => {
    if (isOpen && signal) {
      const defaultStyle = BUYING_STAGE_DEFAULT_STYLE[signal.buying_stage_indicator] || 'direct';
      setActiveStyle(defaultStyle);
      setVariants({});
      setError(null);
      setCopied(false);
    }
  }, [isOpen, signal?.id]);

  const handleGenerate = async (styleKey) => {
    if (!signal) return;
    const style = OUTREACH_STYLES.find(s => s.key === (styleKey || activeStyle)) || OUTREACH_STYLES[0];
    setIsGenerating(true);
    setError(null);

    const prospect = contact
      ? { name: contact.name, title: contact.title, email: contact.email, company: signal.company_name }
      : { company: signal.company_name };

    const companyBrief = {
      signal_type: signal.signal_type,
      signal_title: signal.title,
      signal_description: signal.description,
      outreach_angle: signal.ai_outreach_angle,
      buying_stage: signal.buying_stage_indicator,
      ai_summary: signal.ai_summary,
      score: signal.signal_score,
    };

    const signalContext = SIGNAL_OUTREACH_CONTEXT[signal.signal_type] || signal.ai_outreach_angle || '';
    // 4F: Append style instruction to the context prompt
    const styleInstruction = {
      direct: 'Write in a DIRECT style — be concise, state the value prop clearly, and make a clear ask.',
      consultative: 'Write in a CONSULTATIVE style — frame around their challenges, ask a diagnostic question, position as an advisor.',
      social_proof: 'Write in a SOCIAL PROOF style — lead with specific results from similar companies, mention numbers and outcomes.',
      outcome: 'Write in an OUTCOME style — lead with the business outcome they can achieve, paint a before/after picture.',
    };
    const enhancedContext = `${signalContext}\n\nSTYLE: ${styleInstruction[style.key] || ''}`;

    try {
      const result = await engageApi.generateOutreach(prospect, companyBrief, {
        channel,
        tone: style.tone,
        template_user_prompt: enhancedContext,
      });
      const content = result?.content || null;
      setVariants(prev => ({ ...prev, [style.key]: content }));

      // Fire-and-forget: log to Activity Feed
      if (signal.organization_id) {
        const { supabase } = await import('../supabaseClient');
        supabase.from('engage_activity_events').insert({
          organization_id: signal.organization_id,
          actor_id: signal.actioned_by || undefined,
          event_type: 'outreach.generated',
          title: 'Outreach Draft Generated',
          description: `${channel === 'email' ? 'Email' : 'LinkedIn'} ${style.label} draft for ${signal.company_name || 'Unknown'}`,
          icon: channel === 'email' ? '✉️' : '💼',
          color: '#8b5cf6',
        }).then(() => {}, () => {});
      }
    } catch (err) {
      setError('Failed to generate message. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const draft = variants[activeStyle] || null;

  const handleCopy = () => {
    if (!draft) return;
    const text = channel === 'email' && draft.subject
      ? `Subject: ${draft.subject}\n\n${draft.body}`
      : draft.body || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !signal) return null;

  const signalIcon = SIGNAL_ICONS_MAP[signal.signal_type] || '📡';
  const buyingStageColors = {
    awareness: 'bg-sky-50 text-sky-700',
    consideration: 'bg-amber-50 text-amber-700',
    decision: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare size={13} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-apptivia-ink">Draft Outreach Message</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-apptivia-carbon-100 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Signal context */}
          <div className="bg-apptivia-paper rounded-lg p-3 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">{signalIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-apptivia-ink leading-snug">{signal.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {signal.company_name && (
                    <span className="text-[10px] text-apptivia-carbon-500 font-medium">{signal.company_name}</span>
                  )}
                  {signal.buying_stage_indicator && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${buyingStageColors[signal.buying_stage_indicator] || 'bg-apptivia-carbon-100 text-apptivia-carbon-600'}`}>
                      {signal.buying_stage_indicator}
                    </span>
                  )}
                  <span className="text-[10px] text-apptivia-carbon-400">Score: {signal.signal_score}</span>
                </div>
              </div>
            </div>
            {signal.ai_outreach_angle && (
              <p className="text-[10px] text-apptivia-carbon-500 italic pl-6 leading-relaxed">
                "{signal.ai_outreach_angle}"
              </p>
            )}
          </div>

          {/* Controls row */}
          <div className="grid grid-cols-2 gap-2">
            {/* To */}
            <div>
              <label className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide block mb-1">To</label>
              <div className="text-xs text-apptivia-carbon-700 bg-apptivia-paper rounded-lg px-2.5 py-1.5 truncate">
                {contact?.name || <span className="text-apptivia-carbon-400 italic">Company only</span>}
                {contact?.title && <span className="text-apptivia-carbon-400 block text-[9px]">{contact.title}</span>}
              </div>
            </div>

            {/* Channel */}
            <div>
              <label className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide block mb-1">Channel</label>
              <div className="relative">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-2.5 py-1.5 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-300 pr-6"
                >
                  <option value="email">✉ Email</option>
                  <option value="linkedin">in LinkedIn</option>
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 4F: Outreach Style Variant Pills */}
          <div>
            <label className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide block mb-1.5">Outreach Style</label>
            <div className="flex gap-1.5 flex-wrap">
              {OUTREACH_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() => { setActiveStyle(style.key); setCopied(false); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    activeStyle === style.key
                      ? 'border-apptivia-carbon-300 bg-apptivia-carbon-100 text-apptivia-ink font-semibold'
                      : 'border-apptivia-carbon-200 bg-white text-apptivia-carbon-600 hover:bg-apptivia-paper'
                  }`}
                  title={style.description}
                >
                  {style.label}
                  {variants[style.key] && <span className="ml-1 text-green-500">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button (shown before first generation or to regenerate) */}
          {!isGenerating && (
            <button
              onClick={() => handleGenerate(activeStyle)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 transition-all shadow-sm"
            >
              <Sparkles size={12} />
              {draft ? 'Regenerate' : `Generate ${OUTREACH_STYLES.find(s => s.key === activeStyle)?.label || ''} Message`}
            </button>
          )}

          {/* Loading */}
          {isGenerating && (
            <div className="flex items-center justify-center gap-2 py-4 text-apptivia-ink">
              <RefreshCw size={14} className="animate-spin" />
              <span className="text-xs font-medium">Generating with Claude...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Draft output */}
          {draft && !isGenerating && (
            <div className="border border-apptivia-carbon-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-apptivia-paper border-b border-apptivia-carbon-200">
                <span className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide flex items-center gap-1">
                  {channel === 'email' ? <Mail size={10} /> : <Linkedin size={10} />}
                  {channel === 'email' ? 'Email Draft' : 'LinkedIn Message'}
                </span>
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                    copied ? 'text-emerald-600 bg-emerald-50' : 'text-apptivia-carbon-500 hover:text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'
                  }`}
                >
                  {copied ? <Check size={9} /> : <Copy size={9} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="p-3 space-y-2">
                {channel === 'email' && draft.subject && (
                  <div>
                    <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase">Subject</span>
                    <p className="text-xs font-medium text-apptivia-ink mt-0.5">{draft.subject}</p>
                  </div>
                )}
                {draft.body && (
                  <div>
                    {channel === 'email' && draft.subject && (
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase">Body</span>
                    )}
                    <p className="text-xs text-apptivia-carbon-700 whitespace-pre-wrap leading-relaxed mt-0.5">{draft.body}</p>
                  </div>
                )}
                {draft.personalization_points?.length > 0 && (
                  <div className="pt-2 border-t border-apptivia-carbon-100">
                    <span className="text-[10px] font-semibold text-apptivia-ink uppercase">Personalization notes</span>
                    <ul className="mt-1 space-y-0.5">
                      {draft.personalization_points.map((p, i) => (
                        <li key={i} className="text-[10px] text-apptivia-carbon-500 flex items-start gap-1">
                          <span className="text-apptivia-ink mt-0.5">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
