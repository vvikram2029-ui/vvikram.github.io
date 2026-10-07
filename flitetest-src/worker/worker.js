// flitetest helper worker (Cloudflare Workers, free plan).
//   POST /chat    {messages:[{role,content}], context}  -> {reply, model}
//   POST /upload  {name, content_b64}                   -> commits flitetest-src/inbox/<name> (already encrypted in the browser)
//   POST /runs                                          -> latest flitetest workflow runs (avoids GitHub's 60 req/h anonymous limit)
//   GET  /health                                        -> what is configured
// Every POST needs header x-ft-auth = the hash the site derives from the site password (secret AUTH_HASH).
//
// Secrets / vars (see README.md):  AUTH_HASH (required), GITHUB_TOKEN (uploads), GEMINI_API_KEY (optional, better + free),
// GEMINI_MODEL, AI_MODEL, REPO, ALLOWED_ORIGINS.  The [ai] binding in wrangler.toml gives free Workers AI as the fallback.

const SYSTEM = `You are the flitetest assistant for a high-school American Rocketry Challenge (ARC/TARC) 2027 team from Brunswick, Ohio.
You help the team understand their OpenRocket wind-sweep results and improve their rocket.

ARC 2027 rules (from rocketrychallenge.org): payload of 2 raw eggs (55–63 g each); liftoff mass ≤ 650 g; length ≥ 650 mm; must include a T-80 (66 mm) body tube ≥ 12 in (305 mm) plus another tube ≥ 10 mm different in diameter; single stage; one ARC-approved motor ≤ 80 N·s total impulse; parachute recovery with every part tethered; an approved altimeter; launch from a ≥ 1/4 in rod or a rail (Finals: 1 in rails only, no rods).
Target: 800 ft (243.84 m) apogee and 37–40 s total flight time. Score = |apogee_ft − 800| + 4 × (seconds outside 37–40 s). Lower is better.

How the site's data was produced: OpenRocket 24.12, launch site 41.2381 N 81.8418 W, 350 m elevation, 1.83 m (6 ft) rail unless stated. Wind sweep: 0–20 kt (0–10.3 m/s) in 0.5 kt steps from 225°, 270°, 315°, 10% turbulence = 123 flights per version. All site values are SI except the ARC score.

Answer from the data in the CONTEXT below when you can, quoting numbers with units. If something isn't in the data, say so instead of guessing. Give practical engineering advice (ballast, chute size, delay, motor choice, fin size, mass) and explain the trade-offs. Rocketry safety comes first: follow the NAR/TRA safety codes and never suggest unsafe or rule-breaking changes. Be concise; use short paragraphs or bullet lists.`;

const json = (o, status, cors) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });

async function gemini(env, system, messages) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${d.error?.message || 'request failed'}`);
  const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned no text');
  return { reply: text, model };
}

async function workersAI(env, system, messages) {
  const model = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const out = await env.AI.run(model, { messages: [{ role: 'system', content: system }, ...messages], max_tokens: 1500, temperature: 0.4 });
  const text = (out?.response || '').trim();
  if (!text) throw new Error('Workers AI returned no text');
  return { reply: text, model };
}

async function github(env, path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${env.REPO || 'yoda-3x3/yoda-3x3.github.io'}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'flitetest-worker', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${d.message || 'request failed'}`);
  return d;
}

