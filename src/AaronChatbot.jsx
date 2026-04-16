import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Send, X, Minimize2, Maximize2, Shield, Trash2, RotateCcw, Sparkles, MessageSquarePlus, ChevronLeft, ChevronRight, Pencil, Trash, CheckCircle, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import socket from './socket';
import { useAuth } from './AuthContext';
import { hasPermission, getEffectivePermissions } from './permissions';
import { supabase } from './supabaseClient';
import { backendFetch } from './utils/backendFetch';
import { useBilling } from './hooks/useBilling';
import UpgradePrompt from './components/UpgradePrompt';
import AaronMemoryPanel from './components/AaronMemoryPanel';

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'apptivia.aaronChat';
const MAX_PERSISTED = 50;
const MAX_MESSAGE_LENGTH = 500;

// 4B: Role-filtered presets — auto-send context-rich prompts with one click
const ROLE_PRESETS = {
  power_user: [
    { label: 'Coach Me', prompt: 'Analyze my bottom 2-3 KPIs and give me specific coaching to improve this week.' },
    { label: 'My Performance', prompt: 'Summarize my current scorecard performance, trends, and where I stand vs. my goals.' },
    { label: 'Deal Strategy', prompt: 'Help me strategize on my current pipeline — which deals need attention and what actions should I take?' },
    { label: 'Call Prep', prompt: 'Help me prepare for my next sales call — give me a structured call plan with opener, key questions, and close.' },
    { label: 'Handle Objection', prompt: 'A prospect just pushed back. Help me craft a response using proven objection handling techniques.' },
  ],
  manager: [
    { label: 'Team Overview', prompt: 'Give me a summary of my team\'s performance this week — who needs coaching and who is excelling?' },
    { label: '1-on-1 Prep', prompt: 'Help me prepare for 1-on-1s — which reps need the most attention and what should I discuss with each?' },
    { label: 'Coaching Plan', prompt: 'Suggest a coaching plan for my lowest-performing team members based on their KPI trends.' },
  ],
  admin: [
    { label: 'Org Health', prompt: 'Analyze the overall health of our organization — team performance trends, configuration completeness, and key risks.' },
    { label: 'Team Overview', prompt: 'Give me a cross-team comparison of performance this week — which teams are thriving and which need support?' },
  ],
};

// Title-specific presets — shown when user has a matching job title (overrides role presets)
const TITLE_PRESETS = {
  bdr: [
    { label: 'Cold Call Prep', prompt: 'Help me prepare for cold calls today — give me an opener, engagement question, and close based on my ICP.' },
    { label: 'Email Sequence', prompt: 'Help me draft a 3-step email outreach sequence for a prospect matching our ICP.' },
    { label: 'Handle Objection', prompt: 'A prospect just pushed back on my call. Help me craft a response using proven objection handling techniques.' },
    { label: 'Pipeline Builder', prompt: 'Analyze my current activity metrics and help me build a plan to hit my pipeline target this week.' },
    { label: 'Meeting Prep', prompt: 'Help me prepare for an upcoming meeting — what should I research and what questions should I ask?' },
  ],
  sdr: null, // alias → resolved to bdr at runtime
  ae: [
    { label: 'Deal Strategy', prompt: 'Help me strategize on my current pipeline — which deals need attention and what actions should I take?' },
    { label: 'Discovery Prep', prompt: 'Help me prepare for a discovery call — give me persona-based questions and a credibility-first structure.' },
    { label: 'Executive Briefing', prompt: 'Help me prepare for a meeting with an executive buyer — structure my talking points and value props.' },
    { label: 'Negotiation Coach', prompt: 'I\'m in negotiations on a deal. Help me handle pricing objections and create urgency to close.' },
    { label: 'Proposal Builder', prompt: 'Help me structure a compelling proposal that quantifies the value of our solution vs. the cost of inaction.' },
  ],
  sales_manager: null, // uses role-based manager presets (already defined above)
};
// Resolve aliases
TITLE_PRESETS.sdr = TITLE_PRESETS.bdr;

const BLOCKED_WORDS = [
  'profanity1', 'profanity2', 'abuse1', 'abuse2',
];

const SENSITIVE_PATTERNS = [
  /password/i,
  /credit\s*card/i,
  /ssn|social\s*security/i,
  /api[_\s]*key/i,
  /secret/i,
  /token/i,
];

// ─── Helpers (pure, module-scoped — never recreated) ─────────────────────────

let _msgId = 0;
const nextId = () => `msg-${Date.now()}-${++_msgId}`;

const filterContent = (text) => {
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word.toLowerCase())) return { isClean: false, reason: 'profanity' };
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) return { isClean: false, reason: 'sensitive' };
  }
  const caps = (text.match(/[A-Z]/g) || []).length;
  if (caps / text.length > 0.7 && text.length > 10) return { isClean: false, reason: 'shouting' };
  return { isClean: true };
};

