// supabase/functions/engage-watchdog/index.ts
// Supabase Edge Function — KPI Watchdog AI analysis for anomalies
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

    const { anomalies } = await req.json();
    if (!anomalies?.length) return jsonResp({ error: 'anomalies array is required' }, 400);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert sales coach in Apptivia, a sales performance platform.
For each KPI anomaly, provide:
1. A brief analysis explaining the likely cause of the drop/spike (1-2 sentences)
2. A specific coaching recommendation the manager should implement (1-2 sentences)

Return ONLY valid JSON array with objects having keys: analysis, recommendation`,
        messages: [{
          role: 'user',
          content: `Analyze these ${anomalies.length} KPI anomalies:\n${anomalies.map((a: any, i: number) =>
            `${i + 1}. Rep: ${a.profile_name} | KPI: ${a.kpi_name} | Type: ${a.anomaly_type} | Severity: ${a.severity}\n   Current: ${a.current_value} | Rolling Avg: ${a.rolling_avg} | Deviation: ${a.deviation_pct}%`
          ).join('\n\n')}`,
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const message = await anthropicRes.json();
    let text = message.content?.[0]?.text || '[]';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    try {
      const analyses = JSON.parse(text);
      return jsonResp({ ok: true, analyses: Array.isArray(analyses) ? analyses : [] });
    } catch {
      return jsonResp({ ok: true, analyses: [] });
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Watchdog analysis failed';
    console.error('engage-watchdog error:', err);
    return jsonResp({ error: errMsg }, 500);
  }
});
