import React, { useState, useEffect, useCallback } from 'react';
import { X, ClipboardList, Check, Plus, RefreshCw, AlertTriangle, Calendar, Flag, Building2, User, Trash2, ExternalLink } from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import toast from 'react-hot-toast';

const PRIORITY_BADGES = {
  high:   { label: 'High',   color: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  low:    { label: 'Low',    color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600' },
};

const SOURCE_BADGES = {
  apptivia:   { label: 'Apptivia',   color: 'bg-apptivia-coral-tone-50 text-apptivia-coral' },
  salesforce: { label: 'Salesforce', color: 'bg-blue-50 text-blue-700' },
  hubspot:    { label: 'HubSpot',    color: 'bg-orange-50 text-orange-700' },
  outreach:   { label: 'Outreach',   color: 'bg-purple-50 text-purple-700' },
  salesloft:  { label: 'SalesLoft',  color: 'bg-teal-50 text-teal-700' },
};

const FILTER_TABS = [
  { key: 'mine', label: 'My Tasks' },
  { key: 'created', label: 'Created by Me' },
  { key: 'overdue', label: 'Overdue' },
];

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-600 bg-red-50' };
  if (diff === 0) return { text: 'Today', color: 'text-amber-600 bg-amber-50' };
  if (diff === 1) return { text: 'Tomorrow', color: 'text-emerald-600 bg-emerald-50' };
  if (diff <= 7) return { text: `${diff}d`, color: 'text-apptivia-carbon-600 bg-apptivia-carbon-100' };
  return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-apptivia-carbon-500 bg-apptivia-carbon-100' };
}

export default function TaskPanel({ isOpen, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('mine');
  const [showCreateInline, setShowCreateInline] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await backendFetch(`/api/tasks?filter=${filter}`, undefined, 'GET');
      setTasks(data || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (isOpen) fetchTasks();
  }, [isOpen, fetchTasks]);

  const handleComplete = async (taskId) => {
    try {
      await backendFetch(`/api/tasks/${taskId}/complete`, undefined, 'PATCH');
      toast.success('Task completed');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t));
    } catch {
      toast.error('Failed to complete task');
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await backendFetch(`/api/tasks/${taskId}`, undefined, 'DELETE');
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleQuickCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const data = await backendFetch('/api/tasks', { title: newTitle.trim() });
      if (data?.id) {
        setTasks(prev => [data, ...prev]);
        setNewTitle('');
        setShowCreateInline(false);
        toast.success('Task created');
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/5" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-50 border-l border-apptivia-carbon-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-apptivia-carbon-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-apptivia-ink" />
            <h3 className="font-semibold text-apptivia-ink text-sm">Tasks</h3>
            {activeTasks.length > 0 && (
              <span className="text-[10px] bg-apptivia-coral text-white px-1.5 py-0.5 rounded-full font-bold">
                {activeTasks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateInline(true)}
              className="text-apptivia-coral hover:text-apptivia-coral-tone-700 transition-colors"
              title="Create task"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={fetchTasks}
              className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
            <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-apptivia-carbon-100 bg-apptivia-paper">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-apptivia-ink text-white'
                  : 'text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick create */}
        {showCreateInline && (
          <div className="px-3 py-2 border-b border-apptivia-carbon-100 bg-apptivia-coral-tone-50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title..."
                className="flex-1 text-xs border border-apptivia-carbon-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-apptivia-coral/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickCreate();
                  if (e.key === 'Escape') { setShowCreateInline(false); setNewTitle(''); }
                }}
              />
              <button
                onClick={handleQuickCreate}
                disabled={creating || !newTitle.trim()}
                className="px-2 py-1.5 bg-apptivia-coral text-white text-[10px] font-medium rounded hover:bg-apptivia-coral/90 disabled:opacity-50"
              >
                {creating ? '...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowCreateInline(false); setNewTitle(''); }}
                className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-apptivia-carbon-400">
              <RefreshCw size={14} className="animate-spin mr-2" /> Loading tasks...
            </div>
          ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <ClipboardList size={28} className="text-apptivia-carbon-200 mb-3" />
              <p className="text-sm font-medium text-apptivia-carbon-500 mb-1">No tasks yet</p>
              <p className="text-[10px] text-apptivia-carbon-400">
                Create tasks from any contact or use the + button above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-apptivia-carbon-100">
              {activeTasks.map(task => {
                const due = formatDueDate(task.due_date);
                const pri = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;
                return (
                  <div key={task.id} className="px-3 py-2.5 hover:bg-apptivia-paper transition-colors group">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => handleComplete(task.id)}
                        className="mt-0.5 w-4 h-4 rounded border border-apptivia-carbon-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center flex-shrink-0 transition-colors"
                        title="Complete task"
                      >
                        <Check size={10} className="text-transparent group-hover:text-emerald-500" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-apptivia-ink leading-tight">{task.title}</p>
                        {task.description && (
                          <p className="text-[10px] text-apptivia-carbon-400 mt-0.5 truncate">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {due && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${due.color}`}>
                              <Calendar size={8} className="inline mr-0.5" />{due.text}
                            </span>
                          )}
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${pri.color}`}>
                            {pri.label}
                          </span>
                          {task.source && task.source !== 'apptivia' && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${SOURCE_BADGES[task.source]?.color || 'bg-apptivia-carbon-100 text-apptivia-carbon-600'}`}>
                              {SOURCE_BADGES[task.source]?.label || task.source}
                            </span>
                          )}
                          {task.prospect && (
                            <span className="text-[9px] text-apptivia-carbon-400 truncate max-w-[100px]" title={task.prospect.full_name || task.prospect.email}>
                              <User size={8} className="inline mr-0.5" />
                              {task.prospect.first_name || task.prospect.email}
                            </span>
                          )}
                          {task.account && (
                            <span className="text-[9px] text-apptivia-carbon-400 truncate max-w-[100px]" title={task.account.account_name}>
                              <Building2 size={8} className="inline mr-0.5" />
                              {task.account.account_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {task.external_url && (
                          <a
                            href={task.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 text-apptivia-carbon-300 hover:text-blue-500 transition-all"
                            title={`Open in ${SOURCE_BADGES[task.source]?.label || task.source}`}
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-apptivia-carbon-300 hover:text-red-500 transition-all"
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Completed section */}
              {completedTasks.length > 0 && (
                <>
                  <div className="px-3 py-2 bg-apptivia-carbon-100/30">
                    <span className="text-[10px] font-medium text-apptivia-carbon-400 uppercase">
                      Completed ({completedTasks.length})
                    </span>
                  </div>
                  {completedTasks.slice(0, 10).map(task => (
                    <div key={task.id} className="px-3 py-2 opacity-60 group hover:opacity-80 transition-opacity">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 w-4 h-4 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Check size={10} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-apptivia-carbon-500 line-through">{task.title}</p>
                        </div>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-apptivia-carbon-300 hover:text-red-500 transition-all flex-shrink-0"
                          title="Delete task"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
