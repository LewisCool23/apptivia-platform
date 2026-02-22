// supabase/functions/engage-pipeline/index.ts
// Supabase Edge Function — Pipeline forecast via Claude AI
export {};

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResp({ error: 'POST required' }, 405);
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return jsonResp({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }

    const { deals, summary } = await req.json();
    if (!deals || !summary) return jsonResp({ error: 'deals and summary are required' }, 400);

    const systemPrompt = `You are a senior sales operations analyst embedded in Apptivia, a sales performance platform.
Given a pipeline snapshot, produce a concise but actionable forecast.

Structure your response as:

**Pipeline Health Summary**
A 2-3 sentence overview of the current pipeline state.

**High Probability Deals (Likely to Close This Month)**
List deals most likely to close, with brief reasoning.

**At-Risk Deals (Action Required)**
List at-risk deals (inactive >7 days, high value) with specific recommended actions.

**Deals Likely to Slip to Next Quarter**
List deals that may roll, with reasoning.

**Forecast Confidence**
Your confidence level (High/Medium/Low) with a brief explanation.

Be direct, data-driven, and specific. Reference deal names and values. Keep the total response under 500 words.`;

    const userMessage = `Pipeline Summary:
- Total Pipeline Value: $${summary.totalValue?.toLocaleString()}
- Weighted Value: $${summary.weightedValue?.toLocaleString()}
- Deal Count: ${summary.dealCount}
- At Risk: ${summary.atRiskCount} deals ($${summary.atRiskValue?.toLocaleString()})
- Closing This Month: ${summary.closingThisMonth} deals ($${summary.closingThisMonthValue?.toLocaleString()})
- Commit: $${summary.commitValue?.toLocaleString()}
- Best Case: $${summary.bestCaseValue?.toLocaleString()}

Active Deals:
${deals.map((d: any) => `- ${d.deal_name}: $${d.deal_value?.toLocaleString()} | Stage: ${d.stage} | Prob: ${d.probability}% | Close: ${d.close_date || 'TBD'} | Inactive: ${d.days_inactive}d | Owner: ${d.owner_name} | Forecast: ${d.forecast_category}${d.is_at_risk ? ' ⚠️ AT RISK' : ''}`).join('\n')}`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const message = await anthropicRes.json();
    const forecast = message.content?.[0]?.text || 'Unable to generate forecast.';

    return jsonResp({ ok: true, forecast, confidence: 'medium' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Pipeline forecast failed';
    console.error('engage-pipeline error:', err);
    return jsonResp({ error: errMsg }, 500);
  }
});
