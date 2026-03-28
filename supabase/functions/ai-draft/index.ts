// supabase/functions/ai-draft/index.ts
// Supabase Edge Function for AI-powered coaching plan drafting
// Uses Anthropic Claude API to generate coaching plan content

// @ts-ignore: Deno is available in Supabase Edge Runtime
declare const Deno: {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured. Add it in Supabase Dashboard → Edge Functions → Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { field, planName, focusKpis, existingGoals, existingActions, existingMetrics, notes, playbookInsights } = await req.json();

    if (!field) {
      return new Response(
        JSON.stringify({ error: 'field is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const kpiList = (focusKpis || []).filter(Boolean).map((k: string) => k.replace(/_/g, ' ')).join(', ');

    // Build performance context from playbook insights (scorecard data)
    const performanceParts: string[] = [];
    if (playbookInsights) {
      if (playbookInsights.teamSize) {
        performanceParts.push(`Team size: ${playbookInsights.teamSize} reps`);
      }
      if (playbookInsights.teamTrend) {
        const t = playbookInsights.teamTrend;
        const dir = t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : 'flat';
        performanceParts.push(`Team score trend (${t.weeks} weeks): ${dir} ${Math.abs(Math.round(t.delta))} points (current: ${Math.round(t.current)})`);
      }
      if (playbookInsights.teamWeaknesses?.length) {
        const weakList = playbookInsights.teamWeaknesses
          .map((w: any) => `${w.label} (${w.avgPct}% avg, ${w.belowCount}/${w.totalReps} reps below target)`)
          .join('; ');
        performanceParts.push(`Lagging team KPIs: ${weakList}`);
      }
      if (playbookInsights.repsNeedingCoaching?.length) {
        const repList = playbookInsights.repsNeedingCoaching
          .map((r: any) => {
            let desc = `${r.name} (score: ${Math.round(r.recent)}, 5-wk avg: ${r.avg5w}, trend: ${r.trendDelta > 0 ? '+' : ''}${Math.round(r.trendDelta)})`;
            if (r.weakestKpi) desc += ` — weakest: ${r.weakestKpi.label} at ${r.weakestKpi.pct}%`;
            return desc;
          })
          .join('; ');
        performanceParts.push(`Reps needing coaching: ${repList}`);
      }
    }

    const contextParts = [
      'You are an expert sales coaching assistant for Apptivia, a sales performance platform.',
      planName ? `The coaching plan is called: "${planName}"` : '',
      kpiList ? `Focus KPIs: ${kpiList}` : '',
      existingGoals?.length ? `Existing goals: ${existingGoals.join('; ')}` : '',
      existingActions?.length ? `Existing action items: ${existingActions.join('; ')}` : '',
      existingMetrics?.length ? `Existing success metrics: ${existingMetrics.join('; ')}` : '',
      notes ? `Manager notes: ${notes}` : '',
      performanceParts.length > 0 ? `\nACTUAL TEAM PERFORMANCE DATA (from Apptivia Scorecard):\n${performanceParts.join('\n')}` : '',
    ].filter(Boolean).join('\n');

    const hasPerformanceData = performanceParts.length > 0;
    const perfNote = hasPerformanceData
      ? ' Use the ACTUAL TEAM PERFORMANCE DATA provided above to make suggestions specific and data-driven. Reference specific lagging KPIs, rep trends, and team weaknesses.'
      : '';

    const fieldPrompts: Record<string, string> = {
      goals: `Generate 1-3 specific, measurable coaching goals for a sales rep.${perfNote} Each goal should be achievable within 1-2 weeks. Return ONLY the goals as a JSON array of strings, no other text.`,
      action_items: `Generate 3-5 specific, actionable coaching action items for a sales rep.${perfNote} Be prescriptive with daily/weekly activities that target the identified weaknesses. Return ONLY the action items as a JSON array of strings, no other text.`,
      success_metrics: `Generate 2-4 measurable success metrics to track coaching plan effectiveness.${perfNote} Include specific numbers/percentages based on current performance levels. Return ONLY the metrics as a JSON array of strings, no other text.`,
      notes: `Write a brief 2-3 sentence coaching note from a manager to a sales rep, providing context and encouragement for this coaching plan.${perfNote} Return ONLY the note text, no JSON wrapping.`,
      name: `Suggest a short, descriptive coaching plan name (3-6 words) based on the context.${hasPerformanceData ? ' The name should reflect the specific coaching focus areas identified from the team performance data.' : ''} Return ONLY the plan name text, no quotes or JSON.`,
    };

    const prompt = fieldPrompts[field];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Unknown field: ${field}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Anthropic API directly via fetch
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [
          { role: 'user', content: `${contextParts}\n\n${prompt}` },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errBody);
      let errorMessage = `AI service error (${anthropicRes.status}). Please try again.`;
      try {
        const errJson = JSON.parse(errBody);
        if (errJson?.error?.message) {
          errorMessage = errJson.error.message;
        }
      } catch (_) {}
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = await anthropicRes.json();
    let text = (message.content?.[0]?.text || '').trim();

    // Strip markdown code fences (```json ... ``` or ``` ... ```) that Claude sometimes adds
    text = text.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

    // Parse response based on field type
    if (field === 'notes' || field === 'name') {
      return new Response(
        JSON.stringify({ result: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For array fields, parse JSON
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return new Response(
          JSON.stringify({ result: parsed }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (_) {
      // Fallback: split by newlines and clean up
      const lines = text.split('\n')
        .map((l: string) => l.replace(/^[\d\-\*\.\)]+\s*/, '').trim())
        .filter((l: string) => l && !l.startsWith('[') && !l.startsWith(']'));
      return new Response(
        JSON.stringify({ result: lines }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ result: text.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI draft failed';
    console.error('AI draft error:', err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