const WARNING_MAP = {
  profanity: 'Please keep our conversation professional and respectful.',
  sensitive: 'Please do not share sensitive information like passwords or personal data in chat.',
  shouting: 'Please avoid using excessive capital letters.',
};

/**
 * Extract numbered/lettered options from Aaron's response for clickable chips.
 * Only returns if 2-6 short items found (avoids false positives on long lists).
 */
const extractResponseOptions = (text) => {
  const pattern = /^(?:\d+[.)]\s*|[A-E][.)]\s*)\*?\*?(.+?)(?:\*?\*?)$/gm;
  const matches = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const label = m[1].replace(/\*\*/g, '').replace(/\s*[-—:].*$/, '').trim();
    if (label.length > 0 && label.length <= 80) matches.push({ label, value: label });
  }
  return matches.length >= 2 && matches.length <= 6 ? matches : [];
};

const getPermissionRestrictedResponse = (message, perms) => {
  const lower = message.toLowerCase();
  if ((lower.includes('delete') || lower.includes('remove user') || lower.includes('permission')) &&
      !hasPermission(perms, 'manage_permissions'))
    return "I'm sorry, but that action requires admin permissions. Please contact your administrator for assistance.";
  if ((lower.includes('team report') || lower.includes('team performance')) &&
      !hasPermission(perms, 'view_team_data'))
    return "You don't have permission to view team data. This feature is available to managers and admins.";
  if ((lower.includes('analytics') || lower.includes('advanced report')) &&
      !hasPermission(perms, 'view_analytics'))
    return "Analytics features require special permissions. Please contact your manager to request access.";
  return null;
};

