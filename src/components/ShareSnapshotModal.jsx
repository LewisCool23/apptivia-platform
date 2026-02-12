import React, { useState, useRef } from 'react';
import { X, Download, Link as LinkIcon, CheckCircle, Mail } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function ShareSnapshotModal({ isOpen, onClose, userData }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const snapshotRef = useRef(null);

  if (!isOpen || !userData) return null;

  const { name, badges, achievements, skillsets, points, profile_picture } = userData;

  // Calculate stats
  const totalBadges = badges?.length || 0;
  const totalAchievements = achievements?.reduce((sum, a) => sum + (a.achievements_completed || 0), 0) || 0;
  const avgSkillsetProgress = skillsets?.length > 0 
    ? Math.round(skillsets.reduce((sum, s) => sum + (s.progress || 0), 0) / skillsets.length) 
    : 0;
  const recentBadges = badges?.slice(0, 6) || [];

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
      link.download = `apptivia-snapshot-${name?.replace(/\s+/g, '-')}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading snapshot:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/profile/${userData.id}`;
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
      // Generate email content
      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(e => e);
      const subject = emailSubject.trim() || `${name}'s Achievement Snapshot - Apptivia Platform`;
      
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
            .cta { text-align: center; margin: 30px 0; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Achievement Snapshot</h1>
              <h2>${name}</h2>
              <p>Apptivia Platform</p>
            </div>
            
            <div class="stats">
              <div class="stat-box">
                <div class="stat-value">${totalBadges}</div>
                <div class="stat-label">Badges Earned</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${totalAchievements}</div>
                <div class="stat-label">Achievements</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${avgSkillsetProgress}%</div>
                <div class="stat-label">Avg Progress</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${points?.toLocaleString() || 0}</div>
                <div class="stat-label">Total Points</div>
              </div>
            </div>

            <div class="cta">
              <p>View full profile and achievements:</p>
              <a href="${window.location.origin}/profile/${userData.id}" class="button">View Profile</a>
            </div>

            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()}</p>
              <p>Apptivia Platform - Achievement & Skills Management</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
${name}'s Achievement Snapshot - Apptivia Platform

🏆 Badges Earned: ${totalBadges}
✅ Achievements: ${totalAchievements}
📊 Average Progress: ${avgSkillsetProgress}%
⭐ Total Points: ${points?.toLocaleString() || 0}

View full profile: ${window.location.origin}/profile/${userData.id}

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
            <span>📸</span>
            Share Achievement Snapshot
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl shadow-lg flex-shrink-0">
                {profile_picture ? (
                  <img src={profile_picture} alt={name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold">{name || 'User'}</h3>
                <p className="text-white/80 text-sm">Apptivia Platform</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="text-2xl font-bold mb-0.5">{totalBadges}</div>
                <div className="text-white/80 text-xs">Badges Earned</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="text-2xl font-bold mb-0.5">{totalAchievements}</div>
                <div className="text-white/80 text-xs">Achievements</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="text-2xl font-bold mb-0.5">{avgSkillsetProgress}%</div>
                <div className="text-white/80 text-xs">Avg Progress</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="text-2xl font-bold mb-0.5">{points?.toLocaleString() || 0}</div>
                <div className="text-white/80 text-xs">Total Points</div>
              </div>
            </div>

            {/* Recent Badges */}
            {recentBadges.length > 0 && (
              <div>
                <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <span>🏆</span>
                  Recent Badges
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {recentBadges.map((badge, idx) => (
                    <div
                      key={idx}
                      className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 text-center"
                    >
                      <div className="text-2xl mb-0.5">{badge.icon || '🏆'}</div>
                      <div className="text-xs font-medium truncate">{badge.badge_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skillset Progress */}
            {skillsets && skillsets.length > 0 && (
              <div className="mt-4">
                <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
                  <span>📊</span>
                  Top Skillsets
                </h4>
                <div className="space-y-2">
                  {skillsets.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium flex items-center gap-1.5">
                          {(item.skillset?.icon || item.skillset_icon) && <span>{item.skillset?.icon || item.skillset_icon}</span>}
                          {item.skillset?.name || item.skillset_name || 'Skillset'}
                        </span>
                        <span className="text-sm font-bold">{Math.round(item.progress || 0)}%</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-1.5">
                        <div
                          className="bg-white h-1.5 rounded-full transition-all"
                          style={{ width: `${item.progress || 0}%` }}
                        />
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
                Share your achievements with your team or on social media!
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
                  placeholder={`${name}'s Achievement Snapshot - Apptivia Platform`}
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
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                An HTML email with achievement stats will be sent to the recipients
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
