/**
 * 유어팀 마진 계산기 — Cloudflare Worker
 *
 * 정적 자산 서빙 + 공개 API 프록시.
 *
 * 프록시를 두는 이유:
 *  1) KV 캐시로 외부 API 호출을 사용자 수와 무관하게 시간당 1회로 고정한다.
 *     (프록시는 모든 트래픽을 단일 IP로 모으므로, 캐시가 없으면
 *      외부 무료 API의 레이트리밋에 즉시 걸린다)
 *  2) UNIPASS 등 키가 필요한 API의 자격증명을 클라이언트에 노출하지 않는다.
 *  3) 외부 API 장애 시 만료된 캐시라도 내려주어 계산기가 멈추지 않게 한다.
 */

const RATE_TTL     = 3600;   // 환율 캐시 1시간
const HISTORY_TTL  = 21600;  // 30일 추이 캐시 6시간
const HS_TTL       = 86400;  // HS코드 조회 캐시 24시간
const STALE_TTL    = 604800; // 폴백용 장기 보관 7일

// IP당 레이트리밋 (공개 프록시 남용 방지)
const RL_LIMIT  = 60;
const RL_WINDOW = 60;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
      ...extra,
    },
  });

/** KV 미바인딩 환경에서도 죽지 않도록 모든 KV 접근을 감싼다. */
// KV가 아직 바인딩되지 않았을 때, 외부 API 호출이 매 요청 나가지 않도록
// 모든 아웃바운드 fetch에 Cloudflare 엣지 캐시를 함께 건다 (cf.cacheTtl).
// KV가 붙으면 KV가 1차, 엣지 캐시가 2차 방어선이 된다.
async function kvGet(env, key) {
  if (!env.CACHE) return null;
  try { return await env.CACHE.get(key, 'json'); } catch { return null; }
}
async function kvPut(env, key, value, ttl) {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch { /* 캐시 실패는 요청을 실패시키지 않는다 */ }
}

/**
 * 캐시 우선 조회. 신선하면 즉시 반환하고, 만료됐으면 새로 받아온다.
 * 새로 받는 데 실패하면 만료된 캐시라도 반환한다 (서비스 연속성 우선).
 */
async function cached(env, key, ttl, fetcher) {
  const now = Date.now();
  const hit = await kvGet(env, key);
  if (hit && hit.ts && now - hit.ts < ttl * 1000) {
    return { data: hit.data, cache: 'HIT' };
  }
  try {
    const data = await fetcher();
    await kvPut(env, key, { data, ts: now }, STALE_TTL);
    return { data, cache: 'MISS' };
  } catch (err) {
    if (hit) return { data: hit.data, cache: 'STALE' };
    throw err;
  }
}

async function rateLimited(env, request) {
  if (!env.CACHE) return false; // KV 없으면 제한 불가 — 통과시킨다
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const bucket = Math.floor(Date.now() / (RL_WINDOW * 1000));
  const key = `rl:${ip}:${bucket}`;
  try {
    const n = parseInt(await env.CACHE.get(key), 10) || 0;
    if (n >= RL_LIMIT) return true;
    await env.CACHE.put(key, String(n + 1), { expirationTtl: RL_WINDOW * 2 });
  } catch { /* 제한 실패 시 통과 */ }
  return false;
}

/** 환율: KRW 기준 각 통화 환산율. 1차 소스 실패 시 2차로 폴백. */
async function fetchRates() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/KRW', {
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    if (r.ok) {
      const j = await r.json();
      if (j && j.rates) {
        return { rates: j.rates, updated: j.time_last_update_utc || null, source: 'er-api' };
      }
    }
  } catch { /* 2차 소스로 */ }

  const r2 = await fetch('https://api.frankfurter.app/latest?from=KRW', {
    cf: { cacheTtl: 600, cacheEverything: true },
  });
  if (!r2.ok) throw new Error('all rate sources failed');
  const j2 = await r2.json();
  return { rates: j2.rates, updated: j2.date || null, source: 'frankfurter' };
}

async function fetchHistory(days = 30) {
  const today = new Date();
  const from = new Date(today.getTime() - (days - 1) * 86400000);
  const fmt = (d) => d.toISOString().split('T')[0];
  const r = await fetch(
    `https://api.frankfurter.app/${fmt(from)}..${fmt(today)}?from=KRW&to=USD`,
    { cf: { cacheTtl: 3600, cacheEverything: true } }
  );
  if (!r.ok) throw new Error('history source failed');
  const j = await r.json();
  const series = Object.entries(j.rates || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, rate: v.USD ? Math.round(1 / v.USD) : null }))
    .filter((p) => p.rate);
  return { series };
}

