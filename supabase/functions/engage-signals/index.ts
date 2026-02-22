// supabase/functions/engage-signals/index.ts
// Supabase Edge Function — Signal-based prospecting (Tavily scan + Claude analysis)
export {};

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  env: { get(key: string): string | undefined };
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchJson(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function tavilySearch(query: string, options: any = {}) {
  const key = Deno.env.get('TAVILY_API_KEY');
  if (!key) throw new Error('TAVILY_API_KEY not configured');
  return fetchJson('https://api.tavily.com/search', {
    method: 'POST',
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: options.depth || 'basic',
      include_answer: true,
      include_raw_content: false,
      max_results: options.max_results || 3,
      topic: options.topic || 'general',
    }),
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
    const { organization_id, config } = await req.json();
    if (!config?.competitors?.length) {
      return jsonResp({ error: 'At least one competitor is required' }, 400);
    }

    const signals: any[] = [];
    const errors: any[] = [];

    // Helper to classify signal type from content and infer buying stage
    function classifySignal(text: string): { signalType: string; strength: string; score: number; buyingStage: string } {
      const lower = text.toLowerCase();
      
      // ═══════════════════════════════════════════════════════════════
      // HIGHEST VALUE: Active buyer intent signals (score 85-95)
      // ═══════════════════════════════════════════════════════════════
      
      // Solution search — actively researching solutions
      if (lower.includes('best software') || lower.includes('top platform') || lower.includes('software comparison') || lower.includes('tool comparison') || lower.includes('which solution')) {
        return { signalType: 'solution_search', strength: 'very_high', score: 95, buyingStage: 'consideration' };
      }
      
      // Pain point expressed — frustrated and looking for help
      if (lower.includes('frustrated with') || lower.includes('struggling to') || lower.includes('challenge with') || lower.includes('problem with') || lower.includes('need help with')) {
        return { signalType: 'pain_point', strength: 'very_high', score: 92, buyingStage: 'awareness' };
      }
      
      // Competitor churn — leaving a competitor
      if ((lower.includes('switching from') || lower.includes('leaving') || lower.includes('replacing') || lower.includes('migrating from')) && 
          (lower.includes('disappointed') || lower.includes('frustrated') || lower.includes('alternative'))) {
        return { signalType: 'tech_stack_churn', strength: 'very_high', score: 90, buyingStage: 'decision' };
      }
      
      // Competitor complaints — unhappy with competitor
      if (lower.includes('complaint') || lower.includes('terrible') || lower.includes('worst') || lower.includes('canceling') || lower.includes('disappointed')) {
        return { signalType: 'competitor_complaint', strength: 'very_high', score: 88, buyingStage: 'consideration' };
      }
      
      // Competitor comparison — actively evaluating
      if (lower.includes(' vs ') || lower.includes('versus') || lower.includes('compare') || lower.includes('comparison') || lower.includes('alternative to')) {
        return { signalType: 'competitor_comparison', strength: 'very_high', score: 85, buyingStage: 'consideration' };
      }
      
      // ═══════════════════════════════════════════════════════════════
      // HIGH VALUE: Company events that trigger buying (score 75-84)
      // ═══════════════════════════════════════════════════════════════
      
      // Layoffs/restructuring — budget reallocation, efficiency focus
      if (lower.includes('layoff') || lower.includes('laid off') || lower.includes('downsiz') || lower.includes('restructur') || lower.includes('workforce reduction')) {
        return { signalType: 'layoffs', strength: 'high', score: 82, buyingStage: 'decision' };
      }
      
      // Leadership change — new leaders buy new tools
      if (lower.includes('ceo') || lower.includes('cfo') || lower.includes('cro') || lower.includes('vp ') || lower.includes('chief') || lower.includes('appointed') || lower.includes('new hire')) {
        return { signalType: 'leadership_change', strength: 'high', score: 80, buyingStage: 'decision' };
      }
      
      // Funding — money to spend
      if (lower.includes('funding') || lower.includes('raised') || lower.includes('series a') || lower.includes('series b') || lower.includes('series c') || lower.includes('investment')) {
        return { signalType: 'funding', strength: 'high', score: 78, buyingStage: 'awareness' };
      }
      
      // Expansion — growing = needs more tools
      if (lower.includes('expand') || lower.includes('new office') || lower.includes('growth') || lower.includes('scaling') || lower.includes('new market') || lower.includes('growing team')) {
        return { signalType: 'expansion', strength: 'high', score: 76, buyingStage: 'awareness' };
      }
      
      // ═══════════════════════════════════════════════════════════════
      // MEDIUM VALUE: Supporting signals (score 55-74)
      // ═══════════════════════════════════════════════════════════════
      
      // ICP Job posting — hiring roles that need your solution
      if (lower.includes('hiring') || lower.includes('job opening') || lower.includes('open position') || lower.includes('recruiting') || lower.includes('we\'re looking for')) {
        return { signalType: 'icp_job_posting', strength: 'medium', score: 70, buyingStage: 'awareness' };
      }
      
      // Tech adoption — tech-forward company
      if (lower.includes('implemented') || lower.includes('adopted') || lower.includes('tech stack') || lower.includes('integrating')) {
        return { signalType: 'tech_adoption', strength: 'medium', score: 65, buyingStage: 'consideration' };
      }
      
      // Contract win — successful and growing
      if (lower.includes('contract') || lower.includes('deal') || lower.includes('signed') || lower.includes('new customer') || lower.includes('partnership')) {
        return { signalType: 'contract_win', strength: 'medium', score: 62, buyingStage: 'awareness' };
      }
      
      // Product launch — innovation-focused
      if (lower.includes('launch') || lower.includes('new product') || lower.includes('announcing') || lower.includes('unveil')) {
        return { signalType: 'product_launch', strength: 'medium', score: 60, buyingStage: 'awareness' };
      }
      
      // Reviews/sentiment — actively evaluating vendors
      if (lower.includes('review') || lower.includes('rating') || lower.includes('g2') || lower.includes('capterra') || lower.includes('trustpilot')) {
        return { signalType: 'review_sentiment', strength: 'medium', score: 58, buyingStage: 'consideration' };
      }
      
      // Event participation — networking, learning
      if (lower.includes('conference') || lower.includes('webinar') || lower.includes('summit') || lower.includes('event') || lower.includes('speaking')) {
        return { signalType: 'event_participation', strength: 'medium', score: 55, buyingStage: 'awareness' };
      }
      
      // ═══════════════════════════════════════════════════════════════
      // LOWER VALUE: General awareness (score 40-54)
      // ═══════════════════════════════════════════════════════════════
      
      if (lower.includes('job change') || lower.includes('new position') || lower.includes('joined') || lower.includes('promoted')) {
        return { signalType: 'job_change', strength: 'low', score: 50, buyingStage: 'awareness' };
      }
      if (lower.includes('press release') || lower.includes('announces') || lower.includes('pr newswire')) {
        return { signalType: 'press_release', strength: 'low', score: 48, buyingStage: 'awareness' };
      }
      if (lower.includes('blog') || lower.includes('article') || lower.includes('content') || lower.includes('published')) {
        return { signalType: 'content_engagement', strength: 'low', score: 45, buyingStage: 'awareness' };
      }
      
      // Default
      return { signalType: 'competitor_engagement', strength: 'medium', score: 50, buyingStage: 'consideration' };
    }

    // ================================================================
    // QUERY GENERATION — ICP-Based Buyer Intent Detection
    // ================================================================
    const allQueries: { query: string; signalType: string; context: string }[] = [];

    // 1. SOLUTION SEARCH SIGNALS — Companies researching solutions like yours
    const solutionKeywords = config.solution_keywords || [];
    for (const keyword of solutionKeywords.slice(0, 5)) {
      allQueries.push({
        query: `"${keyword}" software OR platform OR tool OR solution 2025 2026`,
        signalType: 'solution_search',
        context: keyword,
      });
      allQueries.push({
        query: `best "${keyword}" OR "top ${keyword}" OR "${keyword} comparison"`,
        signalType: 'solution_search',
        context: keyword,
      });
    }

    // 2. PAIN POINT SIGNALS — Companies expressing problems you solve
    const painPoints = config.pain_points || [];
    for (const pain of painPoints.slice(0, 5)) {
      allQueries.push({
        query: `"${pain}" frustrated OR struggling OR challenge OR problem OR need`,
        signalType: 'pain_point',
        context: pain,
      });
      allQueries.push({
        query: `"${pain}" how to OR solution OR fix OR solve`,
        signalType: 'pain_point',
        context: pain,
      });
    }

    // 3. ICP JOB POSTING SIGNALS — Companies hiring roles that indicate need
    const jobTitles = config.job_titles_to_track || [];
    for (const title of jobTitles.slice(0, 5)) {
      allQueries.push({
        query: `hiring "${title}" OR "open position ${title}" OR "job ${title}" 2025 2026`,
        signalType: 'icp_job_posting',
        context: title,
      });
    }

    // 4. TECH STACK CHURN SIGNALS — Companies leaving competitor products
    const churningTech = config.tech_stack_churning || [];
    for (const tech of churningTech.slice(0, 4)) {
      allQueries.push({
        query: `"switching from ${tech}" OR "leaving ${tech}" OR "replacing ${tech}" OR "${tech} alternative"`,
        signalType: 'tech_stack_churn',
        context: tech,
      });
      allQueries.push({
        query: `"${tech}" frustrated OR disappointed OR canceling OR migrating away`,
        signalType: 'competitor_complaint',
        context: tech,
      });
    }

    // 5. COMPETITOR COMPARISON SIGNALS — Companies comparing solutions
    const competitors = config.competitors || [];
    for (const comp of competitors.slice(0, 5)) {
      allQueries.push({
        query: `"${comp}" vs OR versus OR alternative OR compare OR comparison`,
        signalType: 'competitor_comparison',
        context: comp,
      });
      allQueries.push({
        query: `"${comp}" review OR rating OR complaint OR switching from`,
        signalType: 'competitor_complaint',
        context: comp,
      });
    }

    // 6. COMPETITOR EVENTS — Funding, leadership, layoffs (buying triggers)
    for (const competitor of competitors.slice(0, 5)) {
      allQueries.push({
        query: `"${competitor}" funding OR raised OR investment 2025 2026`,
        signalType: 'funding',
        context: competitor,
      });
      allQueries.push({
        query: `"${competitor}" CEO OR VP appointed OR hired OR departed`,
        signalType: 'leadership_change',
        context: competitor,
      });
      allQueries.push({
        query: `"${competitor}" layoffs OR restructuring OR workforce reduction`,
        signalType: 'layoffs',
        context: competitor,
      });
    }

    // 7. INDUSTRY + KEYWORD COMBINATIONS
    const industries = config.icp_industries || [];
    const keywords = config.keywords || [];
    for (const industry of industries.slice(0, 3)) {
      for (const kw of keywords.slice(0, 2)) {
        allQueries.push({
          query: `"${industry}" company "${kw}" OR hiring OR expanding 2025 2026`,
          signalType: 'expansion',
          context: `${industry} - ${kw}`,
        });
      }
    }

    // ================================================================
    // EXECUTE QUERIES — Run Tavily searches
    // ================================================================
    for (const { query, signalType, context } of allQueries.slice(0, 25)) {
      try {
        const results = await tavilySearch(query, { max_results: 3, depth: 'basic' });
        if (results?.results) {
          for (const result of results.results) {
            const text = (result.title + ' ' + (result.content || ''));
            const classified = classifySignal(text);
            
            // Use explicit signal type from query, but get score/strength from classifier
            const finalSignalType = signalType || classified.signalType;
            const buyingStage = classified.buyingStage;

            signals.push({
              organization_id,
              signal_type: finalSignalType,
              signal_strength: classified.strength,
              signal_score: classified.score,
              buying_stage_indicator: buyingStage,
              title: result.title?.substring(0, 200) || 'Untitled Signal',
              description: result.content?.substring(0, 500),
              source_url: result.url,
              source_platform: 'web',
              company_name: context,  // The company/keyword/title that matched
              detected_at: new Date().toISOString(),
              status: 'new',
              raw_data: { tavily_result: result, query_context: context, original_query: query },
            });
          }
        }
      } catch (queryErr: any) {
        errors.push({ query, context, error: queryErr.message });
      }
    }

    // Step 2: Enrich top signals with AI analysis (top 10)
    const topSignals = signals.sort((a, b) => b.signal_score - a.signal_score).slice(0, 10);

    if (topSignals.length > 0) {
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
      if (ANTHROPIC_API_KEY) {
        try {
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
              system: `You are an expert sales intelligence analyst. For each intent signal, provide:
1. A brief AI summary (1-2 sentences)
2. A recommended action for the sales team
3. A suggested outreach angle

Return ONLY valid JSON array with objects having keys: ai_summary, ai_recommended_action, ai_outreach_angle`,
              messages: [{
                role: 'user',
                content: `Analyze these ${topSignals.length} intent signals and provide guidance for each:\n${topSignals.map((s: any, i: number) => `${i + 1}. [${s.signal_type}] ${s.title}\n   Company: ${s.company_name}\n   ${s.description?.substring(0, 200)}`).join('\n\n')}`,
              }],
            }),
          });

          if (anthropicRes.ok) {
            const message = await anthropicRes.json();
            let text = message.content?.[0]?.text || '[]';
            text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            try {
              const analyses = JSON.parse(text);
              if (Array.isArray(analyses)) {
                analyses.forEach((analysis: any, i: number) => {
                  if (topSignals[i]) {
                    topSignals[i].ai_summary = analysis.ai_summary;
                    topSignals[i].ai_recommended_action = analysis.ai_recommended_action;
                    topSignals[i].ai_outreach_angle = analysis.ai_outreach_angle;
                  }
                });
              }
            } catch { /* AI enrichment is optional */ }
          }
        } catch { /* AI enrichment is optional */ }
      }
    }

    // Step 3: Persist signals to database
    let signalsSaved = 0;
    const savedSignals: any[] = [];
    if (signals.length > 0) {
      try {
        const supabase = getSupabaseAdmin();
        // Deduplicate by source_url within this org
        const sourceUrls = signals.map((s: any) => s.source_url).filter(Boolean);
        let existingUrls = new Set<string>();
        if (sourceUrls.length > 0) {
          const { data: existing } = await supabase
            .from('engage_intent_signals')
            .select('source_url')
            .eq('organization_id', organization_id)
            .in('source_url', sourceUrls);
          existingUrls = new Set((existing || []).map((r: any) => r.source_url));
        }
        const newSignals = signals.filter((s: any) => !s.source_url || !existingUrls.has(s.source_url));
        if (newSignals.length > 0) {
          const { data: inserted, error: insertErr } = await supabase
            .from('engage_intent_signals')
            .insert(newSignals)
            .select();
          if (insertErr) {
            console.error('Insert error:', insertErr.message);
          } else {
            signalsSaved = inserted?.length || 0;
            savedSignals.push(...(inserted || []));
          }
        }
      } catch (dbErr: any) {
        console.error('DB persistence error:', dbErr.message);
      }
    }

    return jsonResp({
      ok: true,
      signals_found: signals.length,
      signals_saved: signalsSaved || signals.length,
      signals: savedSignals.length > 0 ? savedSignals : signals,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Signal scan failed';
    console.error('engage-signals error:', err);
    return jsonResp({ error: errMsg }, 500);
  }
});
