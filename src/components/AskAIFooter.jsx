import React from 'react';

const BRIEF_URL = 'https://api.apptivia.app/api/public/aeo-brief';

const PROMPT = encodeURIComponent(
  `I'm researching sales performance platforms for a B2B SaaS team. Read this brief about Apptivia (${BRIEF_URL}) and tell me:

1. What does Apptivia do that Gong, Outreach, Ambition, and Salesforce don't?
2. Who is the ideal customer profile (team size, role, pain)?
3. What's the pricing model and what's included at each tier?
4. What's the production state — is this a real product or a slide deck?

Then ask me which of the three target customer segments (Scaling Builder, Performance-Stuck Operator, Enterprise SDR Machine) sounds closest to my situation, and walk me through the relevant fit questions.`
);

const AI_TARGETS = [
  { name: 'ChatGPT',    url: `https://chatgpt.com/?q=${PROMPT}` },
  { name: 'Claude',     url: `https://claude.ai/new?q=${PROMPT}` },
  { name: 'Gemini',     url: `https://gemini.google.com/app?q=${PROMPT}` },
  { name: 'Perplexity', url: `https://www.perplexity.ai/?q=${PROMPT}` },
];

export default function AskAIFooter() {
  return (
    <div className="border-t border-gray-700 py-10 mt-0">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <h3 className="text-lg font-semibold text-white mb-2">
          Ask your AI about Apptivia
        </h3>
        <p className="text-sm text-gray-400 mb-6 max-w-2xl mx-auto">
          Click any AI tool below. We hand it everything it needs to answer your questions about Apptivia — pricing, fit, production state, founder.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {AI_TARGETS.map(t => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-600 rounded-md hover:bg-apptivia-carbon-800 hover:border-gray-500 transition text-sm font-medium text-gray-300 hover:text-white"
            >
              Ask {t.name}
            </a>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Brief auto-updates from{' '}
          <a href={BRIEF_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">
            api.apptivia.app/api/public/aeo-brief
          </a>
        </p>
      </div>
    </div>
  );
}
