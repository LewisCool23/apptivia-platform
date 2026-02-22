// supabase/functions/engage-outreach/index.ts
// Supabase Edge Function — AI outreach draft generation via Claude
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

    const { prospect, company_brief, channel = 'email', tone = 'professional', template_id, template_system_prompt, template_user_prompt } = await req.json();
    if (!prospect) return jsonResp({ error: 'prospect data is required' }, 400);

    // If a prompt library template was selected, use its prompts instead of the default
    let systemPrompt: string;
    let userMessage: string;

    if (template_system_prompt || template_user_prompt) {
      // ── Library prompt mode ──
      // Resolve variables in template prompts
      const prospectJson = JSON.stringify(prospect, null, 2);
      const companyJson = JSON.stringify(company_brief || {}, null, 2);

      systemPrompt = (template_system_prompt || `You are an expert sales copywriter.`)
        .replace(/\{\{PROSPECT\}\}/g, prospectJson)
        .replace(/\{\{COMPANY\}\}/g, prospect?.company_name || prospect?.organization?.name || 'the target company')
        .replace(/\{\{CHANNEL\}\}/g, channel)
        .replace(/\{\{TONE\}\}/g, tone);

      const baseUserPrompt = template_user_prompt || '';
      userMessage = baseUserPrompt
        .replace(/\{\{PROSPECT\}\}/g, prospectJson)
        .replace(/\{\{COMPANY\}\}/g, prospect?.company_name || prospect?.organization?.name || 'the target company')
        .replace(/\{\{SELECTED_ANGLE\}\}/g, 'Based on the research context below')
        .replace(/\{\{CHANNEL\}\}/g, channel)
        .replace(/\{\{TONE\}\}/g, tone)
        + `\n\nProspect data:\n${prospectJson}\n\nCompany brief:\n${companyJson}\n\nChannel: ${channel}\nTone: ${tone}\n\nReturn ONLY valid JSON: { "subject": "...", "body": "...", "personalization_points": ["..."], "cta_type": "meeting|resource|question|intro" }`;
    } else {
      // ── Default built-in prompt ──
      systemPrompt = `You are an expert sales copywriter for Apptivia Engage.
Write a personalised ${channel} outreach message with a ${tone} tone.

Rules:
- Use specific details from the prospect's profile and company research
- Keep it concise (${channel === 'linkedin' ? '300 chars max for connection request, 1500 for InMail' : '150 words max for email'})
- Include a clear, low-friction CTA
- Do NOT be generic or salesy
- Reference something specific and recent about their company or role

Return ONLY valid JSON:
{
  "subject": "Email subject line (omit for LinkedIn)",
  "body": "The message body",
  "personalization_points": ["detail 1 used", "detail 2 used"],
  "cta_type": "meeting|resource|question|intro"
}`;

      userMessage = `Prospect:\n${JSON.stringify(prospect, null, 2)}\n\nCompany brief:\n${JSON.stringify(company_brief || {}, null, 2)}\n\nTone: ${tone}\nChannel: ${channel}`;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const message = await anthropicRes.json();
    let text = message.content?.[0]?.text || '{}';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);

    try {
      const content = JSON.parse(text);
      return jsonResp({ ok: true, content, tokens_used: tokensUsed });
    } catch {
      return jsonResp({ ok: true, content: { body: text }, tokens_used: tokensUsed });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Outreach draft failed';
    console.error('engage-outreach error:', err);
    return jsonResp({ error: message }, 500);
  }
});
