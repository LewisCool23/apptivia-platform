import React, { useState, useRef } from 'react';
import { X, Download, Link as LinkIcon, CheckCircle, Mail } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function ShareScorecardSnapshotModal({ isOpen, onClose, scorecardData, filters }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailNotes, setEmailNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const snapshotRef = useRef(null);

  if (!isOpen || !scorecardData) return null;

  const teamAverage = scorecardData?.teamAverage || 0;
  const totalMembers = scorecardData?.totalMembers || 0;
  const dateRange = scorecardData?.dateRange || 'This Week';
  const topPerformers = scorecardData?.topPerformers?.slice(0, 5) || [];
  const needsImprovement = scorecardData?.needsImprovement?.slice(0, 5) || [];
  const scoreDistribution = scorecardData?.scoreDistribution || { excellent: 0, good: 0, fair: 0, poor: 0 };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const element = snapshotRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `apptivia-scorecard-snapshot-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading snapshot:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/dashboard`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!emailRecipients.trim()) {
      setEmailError('Please enter at least one recipient email address');
      return;
    }

    setSending(true);
    setEmailError('');

    try {
      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(e => e);
      const subject = emailSubject.trim() || `Apptivia Weekly Scorecard Snapshot`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
            .stats { display: grid; grid-template-columns: 1fr; gap: 15px; margin: 20px 0; }
            .stat-box { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 32px; font-weight: bold; color: #3b82f6; }
            .stat-label { font-size: 14px; color: #6b7280; }
            .performers { margin: 20px 0; }
            .performer-item { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #10b981; }
            .improvement-item { background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #f59e0b; }
            .notes { background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Weekly Scorecard Snapshot</h1>
              <p>Apptivia Platform</p>
              <p style="font-size: 14px; opacity: 0.9;">${dateRange} • ${totalMembers} Team Members</p>
            </div>
            
            <div class="stats">
              <div class="stat-box">
                <div class="stat-value">${teamAverage}%</div>
                <div class="stat-label">Team Average</div>
              </div>
            </div>

            <div style="margin: 20px 0; background: #f9fafb; padding: 15px; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px;">📈 Score Distribution</h3>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div style="text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #10b981;">${scoreDistribution.excellent}</div>
                  <div style="font-size: 12px; color: #6b7280;">Excellent (≥90%)</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${scoreDistribution.good}</div>
                  <div style="font-size: 12px; color: #6b7280;">Good (70-89%)</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${scoreDistribution.fair}</div>
                  <div style="font-size: 12px; color: #6b7280;">Fair (50-69%)</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${scoreDistribution.poor}</div>
                  <div style="font-size: 12px; color: #6b7280;">Needs Focus (&lt;50%)</div>
                </div>
              </div>
            </div>

            ${topPerformers.length > 0 ? `
              <div class="performers">
                <h3>🏆 Top Performers</h3>
                ${topPerformers.map((performer, idx) => `
                  <div class="performer-item">
                    <strong>${idx + 1}. ${performer.name || 'Team Member'}</strong>
                    <div style="font-size: 14px; color: #6b7280;">${performer.score}% (${performer.percentage || '0%'})</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${needsImprovement.length > 0 ? `
              <div class="performers">
                <h3>📈 Needs Improvement</h3>
                ${needsImprovement.map(member => `
                  <div class="improvement-item">
                    <strong>${member.name || 'Team Member'}</strong>
                    <div style="font-size: 14px; color: #6b7280;">${member.score}% (${member.percentage || '0%'})</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${emailNotes ? `
              <div class="notes">
                <strong>📝 Notes:</strong><br/>
                ${emailNotes.replace(/\n/g, '<br/>')}
              </div>
            ` : ''}

            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()}</p>
              <p>Apptivia Platform - Team Performance Tracking</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Apptivia Weekly Scorecard Snapshot

${dateRange} • Team Members: ${totalMembers}
Team Average: ${teamAverage}%

Score Distribution:
- Excellent (≥90%): ${scoreDistribution.excellent} members
- Good (70-89%): ${scoreDistribution.good} members
- Fair (50-69%): ${scoreDistribution.fair} members
- Needs Focus (<50%): ${scoreDistribution.poor} members

${topPerformers.length > 0 ? `Top Performers:\n${topPerformers.map((p, idx) => `${idx + 1}. ${p.name}: ${p.score}%`).join('\n')}` : ''}

${needsImprovement.length > 0 ? `Needs Improvement:\n${needsImprovement.map(m => `- ${m.name}: ${m.score}%`).join('\n')}` : ''}

${emailNotes ? `Notes:\n${emailNotes}` : ''}

Generated on ${new Date().toLocaleDateString()}
      `.trim();

      const response = await fetch('/api/send-snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients,
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      setEmailSuccess(true);
      setTimeout(() => {
        setEmailSuccess(false);
        setShowEmailForm(false);
        setEmailRecipients('');
        setEmailSubject('');
        setEmailNotes('');
      }, 3000);
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailError('Failed to send email. Please check your backend is running and configured correctly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-4 max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span>
            Share Weekly Scorecard Snapshot
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Snapshot Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
          <div 
            ref={snapshotRef}
            className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-2xl"
          >
            {/* Header Section */}
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📊</div>
              <h3 className="text-xl font-bold">Weekly Scorecard Snapshot</h3>
              <p className="text-white/80 text-sm">Apptivia Platform</p>
              <p className="text-white/70 text-xs mt-1">{dateRange} • {totalMembers} Team Members</p>
            </div>

            {/* Team Average */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 mb-3 text-center">
              <div className="text-3xl font-bold mb-1">{teamAverage}%</div>
              <div className="text-white/80 text-sm">Team Average</div>
            </div>

            {/* Score Distribution */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 mb-3">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span>📈</span>
                Score Distribution
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-green-200">{scoreDistribution.excellent}</div>
                  <div className="text-white/70 text-[10px]">Excellent (≥90%)</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-blue-200">{scoreDistribution.good}</div>
                  <div className="text-white/70 text-[10px]">Good (70-89%)</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-yellow-200">{scoreDistribution.fair}</div>
                  <div className="text-white/70 text-[10px]">Fair (50-69%)</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-red-200">{scoreDistribution.poor}</div>
                  <div className="text-white/70 text-[10px]">Needs Focus (&lt;50%)</div>
                </div>
              </div>
            </div>

            {/* Top Performers */}
            {topPerformers.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span>🏆</span>
                  Top Performers
                </h4>
                <div className="space-y-1.5">
                  {topPerformers.map((performer, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 flex items-center justify-between">
                      <span className="text-xs font-medium flex items-center gap-2">
                        <span className="text-yellow-300 font-bold">{idx + 1}.</span>
                        {performer.name || 'Team Member'}
                      </span>
                      <span className="text-xs font-bold">{performer.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Needs Improvement */}
            {needsImprovement.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span>📊</span>
                  Needs Improvement
                </h4>
                <div className="space-y-1.5">
                  {needsImprovement.map((member, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {member.name || 'Team Member'}
                      </span>
                      <span className="text-xs font-bold">{member.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Branding */}
            <div className="mt-4 pt-3 border-t border-white/20 text-center">
              <p className="text-white/60 text-xs">Generated on {new Date().toLocaleDateString()}</p>
              <p className="text-white/80 text-sm font-medium mt-0.5">apptivia.app</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
          {!showEmailForm ? (
            <>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} />
                  {downloading ? 'Downloading...' : 'Download'}
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <LinkIcon size={16} />
                      Copy Link
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowEmailForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <Mail size={16} />
                  Email
                </button>
              </div>

              <p className="text-center text-xs text-gray-500 mt-2">
                Share your scorecard snapshot with your team!
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Recipients (comma-separated emails)
                </label>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="john@example.com, jane@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Apptivia Weekly Scorecard Snapshot"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Additional notes (optional)
                </label>
                <textarea
                  value={emailNotes}
                  onChange={(e) => setEmailNotes(e.target.value)}
                  placeholder="Add highlights or focus areas for the week ahead"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {emailError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {emailError}
                </div>
              )}

              {emailSuccess && (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle size={16} />
                  Email sent successfully!
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail size={16} />
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
                <button
                  onClick={() => {
                    setShowEmailForm(false);
                    setEmailError('');
                    setEmailRecipients('');
                    setEmailSubject('');
                    setEmailNotes('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                An HTML email with scorecard stats will be sent to the recipients
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