// Keyword → responder pairs (order matters — first match wins)
const OFFLINE_RULES = [
  { test: /(scorecard|performance|metric|kpi)/,           reply: p => "You can view your scorecard performance on the Dashboard page. Would you like help understanding any specific metrics?" },
  { test: /(coach|skill|development|training)/,           reply: p => "The Coach page shows your skill development progress. Focus on your lowest-performing skillsets for the biggest impact!" },
  { test: /(contest|competition|leaderboard)/,            reply: p => "Check out the Contests page to join competitions and compete with your team. Contests are a great way to boost motivation!" },
  { test: /(badge|achievement|award|unlock)/,             reply: p => "View your badges and achievements in your Profile. Keep hitting your targets to unlock more!" },

  // ── Engage: Tab-specific responses ─────────────────────────────────────────
  { test: /(sequence|cadence|outreach sequence|multi.?step)/,
    reply: p => "The **Sequences** tab in Engage lets you build multi-step outreach cadences across email, LinkedIn, and calls. You can set timing, auto-skip replied prospects, and use AI to generate step content. Try creating a 5-step sequence for your top ICP!" },
  { test: /(pipeline operator|deal risk|forecast|pipeline monitor)/,
    reply: p => "The **Pipeline Operator** in Engage monitors your deals for risks, flags stalled opportunities, and generates AI forecasts. It's your command center for pipeline health — check it daily to catch at-risk deals early." },
  { test: /(signal|intent signal|buying signal|signal prospecting)/,
    reply: p => "The **Signal Prospecting** tab detects high-intent buying signals like funding events, hiring surges, and competitor engagement. Act on signals within 24 hours for the best conversion rates!" },
  { test: /(watchdog|kpi watchdog|anomaly|coaching trigger)/,
    reply: p => "The **KPI Watchdog** on the Analytics page monitors your KPIs for anomalies and auto-triggers coaching suggestions when metrics dip. It's like having a coach watching your numbers 24/7. Go to Analytics → KPI Watchdog tab to check it out." },
  // ── Coaching Framework-aware responses ──────────────────────────────────────
  { test: /(objection|pushback|they said no|all set|no budget)/,
    reply: () => "Try the **Feel, Felt, Found** technique: \"I understand you feel [X]. Many others felt the same. What they found was...\" — this acknowledges their concern while pivoting to social proof. Click **Handle Objection** above for AI-powered coaching!" },
  { test: /(call prep|cold call|phone call|call structure|before my call)/,
    reply: () => "Great call prep framework: **Powerful Intro** → **Reason for Call** (trigger-based, never \"just checking in\") → **Call to Action** (\"What's the best way to get 15 minutes?\"). Click **Call Prep** above for a full structured plan!" },
  { test: /(urgency|stalled|stuck deal|speed up|close faster)/,
    reply: () => "To create urgency, ask: 1) \"What does your prospect feel is most at risk?\" 2) \"What are their primary fears?\" 3) Articulate the **risk of inaction** — the cost of doing nothing. This reframes the decision from \"should we buy?\" to \"can we afford NOT to?\"" },
  { test: /(value|roi|business case|justify|too expensive)/,
    reply: () => "Remember: **defining the value of the problem is more important than your solution**. Get the prospect to quantify what the problem costs them — once they admit the cost, there's significant contrast between problem cost and your solution price." },

  { test: /(discover|company research|prospect research|find compan)/,
    reply: p => "The **Discover** tab in Engage gives you AI-powered prospect and company research. Search for any company to get firmographics, org charts, and personalized outreach recommendations." },
  { test: /(account intelligence|account scoring|buying committee|account tier)/,
    reply: p => "The **Accounts** tab in Engage lets you score and tier accounts, map buying committees, and get AI strategy recommendations. Build a buying committee map for your Tier 1 accounts to boost win rates!" },
  { test: /(playbook|ai playbook|playbook builder|sales play)/,
    reply: p => "The **Playbooks** tab in Engage lets you create and execute AI-generated sales playbooks. Playbooks can be triggered by signals, pipeline stages, or account events. Great for standardizing your best plays!" },
  { test: /(prompt library|prompt template|outbound prompt|ai prompt|prompt)/,
    reply: p => "The **Prompt Library** tab in Engage contains battle-tested AI prompt templates for outbound sales:\n\n• **Research prompts** — Account research, 10-minute research rule, buying committee mapping (ChatGPT & Claude)\n• **Outreach prompts** — Multi-angle strategy, first email drafts (ChatGPT & Claude)\n• **Analysis prompts** — Reply interpretation & subtext reading (Claude)\n• **Follow-up prompts** — Intentional follow-ups without pressure (ChatGPT)\n• **Deliverability** — Spam review & domain protection (ChatGPT)\n\n**Core rule:** Never ask AI to write an email first. Always research → angles → draft → analyze → review. You can also create your own custom prompts!" },
  { test: /(engage|prospect|outreach|research|company)/,
    reply: p => "Apptivia Engage is your AI-powered sales intelligence hub with 7 tabs:\n• **Pipeline Operator** — Deal monitoring & forecasts\n• **Signal Prospecting** — Intent signal detection\n• **Discover** — Prospect & company research\n• **Sequences** — Multi-step outreach cadences\n• **Accounts** — Account intelligence & scoring\n• **Playbooks** — AI sales playbooks\n• **Prompt Library** — Battle-tested AI prompt templates\n\n**KPI Watchdog** has moved to the Analytics page for a better experience alongside your KPI metrics.\n\nWhich tab would you like to know more about?" },

  { test: /(notification|alert|bell)/,                    reply: p => "You can manage your notifications from the bell icon in the top navigation bar. Adjust your preferences in Settings." },
  { test: /(team|member|group)/,                          reply: p =>
      hasPermission(p, 'view_team_data')
        ? "As a team leader, you can track your team's performance across all pages. Use filters to focus on specific members."
        : "Team features are available to managers and admins. Focus on your individual performance to contribute to team success!" },
  { test: /(settings|profile|account|password change)/,   reply: p => "You can update your profile and settings from the Settings page accessible via the sidebar navigation." },
  { test: /(help|how|what can you|guide)/,                reply: p =>
      "I can help you with:\n• Understanding your scorecard metrics\n• Tracking badges & achievements\n• Navigating the platform\n• Contest information\n• **Engage** — Sequences, Signals, Accounts, Playbooks, Pipeline, Prompt Library\n• Team performance (managers)\n\nWhat would you like to know more about?" },
  { test: /(thank|thanks|appreciate)/,                    reply: p => "You're welcome! I'm here to help you succeed. Feel free to ask me anything!" },
  { test: /(hello|hi |hey|good morning|good afternoon)/,  reply: p => "Hello! How can I help you today? Ask me about your scorecard, skills, contests, or any Engage feature — sequences, signals, accounts, playbooks, and more." },
];

const generateOfflineResponse = (message, perms) => {
  const restricted = getPermissionRestrictedResponse(message, perms);
  if (restricted) return restricted;

  const lower = message.toLowerCase();
  for (const rule of OFFLINE_RULES) {
    if (rule.test.test(lower)) return rule.reply(perms);
  }
  return "I'm here to help you improve your performance! Ask me about your scorecard, skills, contests, Engage tools (sequences, signals, accounts, playbooks), or how to use any feature. What would you like to know?";
};

// ─── Persistence helpers ─────────────────────────────────────────────────────
const loadMessages = (userId) => {
  try {
    const key = userId ? `${STORAGE_KEY}.${userId}` : STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return null; }
};

