/**
 * 유어팀 마진 계산기 - Cloudflare Worker
 * 쿠팡 파트너스 API 프록시 + 정적 에셋 서빙
 *
 * 환경변수 설정 (wrangler secret put 으로 추가):
 *   COUPANG_ACCESS_KEY
 *   COUPANG_SECRET_KEY
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // ─── CORS Preflight ───────────────────────────────────────────
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders() });
        }

        // ─── API Routes ───────────────────────────────────────────────
        if (url.pathname.startsWith('/api/coupang/')) {
            return handleCoupangAPI(request, url, env);
        }

        // ─── Static Assets (Cloudflare Pages / Workers Assets) ────────
        // Fall through to asset binding
        return env.ASSETS.fetch(request);
    }
};

// ─── CORS Headers ─────────────────────────────────────────────────────────────
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': 'https://margin.ur-team.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json;charset=UTF-8', ...corsHeaders() }
    });
}

// ─── Coupang API Proxy ─────────────────────────────────────────────────────────
async function handleCoupangAPI(request, url, env) {
    if (!env.COUPANG_ACCESS_KEY || !env.COUPANG_SECRET_KEY) {
        return jsonResponse({ error: 'API keys not configured' }, 503);
    }

    const sub = url.pathname.replace('/api/coupang/', '');

    try {
        if (sub === 'search' && request.method === 'GET') {
            return await coupangSearch(url, env);
        }
        if (sub === 'deeplink' && request.method === 'POST') {
            return await coupangDeeplink(request, env);
        }
        if (sub === 'best' && request.method === 'GET') {
            return await coupangBest(url, env);
        }
        return jsonResponse({ error: 'Unknown endpoint' }, 404);
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}

// 상품 검색
async function coupangSearch(url, env) {
    const keyword = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);
    if (!keyword.trim()) return jsonResponse({ error: 'keyword required' }, 400);

    const path = `/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
    const res = await coupangFetch(env, 'GET', path);
    const data = await res.json();
    return jsonResponse(data, res.status);
}

// 딥링크 생성 (어필리에이트 URL 변환)
async function coupangDeeplink(request, env) {
    const body = await request.json();
    const urls = body.coupangUrls || [];
    if (!urls.length) return jsonResponse({ error: 'coupangUrls required' }, 400);

    const path = '/v2/providers/affiliate_open_api/apis/openapi/deeplink';
    const res = await coupangFetch(env, 'POST', path, { coupangUrls: urls });
    const data = await res.json();
    return jsonResponse(data, res.status);
}

// 카테고리 베스트 상품
async function coupangBest(url, env) {
    const categoryId = url.searchParams.get('categoryId') || '1005';
    const path = `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/${categoryId}`;
    const res = await coupangFetch(env, 'GET', path);
    const data = await res.json();
    return jsonResponse(data, res.status);
}

// ─── 쿠팡 API 서명 생성 ───────────────────────────────────────────────────────
async function hmacSha256(secretKey, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secretKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCoupangDatetime() {
    // Format: YYYYMMDDTHHmmssZ
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

async function coupangFetch(env, method, path, body = null) {
    const datetime = getCoupangDatetime();
    const message = `${method}\n${datetime}\n${path}`;
    const signature = await hmacSha256(env.COUPANG_SECRET_KEY, message);
    const authorization = `CEA algorithm=HmacSHA256, access-key=${env.COUPANG_ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;

    const options = {
        method,
        headers: {
            'Authorization': authorization,
            'Content-Type': 'application/json;charset=UTF-8',
        },
    };
    if (body) options.body = JSON.stringify(body);

    return fetch(`https://api.coupang.com${path}`, options);
}
