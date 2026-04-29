import React, { useState, useRef } from 'react';
import { X, Download, Mail, CheckCircle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { backendFetch } from '../../utils/backendFetch';
import { buildLabel } from '../../constants/kpiGuidance';
import { buildCoachingPlanEmailHtml, buildCoachingPlanEmailText } from '../../utils/emailTemplates';
import { statusConfig } from './planStatusConfig';

export default function ShareCoachingPlanSnapshotModal({ isOpen, onClose, plan, assigneeName }) {
  const [downloading, setDownloading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailNotes, setEmailNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const snapshotRef = useRef(null);

  if (!isOpen || !plan) return null;

  const isOverdue = plan.date_range_end && new Date() > new Date(plan.date_range_end) && plan.status !== 'completed';
  const displayStatus = isOverdue ? 'overdue' : (plan.status || 'draft');
  const cfg = statusConfig[displayStatus] || statusConfig.draft;
  const statusLabel = cfg.label;
  const statusColor = cfg.color;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const canvas = await html2canvas(snapshotRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `coaching-plan-${plan.name?.replace(/\s+/g, '-') || 'snapshot'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Snapshot download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipients.trim()) {
      setEmailError('Please enter at least one recipient email.');
      return;
    }
    setSending(true);
    setEmailError('');
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(e => emailRegex.test(e));
      if (recipients.length === 0) {
        setEmailError('No valid email addresses provided.');
        setSending(false);
        return;
      }
      const subject = emailSubject.trim() || `Coaching Plan: ${plan.name}`;

      // Generate image for email attachment
      const canvas = await html2canvas(snapshotRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      const imageBase64 = canvas.toDataURL('image/png');

      const html = buildCoachingPlanEmailHtml(plan, { additionalNotes: emailNotes });
      const text = buildCoachingPlanEmailText(plan, { additionalNotes: emailNotes });

      await backendFetch('/api/send-snapshot', {
        recipients,
        subject,
        html,
        text,
        imageBase64,
      });

      setEmailSuccess(true);
      setTimeout(() => { setEmailSuccess(false); setShowEmailForm(false); }, 2000);
    } catch (err) {
      console.error('Email send error:', err);
      setEmailError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <h3 className="text-base font-semibold text-apptivia-ink">Share Coaching Plan</h3>
          <button onClick={onClose} className="p-1 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 rounded-md hover:bg-apptivia-carbon-100">
            <X size={18} />
          </button>
        </div>

        {/* Snapshot Card */}
        <div className="px-6 py-4">
          <div ref={snapshotRef} className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-apptivia-coral-tone-300 uppercase tracking-wide">Coaching Plan</p>
                <h4 className="text-lg font-bold mt-0.5">{plan.name || 'Untitled Plan'}</h4>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            {assigneeName && (
              <p className="text-xs text-apptivia-coral-tone-300 mb-3">Assigned to: <span className="text-white font-medium">{assigneeName}</span></p>
            )}

            {plan.date_range_start && (
              <p className="text-[10px] text-apptivia-coral-tone-300 mb-3">
                {plan.date_range_start} — {plan.date_range_end || 'Ongoing'}
              </p>
            )}

            {/* Goals */}
            {plan.goals?.length > 0 && plan.goals[0] && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-apptivia-coral-tone-300 uppercase mb-1">Goals</p>
                <ul className="space-y-0.5">
                  {plan.goals.filter(Boolean).map((g, i) => (
                    <li key={i} className="text-xs text-apptivia-coral-tone-300 flex gap-1.5">
                      <span className="text-apptivia-coral-tone-300 shrink-0">-</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Focus KPIs */}
            {plan.focus_kpis?.length > 0 && plan.focus_kpis[0] && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-apptivia-coral-tone-300 uppercase mb-1">Focus KPIs</p>
                <div className="flex flex-wrap gap-1">
                  {plan.focus_kpis.filter(Boolean).map((k, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-apptivia-coral-tone-300 font-medium">
                      {buildLabel(k)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {plan.action_items?.length > 0 && plan.action_items[0] && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-apptivia-coral-tone-300 uppercase mb-1">Action Items</p>
                <ul className="space-y-0.5">
                  {plan.action_items.filter(Boolean).slice(0, 5).map((a, i) => (
                    <li key={i} className="text-xs text-apptivia-coral-tone-300 flex gap-1.5">
                      <span className="text-apptivia-coral-tone-300 shrink-0">-</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success Metrics */}
            {plan.success_metrics?.length > 0 && plan.success_metrics[0] && (
              <div>
                <p className="text-[10px] font-semibold text-apptivia-coral-tone-300 uppercase mb-1">Success Metrics</p>
                <ul className="space-y-0.5">
                  {plan.success_metrics.filter(Boolean).map((m, i) => (
                    <li key={i} className="text-xs text-apptivia-coral-tone-300 flex gap-1.5">
                      <span className="text-apptivia-coral-tone-300 shrink-0">-</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-[10px] text-apptivia-coral-tone-300">Powered by Apptivia Coach</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-3 border-t border-apptivia-carbon-100 bg-apptivia-paper rounded-b-xl">
          {!showEmailForm ? (
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-apptivia-coral text-white rounded-md hover:bg-apptivia-coral disabled:opacity-60"
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download PNG
              </button>
              <button
                onClick={() => setShowEmailForm(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-apptivia-carbon-700 border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-carbon-100"
              >
                <Mail size={14} />
                Send Email
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={emailRecipients}
                onChange={e => setEmailRecipients(e.target.value)}
                placeholder="recipient@email.com, another@email.com"
                className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder={`Subject: Coaching Plan — ${plan.name}`}
                className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                value={emailNotes}
                onChange={e => setEmailNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes..."
                className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEmailForm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-apptivia-carbon-600 border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-carbon-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-apptivia-coral text-white rounded-md hover:bg-apptivia-coral disabled:opacity-60"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : emailSuccess ? <CheckCircle size={14} /> : <Mail size={14} />}
                  {sending ? 'Sending...' : emailSuccess ? 'Sent!' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