const saveMessages = (msgs, userId) => {
  try {
    const key = userId ? `${STORAGE_KEY}.${userId}` : STORAGE_KEY;
    const trimmed = msgs.slice(-MAX_PERSISTED);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch { /* quota exceeded — silently skip */ }
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ChatBubble = memo(({ msg, onOptionSelect, isLastAaron, isTyping }) => {
  const isUser = msg.sender === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-800 border border-gray-200'
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-line">{msg.text}</p>
        ) : (
          <div className="text-sm aaron-markdown">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h3 className="text-sm font-bold text-gray-900 mt-2 mb-1">{children}</h3>,
                h2: ({ children }) => <h3 className="text-sm font-bold text-gray-900 mt-2 mb-1">{children}</h3>,
                h3: ({ children }) => <h4 className="text-xs font-bold text-gray-800 mt-1.5 mb-0.5">{children}</h4>,
                p: ({ children }) => <p className="text-sm mb-1.5 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="text-sm ml-3 mb-1.5 space-y-0.5 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm ml-3 mb-1.5 space-y-0.5 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                code: ({ children }) => <code className="text-xs bg-gray-100 text-blue-700 px-1 py-0.5 rounded">{children}</code>,
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        )}
        {!isUser && msg.frameworks?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {msg.frameworks.map((fw, i) => (
              <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                {fw}
              </span>
            ))}
          </div>
        )}
        <span className="text-xs opacity-70 mt-1 block">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!isUser && msg.options?.length > 0 && isLastAaron && (
          <OptionChips options={msg.options} onSelect={onOptionSelect} disabled={isTyping} />
        )}
      </div>
    </div>
  );
});
ChatBubble.displayName = 'ChatBubble';

const TypingIndicator = memo(() => (
  <div className="flex justify-start">
    <div className="bg-white text-gray-800 border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
));
TypingIndicator.displayName = 'TypingIndicator';

const OptionChips = memo(({ options, onSelect, disabled }) => (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {options.map((opt, i) => (
      <button
        key={i}
        onClick={() => onSelect(opt.value)}
        disabled={disabled}
        className="text-xs px-3 py-1.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {opt.label}
      </button>
    ))}
  </div>
));
OptionChips.displayName = 'OptionChips';

// ─── Main Component ──────────────────────────────────────────────────────────

const STARTER_PRESET_LABELS = ['Coach Me', 'My Performance'];

