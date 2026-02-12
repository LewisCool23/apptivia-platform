import React, { useState, useRef } from 'react';
import { X, Download, Link as LinkIcon, CheckCircle, Mail } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function ShareCoachSnapshotModal({ isOpen, onClose, coachData, scorecardData, filters }) {
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

  if (!isOpen || !coachData) return null;

  const { 
    apptiviaLevel, 
    levelPoints, 
    averageScore, 
    totalMembers = 0,
    totalBadges = 0,
    totalAchievements = 0,
    scorecardStreak = 0
  } = coachData;
  const allSkillsets = coachData.skillsetData || [];
  const topActions = allSkillsets.slice(0, 5);

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
      link.download = `apptivia-coach-snapshot-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading snapshot:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/coach`;
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
      const subject = emailSubject.trim() || `Apptivia Coach Snapshot`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
            .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .stat-box { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 32px; font-weight: bold; color: #3b82f6; }
            .stat-label { font-size: 14px; color: #6b7280; }
            .actions { margin: 20px 0; }
            .action-item { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #3b82f6; }
            .notes { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Coaching Progress Snapshot</h1>
              <p>Apptivia Platform</p>
              ${totalMembers > 0 ? `<p style="font-size: 14px; opacity: 0.9;">Team Members: ${totalMembers}</p>` : ''}
            </div>
            
            <div class="stats">
              <div class="stat-box">
                <div class="stat-value">${apptiviaLevel || 'N/A'}</div>
                <div class="stat-label">Apptivia Level</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${levelPoints || 0}</div>
                <div class="stat-label">Level Points</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${averageScore || 0}%</div>
                <div class="stat-label">Average Score</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${scorecardStreak}</div>
                <div class="stat-label">Scorecard Streak</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${totalBadges}</div>
                <div class="stat-label">Total Badges</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${totalAchievements}</div>
                <div class="stat-label">Achievements</div>
              </div>
            </div>

            ${allSkillsets.length > 0 ? `
              <div class="actions">
                <h3>🎯 Skillset Mastery Progress</h3>
                ${allSkillsets.map(skillset => `
                  <div class="action-item">
                    <strong>${skillset.skillset_name || skillset.name}</strong>
                    <div style="font-size: 14px; color: #6b7280;">Progress: ${Math.round(skillset.progress || 0)}% • Achievements: ${skillset.achievements_completed || 0} • Points: ${skillset.points || 0}</div>
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
              <p>Apptivia Platform - Coaching & Development</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Apptivia Coach Snapshot

Apptivia Level: ${apptiviaLevel || 'N/A'}
Level Points: ${levelPoints || 0}
Average Score: ${averageScore || 0}%
Scorecard Streak: ${scorecardStreak}
Total Badges: ${totalBadges}
Achievements: ${totalAchievements}
${totalMembers > 0 ? `Team Members: ${totalMembers}` : ''}

${allSkillsets.length > 0 ? `Skillset Mastery Progress:\n${allSkillsets.map(s => `- ${s.skillset_name || s.name}: ${Math.round(s.progress || 0)}% (${s.achievements_completed || 0} achievements, ${s.points || 0} pts)`).join('\n')}` : ''}

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
            <span>📋</span>
            Share Coach Snapshot
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
              <div className="text-4xl mb-2">📋</div>
              <h3 className="text-xl font-bold">Coaching Progress Snapshot</h3>
              <p className="text-white/80 text-sm">Apptivia Platform</p>
              {totalMembers > 0 && (
                <p className="text-white/70 text-xs mt-1">Team Members: {totalMembers}</p>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                <div className="text-xl font-bold mb-0.5">{apptiviaLevel || 'N/A'}</div>
                <div className="text-white/80 text-xs">Apptivia Level</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                <div className="text-xl font-bold mb-0.5">{levelPoints || 0}</div>
                <div className="text-white/80 text-xs">Level Points</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                <div className="text-xl font-bold mb-0.5">{averageScore || 0}%</div>
                <div className="text-white/80 text-xs">Average Score</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                <div className="text-xl font-bold mb-0.5">{scorecardStreak}</div>
                <div className="text-white/80 text-xs">Scorecard Streak</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                <div className="text-xl font-bold mb-0.5">{totalBadges}</div>
                <div className="text-white/80 text-xs">Total Badges</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                <div className="text-xl font-bold mb-0.5">{totalAchievements}</div>
                <div className="text-white/80 text-xs">Achievements</div>
              </div>
            </div>

            {/* Skillset Mastery Progress */}
            {allSkillsets.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span>🎯</span>
                  Skillset Mastery Progress
                </h4>
                <div className="space-y-1.5">
                  {allSkillsets.map((skillset, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">
                          {skillset.skillset_name || skillset.name}
                        </span>
                        <span className="text-xs font-bold">{Math.round(skillset.progress || 0)}%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-1">
                        <div
                          className="bg-white h-1 rounded-full transition-all"
                          style={{ width: `${skillset.progress || 0}%` }}
                        />
                      </div>
                      <div className="text-white/70 text-[10px] mt-0.5">
                        {skillset.achievements_completed || 0} achievements • {skillset.points || 0} pts
                      </div>
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
                Share your coaching progress with your team!
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
                  placeholder="Apptivia Coach Snapshot"
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
                  placeholder="Add highlights or focus areas"
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
                An HTML email with coaching stats will be sent to the recipients
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
