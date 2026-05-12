import React from 'react';

const logos = {
  salesforce: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.7 8.5a7.3 7.3 0 0 1 6.1-3.2c3 0 5.6 1.8 6.8 4.4a7.4 7.4 0 0 1 2.8-.5c4.1 0 7.4 3.4 7.4 7.5s-3.3 7.5-7.4 7.5c-.5 0-1-.1-1.5-.2a6.4 6.4 0 0 1-5.9 3.9c-1 0-1.9-.2-2.8-.6a7.6 7.6 0 0 1-7 4.7c-3.2 0-6-2-7.1-4.9A6.7 6.7 0 0 1 6 27c-3 0-5.8-2.6-5.8-6.2 0-2.6 1.5-4.8 3.7-5.7A7 7 0 0 1 10.4 8c2.4 0 4.6 1.2 5.9 3.1" fill="#00A1E0"/>
    </svg>
  ),
  hubspot: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#FF7A59"/>
      <path d="M24.5 14v-2.5a2 2 0 1 0-2-2v0a2 2 0 0 0 2 2V14a5.5 5.5 0 0 0-3.2 2l-7.5-5.8a2.5 2.5 0 1 0-1.3 1.7l7.3 5.7a5.5 5.5 0 0 0 0 4.7l-2 1.5a2.2 2.2 0 1 0 1.2 1.7l2-1.6a5.5 5.5 0 1 0 3.5-9.9z" fill="white"/>
    </svg>
  ),
  outreach: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#5951FF"/>
      <path d="M12 20l5 5 11-11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  salesloft: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#0B3354"/>
      <path d="M11 28V16l5 3v9M17.5 28V13l5 3v12M24 28V10l5 3v15" stroke="#37B1FF" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  marketo: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#5C4C9F"/>
      <path d="M12 30V10l8 8 8-8v20l-8-6-8 6z" fill="white"/>
    </svg>
  ),
  microsoft_outlook: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#0078D4"/>
      <rect x="8" y="10" width="24" height="22" rx="2" fill="white"/>
      <rect x="8" y="10" width="24" height="7" rx="2" fill="#0078D4"/>
      <rect x="12" y="21" width="5" height="4" rx="1" fill="#0078D4" opacity="0.3"/>
      <rect x="19" y="21" width="5" height="4" rx="1" fill="#0078D4"/>
      <rect x="26" y="21" width="5" height="4" rx="1" fill="#0078D4" opacity="0.3"/>
      <rect x="12" y="27" width="5" height="3" rx="1" fill="#0078D4" opacity="0.15"/>
      <rect x="19" y="27" width="5" height="3" rx="1" fill="#0078D4" opacity="0.15"/>
    </svg>
  ),
  google_calendar: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="28" height="26" rx="3" fill="white" stroke="#4285F4" strokeWidth="2"/>
      <rect x="6" y="8" width="28" height="8" rx="3" fill="#4285F4"/>
      <rect x="14" y="6" width="3" height="5" rx="1" fill="#EA4335"/>
      <rect x="23" y="6" width="3" height="5" rx="1" fill="#EA4335"/>
      <text x="20" y="29" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">31</text>
    </svg>
  ),
  apollo: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#6B4FBB"/>
      <path d="M20 8L10 32h5l2-5h6l2 5h5L20 8zm0 9l2.5 7h-5L20 17z" fill="white"/>
    </svg>
  ),
  gong: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#7B40F2"/>
      <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="3"/>
      <line x1="20" y1="8" x2="20" y2="5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="30" y1="20" x2="33" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="20" x2="7" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  sendoso: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#FF6B2B"/>
      <path d="M10 14l10 6 10-6M10 14v12l10 6 10-6V14L20 8 10 14z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
};

export default function IntegrationLogo({ type, size = 44, className = '' }) {
  const svg = logos[type];
  if (!svg) return null;
  return (
    <div className={className} style={{ width: size, height: size, flexShrink: 0 }}>
      {svg}
    </div>
  );
}