const AaronChatbot = ({ isOpen, onClose }) => {
  const { user, profile, role } = useAuth();
  const { plan: billingPlan, status: billingStatus } = useBilling();
  const isStarterAaron = billingPlan === 'Basic' || billingStatus === 'expired';
  const [aaronDailyCount, setAaronDailyCount] = useState(0);
  const inputRef = useRef(null);

  // Resolve job title for title-specific presets
  const [titleKey, setTitleKey] = useState(null);
  useEffect(() => {
    if (!profile?.title_id) { setTitleKey(null); return; }
    supabase.from('titles').select('title_key').eq('id', profile.title_id).single()
      .then(({ data }) => setTitleKey(data?.title_key || null));
  }, [profile?.title_id]);

  // Stable permissions (only recalculated when role changes)
  const userPermissions = useMemo(() =>
    getEffectivePermissions({
      role: role || 'power_user',
      permissionOverrides: {},
      explicitPermissions: [],
    }),
  [role]);

  // Greeting message (only recalculated when user profile changes)
  const greetingMessage = useMemo(() => ({
    id: 'greeting',
    sender: 'aaron',
    text: `Hi${profile?.first_name ? ' ' + profile.first_name : ''}! I'm Aaron, your AI productivity coach. I'm here to help you with tasks within your permission level. How can I help you today?`,
    timestamp: new Date(),
  }), [profile?.first_name]);

  // State — initialize from localStorage (user-scoped), fall back to greeting
  const [messages, setMessages] = useState(() => loadMessages(user?.id) || [greetingMessage]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [useOfflineMode, setUseOfflineMode] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // connected | disconnected | reconnecting | failed
  const [contentWarning, setContentWarning] = useState('');
  const messagesEndRef = useRef(null);
  const offlineTimerRef = useRef(null);
  const prevUserIdRef = useRef(user?.id);

  // [FEATURE 1] Thread state (Pro+ only)
  const isPro = billingPlan !== 'Basic' && billingStatus !== 'expired';
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [showThreadSidebar, setShowThreadSidebar] = useState(false);
  const [renamingThreadId, setRenamingThreadId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // [FEATURE 5] Log Action state
  const [actionMsgId, setActionMsgId] = useState(null);
  const [actionType, setActionType] = useState('task_created');
  const [actionLabel, setActionLabel] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionToast, setActionToast] = useState('');
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [showOutcomePrompt, setShowOutcomePrompt] = useState(false);
  const outcomeShownRef = useRef(false);

  // Clear chat when user switches (same machine, different login)
  useEffect(() => {
    if (user?.id && user.id !== prevUserIdRef.current) {
      setMessages([greetingMessage]);
      prevUserIdRef.current = user.id;
    }
  }, [user?.id, greetingMessage]);

  // Persist messages to localStorage (user-scoped) whenever they change
  useEffect(() => { saveMessages(messages, user?.id); }, [messages, user?.id]);

  // Show outcome prompt after 6+ messages (once per session)
  useEffect(() => {
    if (outcomeShownRef.current || !activeThreadId) return;
    const userMsgCount = messages.filter(m => m.sender === 'user').length;
    if (userMsgCount >= 6) {
      setShowOutcomePrompt(true);
      outcomeShownRef.current = true;
    }
  }, [messages, activeThreadId]);

  const tagOutcome = useCallback(async (threadId, outcomeTag) => {
    try {
      await backendFetch(`/api/aaron/threads/${threadId}/outcome`, { outcome_tag: outcomeTag });
    } catch (err) {
      console.error('[Aaron] outcome tag failed:', err);
    }
    setShowOutcomePrompt(false);
  }, []);

  // Auto-dismiss content warnings after 4 seconds
  useEffect(() => {
    if (!contentWarning) return;
    const t = setTimeout(() => setContentWarning(''), 4000);
    return () => clearTimeout(t);
  }, [contentWarning]);

  // ── Socket.io connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Ensure socket is connected (autoConnect is false)
    if (!socket.connected) socket.connect();

    const connectionTimeout = setTimeout(() => {
      if (!socket.connected) {
        setUseOfflineMode(true);
      }
    }, 3000);

    const onConnect = async () => {
      setIsConnected(true);
      setUseOfflineMode(false);
      setConnectionStatus('connected');
      clearTimeout(connectionTimeout);
      if (user?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        socket.emit('join', {
          userId: user.id,
          userName: profile?.first_name || 'User',
          role,
          permissions: userPermissions,
          token: session?.access_token,
        });
      }
    };

    const onDisconnect = (reason) => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.warn('[Aaron] Socket disconnected:', reason);
      // Only fall back to offline if server-initiated or transport error
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setUseOfflineMode(true);
      }
    };

    const onReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };

    const onReconnectFailed = () => {
      setConnectionStatus('failed');
      setUseOfflineMode(true);
    };

    const onAaronMessage = (data) => {
      setIsTyping(false);
      if (data.limitReached) {
        setAaronDailyCount(11); // Force over-limit display
      }
      const options = extractResponseOptions(data.message);
      setMessages(prev => [...prev, {
        id: nextId(),
        sender: 'aaron',
        text: data.message,
        timestamp: new Date(),
        ...(data.frameworks?.length ? { frameworks: data.frameworks } : {}),
        ...(options.length ? { options } : {}),
      }]);
    };

    const onAaronTyping = () => setIsTyping(true);

    const onPermissionDenied = (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: nextId(),
        sender: 'aaron',
        text: `⚠️ ${data.message || 'You do not have permission to perform this action.'}`,
        timestamp: new Date(),
      }]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('aaron_message', onAaronMessage);
    socket.on('aaron_typing', onAaronTyping);
    socket.on('permission_denied', onPermissionDenied);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect_failed', onReconnectFailed);

    // If already connected when effect runs
    if (socket.connected) onConnect();

    return () => {
      clearTimeout(connectionTimeout);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('aaron_message', onAaronMessage);
      socket.off('aaron_typing', onAaronTyping);
      socket.off('permission_denied', onPermissionDenied);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [isOpen, user?.id, profile?.first_name, role, userPermissions]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-focus input when panel opens or un-minimizes
  useEffect(() => {
    if (isOpen && !isMinimized) {
      // Small delay so the DOM has painted
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen, isMinimized]);

  // ── Handlers (stable references) ──────────────────────────────────────────

  const handleClearChat = useCallback(() => {
    // Cancel any pending offline response
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
    setIsTyping(false);
    setContentWarning('');
    setMessages([greetingMessage]);
  }, [greetingMessage]);

  const handleClearMemory = useCallback(async () => {
    try {
      await backendFetch('/api/aaron/memory', undefined, 'DELETE');
      setMessages(prev => [...prev, {
        id: nextId(),
        sender: 'aaron',
        text: "I've cleared my memory. I'll start fresh from our next conversation.",
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Failed to clear memory:', err);
    }
  }, []);

  // [FEATURE 1] Load thread list (Pro+ only)
  const loadThreads = useCallback(async () => {
    if (!isPro) return;
    try {
      const data = await backendFetch('/api/aaron/threads', undefined, 'GET');
      setThreads(data || []);
    } catch { /* non-fatal */ }
  }, [isPro]);

  useEffect(() => { if (isOpen && isPro) loadThreads(); }, [isOpen, isPro, loadThreads]);

  const handleNewThread = useCallback(async () => {
    try {
      const data = await backendFetch('/api/aaron/threads', {});
      if (data?.id) {
        setActiveThreadId(data.id);
        setMessages([greetingMessage]);
        // Re-join socket with new thread
        if (socket.connected && user?.id) {
          const { data: { session } } = await supabase.auth.getSession();
          socket.emit('join', { userId: user.id, userName: profile?.first_name || 'User', role, token: session?.access_token, threadId: data.id });
        }
        loadThreads();
      }
    } catch (err) { console.error('New thread error:', err); }
  }, [greetingMessage, user?.id, profile?.first_name, role, loadThreads]);

  const handleLoadThread = useCallback(async (threadId) => {
    try {
      const data = await backendFetch(`/api/aaron/threads/${threadId}`, undefined, 'GET');
      if (data?.messages) {
        setActiveThreadId(threadId);
        const loaded = data.messages.map((m, i) => ({
          id: `thread-${i}`, sender: m.role === 'user' ? 'user' : 'aaron', text: m.content, timestamp: new Date(m.ts || Date.now()),
        }));
        setMessages(loaded.length > 0 ? loaded : [greetingMessage]);
        // Re-join socket with loaded thread
        if (socket.connected && user?.id) {
          const { data: { session } } = await supabase.auth.getSession();
          socket.emit('join', { userId: user.id, userName: profile?.first_name || 'User', role, token: session?.access_token, threadId });
        }
      }
    } catch (err) { console.error('Load thread error:', err); }
  }, [greetingMessage, user?.id, profile?.first_name, role]);

  const handleDeleteThread = useCallback(async (threadId) => {
    if (!confirm('Delete this conversation?')) return;
    try {
      await backendFetch(`/api/aaron/threads/${threadId}`, undefined, 'DELETE');
      if (activeThreadId === threadId) { setActiveThreadId(null); setMessages([greetingMessage]); }
      loadThreads();
    } catch (err) { console.error('Delete thread error:', err); }
  }, [activeThreadId, greetingMessage, loadThreads]);

  const handleRenameThread = useCallback(async (threadId) => {
    if (!renameValue.trim()) { setRenamingThreadId(null); return; }
    try {
      await backendFetch(`/api/aaron/threads/${threadId}/name`, { thread_name: renameValue.trim() }, 'PATCH');
      setRenamingThreadId(null);
      loadThreads();
    } catch (err) { console.error('Rename error:', err); }
  }, [renameValue, loadThreads]);

  // [FEATURE 5] Log coaching action
  const handleLogAction = useCallback(async (aaronMessage) => {
    setActionSaving(true);
    try {
      const data = await backendFetch('/api/aaron/coaching-action', {
        action_type: actionType,
        action_label: actionLabel || undefined,
        thread_id: activeThreadId || undefined,
        metadata: { aaron_message: aaronMessage?.slice(0, 500) },
      });
      setActionToast(data?.crm_push_status === 'pending' ? 'Action logged — syncing to CRM...' : 'Action logged');
      setActionMsgId(null);
      setActionLabel('');
      setTimeout(() => setActionToast(''), 3000);
    } catch (err) {
      console.error('Log action error:', err);
    } finally {
      setActionSaving(false);
    }
  }, [actionType, actionLabel, activeThreadId]);

  // 4B: Send a message (shared by form submit and preset click)
  const sendMessage = useCallback((text, presetLabel) => {
    if (isStarterAaron) setAaronDailyCount(prev => prev + 1);
    const userMsg = { id: nextId(), sender: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    if (isConnected && !useOfflineMode) {
      socket.emit('chat_message', {
        userId: user?.id,
        message: text,
        role,
        permissions: userPermissions,
        context: { page: window.location.pathname, userName: profile?.first_name || 'User', organizationId: profile?.organization_id || null },
        ...(presetLabel ? { rolePreset: presetLabel } : {}),
      });
      setIsTyping(true);
    } else {
      setIsTyping(true);
      offlineTimerRef.current = setTimeout(() => {
        const response = generateOfflineResponse(text, userPermissions);
        setIsTyping(false);
        setMessages(prev => [...prev, { id: nextId(), sender: 'aaron', text: response, timestamp: new Date() }]);
        offlineTimerRef.current = null;
      }, 600 + Math.random() * 800);
    }
  }, [isConnected, useOfflineMode, user?.id, role, userPermissions, profile?.first_name]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setContentWarning('');

    // Content filter
    const check = filterContent(trimmed);
    if (!check.isClean) {
      const warning = WARNING_MAP[check.reason] || 'Your message contains inappropriate content.';
      setContentWarning(warning);
      setMessages(prev => [...prev, { id: nextId(), sender: 'aaron', text: `⚠️ ${warning}`, timestamp: new Date() }]);
      setInputValue('');
      return;
    }

    setInputValue('');
    sendMessage(trimmed);
  }, [inputValue, sendMessage]);

  // 4B: Preset click — auto-send the preset prompt
  const handlePresetClick = useCallback((preset) => {
    if (isTyping) return; // don't stack requests
    sendMessage(preset.prompt, preset.label);
  }, [isTyping, sendMessage]);

  // Keyboard shortcut: Escape to close / minimize
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isMinimized) setIsMinimized(true);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isMinimized, onClose]);

  // Clean up offline timer on unmount
  useEffect(() => () => {
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 flex ${
        isMinimized ? 'w-80 h-16' : showThreadSidebar ? 'w-[640px] sm:w-[720px] h-[500px] sm:h-[560px]' : 'w-80 sm:w-96 h-[500px] sm:h-[560px]'
      }`}>
        {/* [FEATURE 1] Thread Sidebar — Pro+ only */}
        {showThreadSidebar && !isMinimized && isPro && (
          <div className="w-48 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
            <div className="p-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">Threads</span>
              <div className="flex items-center gap-1">
                <button onClick={handleNewThread} title="New chat" className="p-1 hover:bg-gray-200 rounded"><MessageSquarePlus size={14} className="text-gray-600" /></button>
                <button onClick={() => setShowThreadSidebar(false)} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft size={14} className="text-gray-600" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {threads.map(t => (
                <div
                  key={t.id}
                  className={`px-2 py-1.5 cursor-pointer flex items-center group text-xs border-b border-gray-100 ${activeThreadId === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
                  onClick={() => handleLoadThread(t.id)}
                >
                  {renamingThreadId === t.id ? (
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameThread(t.id)}
                      onKeyDown={e => e.key === 'Enter' && handleRenameThread(t.id)}
                      className="flex-1 text-xs px-1 py-0.5 border rounded"
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="flex-1 truncate">{t.thread_name || 'Untitled'}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button onClick={e => { e.stopPropagation(); setRenamingThreadId(t.id); setRenameValue(t.thread_name || ''); }} className="p-0.5 hover:bg-gray-200 rounded"><Pencil size={10} /></button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteThread(t.id); }} className="p-0.5 hover:bg-red-100 rounded text-red-500"><Trash size={10} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {threads.length === 0 && <p className="text-[10px] text-gray-400 p-2 text-center">No saved threads</p>}
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between select-none">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsMinimized(m => !m)}>
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white font-bold shadow-md relative">
                A
                <Sparkles size={8} className="absolute -top-0.5 -right-0.5 text-yellow-300" />
              </div>
              <div>
                <div className="font-semibold text-sm">Aaron AI Coach</div>
                <div className="flex items-center gap-2 text-xs text-blue-100">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  {isConnected ? 'Live' : 'Offline Mode'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* [FEATURE 1] Thread toggle */}
              {isPro && !isMinimized && (
                <button
                  onClick={() => setShowThreadSidebar(s => !s)}
                  aria-label="Toggle threads"
                  title="Conversation threads"
                  className="text-white opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                >
                  {showThreadSidebar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              <button
                onClick={() => setMemoryPanelOpen(true)}
                aria-label="View Aaron's memory"
                title="View Aaron's memory"
                className="text-white opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
              >
                <Brain size={14} />
              </button>
              <button
                onClick={handleClearMemory}
                aria-label="Clear Aaron's memory"
                title="Clear Aaron's memory"
                className="text-white opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={handleClearChat}
                aria-label="Clear chat"
                title="Clear chat"
                className="text-white opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => setIsMinimized(m => !m)}
                aria-label={isMinimized ? 'Maximize' : 'Minimize'}
                className="text-white opacity-90 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-white opacity-90 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          {!isMinimized && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* [FEATURE 5] Action toast */}
              {actionToast && (
                <div className="px-4 py-1.5 bg-green-50 border-b border-green-200 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle size={12} /> {actionToast}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                {messages.map((msg, idx) => {
                  const isLastAaron = msg.sender === 'aaron' && !messages.slice(idx + 1).some(m => m.sender === 'aaron');
                  return (
                    <div key={msg.id}>
                      <ChatBubble
                        msg={msg}
                        onOptionSelect={(text) => sendMessage(text)}
                        isLastAaron={isLastAaron}
                        isTyping={isTyping}
                      />
                      {/* [FEATURE 5] Log Action button — appears on hover of Aaron messages */}
                      {msg.sender === 'aaron' && msg.id !== 'greeting' && (
                        <div className="flex justify-start mt-0.5 group">
                          {actionMsgId === msg.id ? (
                            <div className="bg-white border border-gray-200 rounded-lg p-2 ml-0 mt-1 text-xs shadow-sm w-64">
                              <select
                                value={actionType}
                                onChange={e => setActionType(e.target.value)}
                                className="w-full px-2 py-1 border rounded text-xs mb-1.5"
                              >
                                <option value="task_created">Task</option>
                                <option value="call_logged">Call</option>
                                <option value="meeting_scheduled">Meeting</option>
                                <option value="note_added">Note</option>
                                <option value="follow_up_set">Follow-up</option>
                              </select>
                              <input
                                value={actionLabel}
                                onChange={e => setActionLabel(e.target.value)}
                                placeholder="Action label (auto-generated if empty)"
                                className="w-full px-2 py-1 border rounded text-xs mb-1.5"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleLogAction(msg.text)}
                                  disabled={actionSaving}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {actionSaving ? 'Saving...' : 'Log it'}
                                </button>
                                <button onClick={() => setActionMsgId(null)} className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setActionMsgId(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 hover:text-blue-600 ml-1 mt-0.5"
                            >
                              Log Action
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* [FEATURE 3] Upgrade prompt when daily limit reached */}
                {aaronDailyCount > 10 && isStarterAaron && (
                  <UpgradePrompt variant="aaron_limit" context="inline" />
                )}

                {/* Outcome tagging prompt after 6+ user messages */}
                {showOutcomePrompt && activeThreadId && (
                  <div className="mx-4 mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p className="text-xs text-indigo-700 font-medium mb-2">How did this session go?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { tag: 'applied_in_call', label: 'Applied on a call' },
                        { tag: 'created_action', label: 'Created an action item' },
                        { tag: 'shared_with_manager', label: 'Shared with manager' },
                        { tag: 'needs_followup', label: 'Need to revisit' },
                      ].map(({ tag, label }) => (
                        <button
                          key={tag}
                          onClick={() => tagOutcome(activeThreadId, tag)}
                          className="px-2.5 py-1 text-xs rounded-full border border-indigo-200 hover:bg-indigo-100 text-indigo-700 bg-white transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Starter thread upsell tooltip */}
              {!isPro && !isMinimized && messages.length > 4 && (
                <div className="shrink-0 px-3 py-1.5 bg-purple-50 border-t border-purple-100 text-center">
                  <span className="text-[10px] text-purple-600">Thread history is a Pro feature — <a href="/organization-settings" className="underline hover:text-purple-800">Upgrade</a></span>
                </div>
              )}

              {/* 4B: Title/Role Preset Buttons — Starter: 2 generic only */}
              {(() => {
                const allPresets = (titleKey && TITLE_PRESETS[titleKey]) || ROLE_PRESETS[role];
                const presets = isStarterAaron
                  ? allPresets?.filter(p => STARTER_PRESET_LABELS.includes(p.label))
                  : allPresets;
                return presets?.length && !isTyping && messages.length <= 2 ? (
                  <div className="shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {presets.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handlePresetClick(preset)}
                        className="text-xs px-3 py-1.5 rounded-full border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {isStarterAaron && (
                      <span className="text-[10px] text-gray-400 self-center ml-1">Upgrade for all presets</span>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Input Area */}
              <div className="shrink-0 px-4 py-2 bg-white border-t border-gray-200">
                {contentWarning && (
                  <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-center justify-between">
                    <span>{contentWarning}</span>
                    <button onClick={() => setContentWarning('')} className="ml-2 text-yellow-600 hover:text-yellow-800">
                      <X size={12} />
                    </button>
                  </div>
                )}
                {connectionStatus === 'reconnecting' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 rounded-t-lg">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Reconnecting to Aaron...
                  </div>
                )}
                {connectionStatus === 'failed' && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-red-50 border-t border-red-200 text-xs text-red-700 rounded-t-lg">
                    <span>Connection lost. Please refresh the page.</span>
                    <button onClick={() => window.location.reload()} className="underline font-medium">Refresh</button>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    aria-label="Ask Aaron for help"
                    placeholder={connectionStatus === 'connected' || useOfflineMode ? 'Ask Aaron for help...' : 'Reconnecting...'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={connectionStatus === 'reconnecting' || connectionStatus === 'failed'}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    maxLength={MAX_MESSAGE_LENGTH}
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || connectionStatus === 'reconnecting' || connectionStatus === 'failed'}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send size={16} />
                  </button>
                </form>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-gray-500">
                    {useOfflineMode ? (
                      <span className="flex items-center gap-1">
                        <Shield size={10} />
                        Offline • Esc to minimize
                      </span>
                    ) : isStarterAaron ? (
                      <span className="text-gray-400">
                        {Math.min(aaronDailyCount, 10)}/10 today · <a href="/organization-settings" className="text-blue-500 hover:underline">Upgrade for unlimited</a>
                      </span>
                    ) : (
                      'Connected to live server'
                    )}
                  </p>
                  <span className={`text-[10px] ${inputValue.length > MAX_MESSAGE_LENGTH - 50 ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                    {inputValue.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AaronMemoryPanel isOpen={memoryPanelOpen} onClose={() => setMemoryPanelOpen(false)} />
    </div>
  );
};

export default memo(AaronChatbot);
