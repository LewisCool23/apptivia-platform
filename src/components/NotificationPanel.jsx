import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, X, Trophy, Award, TrendingUp, AlertTriangle, Flame, Plug, Star } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';

export default function NotificationPanel() {
    const getTypeIcon = (type) => {
      switch (type) {
        case 'performance':
          return { icon: Trophy, bg: 'bg-yellow-100', fg: 'text-yellow-700' };
        case 'badge':
          return { icon: Award, bg: 'bg-blue-100', fg: 'text-blue-700' };
        case 'achievement':
          return { icon: Star, bg: 'bg-purple-100', fg: 'text-purple-700' };
        case 'contest':
          return { icon: Trophy, bg: 'bg-green-100', fg: 'text-green-700' };
        case 'trend':
          return { icon: TrendingUp, bg: 'bg-indigo-100', fg: 'text-indigo-700' };
        case 'streak':
          return { icon: Flame, bg: 'bg-orange-100', fg: 'text-orange-700' };
        case 'integration':
          return { icon: Plug, bg: 'bg-gray-100', fg: 'text-gray-700' };
        case 'coaching':
          return { icon: AlertTriangle, bg: 'bg-red-100', fg: 'text-red-700' };
        default:
          return { icon: Bell, bg: 'bg-slate-100', fg: 'text-slate-700' };
      }
    };

  const navigate = useNavigate();
  const { role, user } = useAuth();
  const {
    notifications,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
    panelOpen,
    closePanel,
  } = useNotifications();

  const showRep = role === 'admin' || role === 'manager';

  const formatRepName = (value) => {
    if (!value) return 'Unknown';
    const raw = String(value);
    if (!raw.includes('@')) return raw;
    const local = raw.split('@')[0];
    const words = local.split(/[._-]+/).filter(Boolean);
    if (words.length === 0) return raw;
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleNavigate = (link, id) => {
    if (!link) return;
    markRead(id);
    closePanel();

    const [path, hash] = link.split('#');
    if (path) navigate(path);

    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity ${
          panelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closePanel}
        aria-hidden={!panelOpen}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-[420px] max-w-[95vw] bg-white shadow-lg border-l z-50 transition-transform duration-300 ${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Notifications"
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Bell size={16} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base text-gray-900">Notifications</h2>
                <p className="text-[11px] text-gray-500">Latest updates</p>
              </div>
            </div>
            <button
              onClick={closePanel}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              aria-label="Close notifications"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="px-4 pt-3 pb-2 flex items-center justify-between text-[11px] text-gray-500">
          <span>{notifications.length} total</span>
          <div className="flex items-center gap-2">
            <button onClick={markAllRead} className="hover:text-gray-700">Mark all read</button>
            <button onClick={clearAll} className="hover:text-gray-700">Clear</button>
          </div>
        </div>
        <div className="p-3 text-sm text-gray-700 overflow-y-auto h-[calc(100%-120px)]">
          {notifications.length === 0 ? (
            <div className="text-xs text-gray-500">No notifications yet.</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const meta = getTypeIcon(n.type);
                const Icon = meta.icon;
                const shouldShowRep = role === 'admin' || role === 'manager';
                const repRaw = n.repName || n.ownerName || (String(n.ownerId) === String(user?.id) ? 'You' : 'Unknown');
                const repLabel = formatRepName(repRaw);
                return (
                <div
                  key={n.id}
                  className={`border rounded-lg p-2 transition-all ${n.read ? 'bg-white' : 'bg-blue-50 border-blue-100'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.bg} ${meta.fg} shrink-0`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-900">{n.title}</div>
                      {shouldShowRep && (
                        <div className="text-[11px] text-gray-500 mt-0.5">Rep: {repLabel}</div>
                      )}
                      <div className="text-[11px] text-gray-600 mt-0.5">{n.message}</div>
                      {n.link && (
                        <button
                          onClick={() => handleNavigate(n.link, n.id)}
                          className="mt-1 text-[11px] text-blue-600 hover:underline"
                        >
                          View details
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        aria-label="Mark read"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => removeNotification(n.id)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