/**
 * 관세청 UNIPASS HS코드/관세율 조회.
 * UNIPASS_KEY 시크릿이 설정되지 않으면 available:false 로 응답하고,
 * 프런트엔드는 기존 내장 표로 자동 폴백한다.
 */
async function fetchHsCode(env, q) {
  if (!env.UNIPASS_KEY) return { available: false, items: [] };
  const url =
    'https://unipass.customs.go.kr:38010/ext/rest/trrtQry/retrieveTrrt' +
    `?crkyCn=${encodeURIComponent(env.UNIPASS_KEY)}&hsSgn=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('unipass failed');
  const xml = await r.text();
  const pick = (tag, s) => {
    const m = s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : null;
  };
  const items = (xml.match(/<trrtQryRtnVo>[\s\S]*?<\/trrtQryRtnVo>/g) || []).map((b) => ({
    hsCode: pick('hsSgn', b),
    nameKo: pick('korNm', b),
    nameEn: pick('engNm', b),
    rate:   pick('trrt', b),
    unit:   pick('qtyUt', b),
  }));
  return { available: true, items };
}

/** 관세청 주간 고시환율 — 수출입 신고에 쓰이는 환율(시장 환율과 다름). */
async function fetchCustomsRate(env, currency) {
  if (!env.UNIPASS_KEY) return { available: false, rates: [] };
  const url =
    'https://unipass.customs.go.kr:38010/ext/rest/trifFxrtInfoQry/retrieveTrifFxrtInfo' +
    `?crkyCn=${encodeURIComponent(env.UNIPASS_KEY)}&imexTp=2`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('unipass fx failed');
  const xml = await r.text();
  const pick = (tag, s) => {
    const m = s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : null;
  };
  let rates = (xml.match(/<trifFxrtInfoQryRtnVo>[\s\S]*?<\/trifFxrtInfoQryRtnVo>/g) || []).map((b) => ({
    currency: pick('currSgn', b),
    country:  pick('cntySgn', b),
    rate:     parseFloat(pick('fxrt', b)) || null,
    week:     pick('aplyBgnDt', b),
  }));
  if (currency) rates = rates.filter((x) => x.currency === currency.toUpperCase());
  return { available: true, rates };
}

const api = {
  '/api/rates': async (env) => {
    const { data, cache } = await cached(env, 'rates:krw', RATE_TTL, fetchRates);
    return json(data, 200, { 'x-cache': cache });
  },
  '/api/rates/history': async (env) => {
    const { data, cache } = await cached(env, 'rates:hist:30', HISTORY_TTL, () => fetchHistory(30));
    return json(data, 200, { 'x-cache': cache });
  },
  '/api/hs': async (env, url) => {
    const q = (url.searchParams.get('q') || '').replace(/[^0-9]/g, '').slice(0, 10);
    if (!q) return json({ error: 'q(HS코드) 파라미터가 필요합니다', items: [] }, 400);
    const { data, cache } = await cached(env, `hs:${q}`, HS_TTL, () => fetchHsCode(env, q));
    return json(data, 200, { 'x-cache': cache });
  },
  '/api/customs-rate': async (env, url) => {
    const cur = (url.searchParams.get('currency') || '').replace(/[^A-Za-z]/g, '').slice(0, 3);
    const { data, cache } = await cached(env, `cfx:${cur || 'all'}`, RATE_TTL, () =>
      fetchCustomsRate(env, cur)
    );
    return json(data, 200, { 'x-cache': cache });
  },
  '/api/health': async (env) =>
    json({
      ok: true,
      kv: Boolean(env.CACHE),
      unipass: Boolean(env.UNIPASS_KEY),
    }),
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request); // 정적 자산
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-max-age': '86400',
        },
      });
    }
    if (request.method !== 'GET') return json({ error: 'GET만 지원합니다' }, 405);

    const handler = api[url.pathname];
    if (!handler) return json({ error: 'not found' }, 404);

    if (await rateLimited(env, request)) {
      return json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, {
        'retry-after': String(RL_WINDOW),
      });
    }

    try {
      return await handler(env, url, ctx);
    } catch (err) {
      return json({ error: '일시적으로 데이터를 가져오지 못했습니다', detail: String(err) }, 502);
    }
  },

  /** Cron: 캐시를 미리 채워 사용자 요청이 항상 캐시 히트가 되게 한다. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const now = Date.now();
        try {
          await kvPut(env, 'rates:krw', { data: await fetchRates(), ts: now }, STALE_TTL);
        } catch { /* 다음 주기에 재시도 */ }
        try {
          await kvPut(env, 'rates:hist:30', { data: await fetchHistory(30), ts: now }, STALE_TTL);
        } catch { /* 다음 주기에 재시도 */ }
      })()
    );
  },
};