// ---- /ticker: stock quotes (Yahoo chart API) + world headlines (BBC RSS); both block browser CORS, so the worker relays them.
const SYMBOLS = [['^GSPC', 'S&P 500'], ['^DJI', 'Dow'], ['^IXIC', 'Nasdaq'], ['AAPL'], ['MSFT'], ['NVDA'], ['GOOGL'], ['AMZN'], ['TSLA'], ['META'], ['BA', 'Boeing'], ['LMT', 'Lockheed'], ['RKLB', 'Rocket Lab'], ['BTC-USD', 'Bitcoin']];
async function quote([sym, label]) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return null;
  const m = (await r.json())?.chart?.result?.[0]?.meta;
  if (!m || !m.regularMarketPrice) return null;
  const prev = m.chartPreviousClose || m.previousClose;
  return { s: label || sym, p: m.regularMarketPrice, c: prev ? (m.regularMarketPrice / prev - 1) * 100 : null };
}
async function headlines() {
  const r = await fetch('https://feeds.bbci.co.uk/news/world/rss.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return [];
  const xml = await r.text();
  const unx = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map(([, it]) => ({ t: unx((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''), u: unx((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '') })).filter(x => x.t);
}
async function ticker(ctx) {
  const cache = caches.default, key = new Request('https://flitetest.cache/ticker-v1');
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const [stocks, news] = await Promise.all([Promise.all(SYMBOLS.map(s => quote(s).catch(() => null))), headlines().catch(() => [])]);
  const data = { stocks: stocks.filter(Boolean), news, time: new Date().toISOString() };
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=300' } })));
  return data;
}

export default {
  async fetch(req, env, ctx) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://yoda-3x3.github.io').split(',').map(s => s.trim());
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Headers': 'content-type, x-ft-auth',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const { pathname } = new URL(req.url);
    if (pathname === '/health') return json({ ok: true, chat: !!(env.GEMINI_API_KEY || env.AI), gemini: !!env.GEMINI_API_KEY, upload: !!env.GITHUB_TOKEN, auth: !!env.AUTH_HASH }, 200, cors);
    if (pathname === '/ticker') return json(await ticker(ctx), 200, { ...cors, 'cache-control': 'max-age=120' }); // public market/news data, no auth
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
    if (!env.AUTH_HASH || req.headers.get('x-ft-auth') !== env.AUTH_HASH) return json({ error: 'Not authorised: the worker\'s AUTH_HASH does not match this site password.' }, 401, cors);

    try {
      if (pathname === '/chat') {
        const body = await req.json();
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-16).map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
        if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'No question' }, 400, cors);
        const system = SYSTEM + '\n\nCONTEXT (site data, JSON-ish):\n' + String(body.context || '').slice(0, 120000);
        if (env.GEMINI_API_KEY) {
          try { return json(await gemini(env, system, messages), 200, cors); }
          catch (e) { if (!env.AI) throw e; /* rate-limited etc. -> fall back to Workers AI */ }
        }
        if (!env.AI) return json({ error: 'No AI provider configured on the worker (add GEMINI_API_KEY or the [ai] binding).' }, 500, cors);
        // Workers AI models have smaller context windows: trim the data context.
        return json(await workersAI(env, SYSTEM + '\n\nCONTEXT:\n' + String(body.context || '').slice(0, 24000), messages), 200, cors);
      }
      if (pathname === '/upload') {
        if (!env.GITHUB_TOKEN) return json({ error: 'Uploads are not set up on the worker (GITHUB_TOKEN secret missing).' }, 500, cors);
        const { name, content_b64 } = await req.json();
        if (!/^[\w.\-]{1,120}\.enc$/.test(name || '')) return json({ error: 'Bad file name' }, 400, cors);
        if (typeof content_b64 !== 'string' || content_b64.length > 40e6) return json({ error: 'File missing or larger than 30 MB' }, 400, cors);
        const d = await github(env, `/contents/flitetest-src/inbox/${name}`, { method: 'PUT', body: JSON.stringify({ message: `flitetest: queue ${name}`, content: content_b64, branch: 'main' }) });
        return json({ ok: true, commit: d.commit?.sha }, 200, cors);
      }
      if (pathname === '/runs') {
        if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret missing' }, 500, cors);
        const d = await github(env, '/actions/workflows/flitetest.yml/runs?per_page=5');
        return json({ workflow_runs: (d.workflow_runs || []).map(r => ({ id: r.id, status: r.status, conclusion: r.conclusion, created_at: r.created_at, updated_at: r.updated_at, html_url: r.html_url, head_sha: r.head_sha })) }, 200, cors);
      }
      return json({ error: 'Not found' }, 404, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, cors);
    }
  },
};
