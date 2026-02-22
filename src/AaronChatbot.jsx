import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Send, X, Minimize2, Maximize2, Shield, Trash2, RotateCcw } from 'lucide-react';
import socket from './socket';
import { useAuth } from './AuthContext';
import { hasPermission, getEffectivePermissions } from './permissions';
import { supabase } from './supabaseClient';

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'apptivia.aaronChat';
const MAX_PERSISTED = 50;
const MAX_MESSAGE_LENGTH = 500;

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
const loadMessages = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return null; }
};

const saveMessages = (msgs) => {
  try {
    const trimmed = msgs.slice(-MAX_PERSISTED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* quota exceeded — silently skip */ }
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ChatBubble = memo(({ msg }) => {
  const isUser = msg.sender === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-800 border border-gray-200'
      }`}>
        <p className="text-sm whitespace-pre-line">{msg.text}</p>
        <span className="text-xs opacity-70 mt-1 block">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
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

// ─── Main Component ──────────────────────────────────────────────────────────

const AaronChatbot = ({ isOpen, onClose }) => {
  const { user, profile, role } = useAuth();
  const inputRef = useRef(null);

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

  // State — initialize from localStorage, fall back to greeting
  const [messages, setMessages] = useState(() => loadMessages() || [greetingMessage]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [useOfflineMode, setUseOfflineMode] = useState(true);
  const [contentWarning, setContentWarning] = useState('');
  const messagesEndRef = useRef(null);
  const offlineTimerRef = useRef(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => { saveMessages(messages); }, [messages]);

  // Auto-dismiss content warnings after 4 seconds
  useEffect(() => {
    if (!contentWarning) return;
    const t = setTimeout(() => setContentWarning(''), 4000);
    return () => clearTimeout(t);
  }, [contentWarning]);

  // ── Socket.io connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const connectionTimeout = setTimeout(() => {
      if (!socket.connected) {
        setUseOfflineMode(true);
      }
    }, 3000);

    const onConnect = async () => {
      setIsConnected(true);
      setUseOfflineMode(false);
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

    const onDisconnect = () => {
      setIsConnected(false);
      setUseOfflineMode(true);
    };

    const onAaronMessage = (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: nextId(),
        sender: 'aaron',
        text: data.message,
        timestamp: new Date(),
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

    // If already connected when effect runs
    if (socket.connected) onConnect();

    return () => {
      clearTimeout(connectionTimeout);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('aaron_message', onAaronMessage);
      socket.off('aaron_typing', onAaronTyping);
      socket.off('permission_denied', onPermissionDenied);
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

    // Add user message
    const userMsg = { id: nextId(), sender: 'user', text: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    if (isConnected && !useOfflineMode) {
      socket.emit('chat_message', {
        userId: user?.id,
        message: trimmed,
        role,
        permissions: userPermissions,
        context: { page: window.location.pathname, userName: profile?.first_name || 'User' },
      });
      setIsTyping(true);
    } else {
      setIsTyping(true);
      offlineTimerRef.current = setTimeout(() => {
        const response = generateOfflineResponse(trimmed, userPermissions);
        setIsTyping(false);
        setMessages(prev => [...prev, { id: nextId(), sender: 'aaron', text: response, timestamp: new Date() }]);
        offlineTimerRef.current = null;
      }, 600 + Math.random() * 800);
    }
  }, [inputValue, isConnected, useOfflineMode, user?.id, role, userPermissions, profile?.first_name]);

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
      <div className={`bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
        isMinimized ? 'w-80 h-16' : 'w-80 sm:w-96 h-[500px] sm:h-[560px]'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between select-none">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsMinimized(m => !m)}>
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              A
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
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

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
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  aria-label="Ask Aaron for help"
                  placeholder="Ask Aaron for help..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
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
  );
};

export default memo(AaronChatbot);
