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



/* ═══════════════════════════════════════════════════════════════
   계정 · 저장 데이터 (Cloudflare D1)

   D1 바인딩(env.DB)이 없으면 계정 기능만 503 으로 응답하고
   계산기·환율 등 나머지는 그대로 동작한다. 프런트엔드는 /api/auth/me 의
   available:false 를 보고 로그인 UI를 감춘다.
   ═══════════════════════════════════════════════════════════════ */

const PBKDF2_ITERS   = 100000;
const SESSION_TTL    = 60 * 60 * 24 * 30;  // 30일
const MAX_RECORDS    = 500;                // 계정당 저장 개수 상한
const MAX_PAYLOAD    = 16384;              // 레코드 1건 최대 바이트
const LOCK_THRESHOLD = 10;                 // 연속 로그인 실패 허용 횟수
const LOCK_SECONDS   = 900;                // 잠금 15분

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function randomId(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(password, salt, iters) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters },
    key,
    256
  );
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, PBKDF2_ITERS);
  return `pbkdf2$sha256$${PBKDF2_ITERS}$${b64(salt)}$${b64(bits)}`;
}

/** 타이밍 공격을 피하려고 길이와 무관하게 전체를 비교한다. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
  const iters = parseInt(parts[2], 10);
  if (!Number.isFinite(iters) || iters < 1000 || iters > 1000000) return false;
  try {
    const bits = await pbkdf2(password, unb64(parts[3]), iters);
    return timingSafeEqual(b64(bits), parts[4]);
  } catch {
    return false;
  }
}

const normEmail = (v) => String(v || '').trim().toLowerCase();
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;

function cookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

const sessionCookie = (token, maxAge) =>
  `sid=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** 로그인한 사용자를 돌려준다. 세션이 없거나 만료면 null. */
async function currentUser(env, request) {
  if (!env.DB) return null;
  const token = cookie(request, 'sid');
  if (!token || token.length < 32) return null;
  const th = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?1`
  )
    .bind(th)
    .first();
  if (!row) return null;
  if (row.expires_at * 1000 < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(th).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

async function createSession(env, request, userId) {
  const token = randomId(32);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(
      await sha256Hex(token),
      userId,
      now,
      now + SESSION_TTL,
      (request.headers.get('user-agent') || '').slice(0, 200)
    )
    .run();
  // 만료된 세션은 로그인할 때마다 조금씩 걷어낸다 (별도 크론 불필요).
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now).run();
  return token;
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('bad content-type');
  const text = await request.text();
  if (text.length > 64 * 1024) throw new Error('body too large');
  return JSON.parse(text);
}

const needAuth = () => json({ error: '로그인이 필요합니다', code: 'unauthorized' }, 401);
const noDb = () =>
  json(
    {
      error: '계정 기능이 아직 설정되지 않았습니다',
      code: 'auth_unavailable',
      available: false,
    },
    503
  );

const authApi = {
  'POST /api/auth/signup': async (env, url, request) => {
    const body = await readJson(request);
    const email = normEmail(body.email);
    const password = String(body.password || '');
    const name = String(body.name || '').trim().slice(0, 40);

    if (!isEmail(email)) return json({ error: '이메일 형식이 올바르지 않습니다' }, 400);
    if (password.length < 8) return json({ error: '비밀번호는 8자 이상이어야 합니다' }, 400);
    if (password.length > 200) return json({ error: '비밀번호가 너무 깁니다' }, 400);

    const dup = await env.DB.prepare('SELECT id FROM users WHERE email_lower = ?1')
      .bind(email)
      .first();
    if (dup) return json({ error: '이미 가입된 이메일입니다' }, 409);

    const id = randomId();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_lower, name, password_hash, created_at, last_login_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`
    )
      .bind(id, String(body.email).trim(), email, name || null, await hashPassword(password), now)
      .run();

    const token = await createSession(env, request, id);
    return json(
      { ok: true, user: { id, email: String(body.email).trim(), name: name || null } },
      200,
      { 'set-cookie': sessionCookie(token, SESSION_TTL) }
    );
  },

  'POST /api/auth/login': async (env, url, request) => {
    const body = await readJson(request);
    const email = normEmail(body.email);
    const password = String(body.password || '');
    const fail = () => json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401);

    const user = await env.DB.prepare(
      `SELECT id, email, name, password_hash, fail_count, locked_until
         FROM users WHERE email_lower = ?1`
    )
      .bind(email)
      .first();
    if (!user) {
      // 계정이 없을 때도 해시 한 번을 돌려 응답 시간 차이로
      // 가입 여부가 드러나지 않게 한다.
      await hashPassword(password || 'x');
      return fail();
    }

    const now = Math.floor(Date.now() / 1000);
    if (user.locked_until > now) {
      return json(
        {
          error: `로그인 시도가 너무 많습니다. ${Math.ceil(
            (user.locked_until - now) / 60
          )}분 후 다시 시도해주세요.`,
        },
        429
      );
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      const n = (user.fail_count || 0) + 1;
      await env.DB.prepare('UPDATE users SET fail_count = ?2, locked_until = ?3 WHERE id = ?1')
        .bind(user.id, n, n >= LOCK_THRESHOLD ? now + LOCK_SECONDS : 0)
        .run();
      return fail();
    }

    await env.DB.prepare(
      'UPDATE users SET fail_count = 0, locked_until = 0, last_login_at = ?2 WHERE id = ?1'
    )
      .bind(user.id, now)
      .run();
    const token = await createSession(env, request, user.id);
    return json({ ok: true, user: { id: user.id, email: user.email, name: user.name } }, 200, {
      'set-cookie': sessionCookie(token, SESSION_TTL),
    });
  },

  'POST /api/auth/logout': async (env, url, request) => {
    const token = cookie(request, 'sid');
    if (token) {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1')
        .bind(await sha256Hex(token))
        .run();
    }
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  },

  'GET /api/auth/me': async (env, url, request) => {
    const user = await currentUser(env, request);
    return json({ available: true, user: user || null }, 200, {
      'cache-control': 'private, no-store',
    });
  },

  'POST /api/auth/password': async (env, url, request) => {
    const user = await currentUser(env, request);
    if (!user) return needAuth();
    const body = await readJson(request);
    const next = String(body.newPassword || '');
    if (next.length < 8) return json({ error: '새 비밀번호는 8자 이상이어야 합니다' }, 400);

    const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1')
      .bind(user.id)
      .first();
    if (!(await verifyPassword(String(body.currentPassword || ''), row.password_hash))) {
      return json({ error: '현재 비밀번호가 올바르지 않습니다' }, 401);
    }
    await env.DB.prepare('UPDATE users SET password_hash = ?2 WHERE id = ?1')
      .bind(user.id, await hashPassword(next))
      .run();
    // 비밀번호를 바꾸면 다른 기기의 세션을 모두 끊는다.
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(user.id).run();
    const token = await createSession(env, request, user.id);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_TTL) });
  },

  'DELETE /api/auth/account': async (env, url, request) => {
    const user = await currentUser(env, request);
    if (!user) return needAuth();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM records WHERE user_id = ?1').bind(user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(user.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(user.id),
    ]);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  },

  'GET /api/records': async (env, url, request) => {
    const user = await currentUser(env, request);
    if (!user) return needAuth();
    const kind = (url.searchParams.get('kind') || '').replace(/[^a-z0-9]/g, '').slice(0, 16);
    const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 100, 200);
    const q = kind
      ? env.DB.prepare(
          `SELECT id, kind, title, payload, created_at, updated_at FROM records
            WHERE user_id = ?1 AND kind = ?2 ORDER BY created_at DESC, rowid DESC LIMIT ?3`
        ).bind(user.id, kind, limit)
      : env.DB.prepare(
          `SELECT id, kind, title, payload, created_at, updated_at FROM records
            WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2`
        ).bind(user.id, limit);
    const { results } = await q.all();
    return json(
      {
        items: (results || []).map((r) => ({
          id: r.id,
          kind: r.kind,
          title: r.title,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          payload: safeParse(r.payload),
        })),
      },
      200,
      { 'cache-control': 'private, no-store' }
    );
  },

  'POST /api/records': async (env, url, request) => {
    const user = await currentUser(env, request);
    if (!user) return needAuth();
    const body = await readJson(request);
    const kind = String(body.kind || '').replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (!kind) return json({ error: 'kind 가 필요합니다' }, 400);

    const payload = JSON.stringify(body.payload ?? {});
    if (payload.length > MAX_PAYLOAD) return json({ error: '저장할 데이터가 너무 큽니다' }, 413);
    const title = String(body.title || '').slice(0, 120) || null;
    const now = Math.floor(Date.now() / 1000);

    if (body.id) {
      // 같은 id 가 오면 덮어쓴다 (프로젝트 수정).
      const id = String(body.id).replace(/[^a-f0-9]/g, '').slice(0, 32);
      const owned = await env.DB.prepare('SELECT id FROM records WHERE id = ?1 AND user_id = ?2')
        .bind(id, user.id)
        .first();
      if (!owned) return json({ error: '대상을 찾을 수 없습니다' }, 404);
      await env.DB.prepare(
        'UPDATE records SET title = ?2, payload = ?3, updated_at = ?4 WHERE id = ?1'
      )
        .bind(id, title, payload, now)
        .run();
      return json({ ok: true, id });
    }

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE user_id = ?1')
      .bind(user.id)
      .first();
    if ((count?.n || 0) >= MAX_RECORDS) {
      // 상한에 닿으면 가장 오래된 것부터 밀어낸다.
      await env.DB.prepare(
        `DELETE FROM records WHERE id IN (
           SELECT id FROM records WHERE user_id = ?1 ORDER BY created_at ASC, rowid ASC LIMIT ?2)`
      )
        .bind(user.id, (count.n || 0) - MAX_RECORDS + 1)
        .run();
    }

    const id = randomId();
    await env.DB.prepare(
      `INSERT INTO records (id, user_id, kind, title, payload, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`
    )
      .bind(id, user.id, kind, title, payload, now)
      .run();
    return json({ ok: true, id, createdAt: now });
  },

  'DELETE /api/records': async (env, url, request) => {
    const user = await currentUser(env, request);
    if (!user) return needAuth();
    const all = url.searchParams.get('all') === '1';
    const kind = (url.searchParams.get('kind') || '').replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (all) {
      const stmt = kind
        ? env.DB.prepare('DELETE FROM records WHERE user_id = ?1 AND kind = ?2').bind(user.id, kind)
        : env.DB.prepare('DELETE FROM records WHERE user_id = ?1').bind(user.id);
      await stmt.run();
      return json({ ok: true });
    }
    const id = (url.searchParams.get('id') || '').replace(/[^a-f0-9]/g, '').slice(0, 32);
    if (!id) return json({ error: 'id 가 필요합니다' }, 400);
    await env.DB.prepare('DELETE FROM records WHERE id = ?1 AND user_id = ?2')
      .bind(id, user.id)
      .run();
    return json({ ok: true });
  },
};

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
      accounts: Boolean(env.DB),
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

    if (await rateLimited(env, request)) {
      return json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429, {
        'retry-after': String(RL_WINDOW),
      });
    }

    // ── 계정 · 저장 데이터 ────────────────────────────────
    const authRoute = authApi[`${request.method} ${url.pathname}`];
    if (authRoute) {
      // 계정 API는 같은 출처에서만 받는다. 쿠키 인증이므로
      // CORS 허용 헤더를 붙이지 않고, 교차 출처 쓰기 요청은 막는다.
      if (request.method !== 'GET') {
        const origin = request.headers.get('origin');
        if (origin && new URL(origin).host !== url.host) {
          return json({ error: '허용되지 않은 요청입니다' }, 403);
        }
      }
      if (!env.DB) return noDb();
      try {
        return await authRoute(env, url, request, ctx);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('bad content-type') || msg.includes('JSON')) {
          return json({ error: '요청 형식이 올바르지 않습니다' }, 400);
        }
        return json({ error: '처리 중 오류가 발생했습니다' }, 500);
      }
    }
    // 계정 기능 자체가 꺼져 있는지 프런트엔드가 알 수 있게 한다.
    if (url.pathname.startsWith('/api/auth/') || url.pathname === '/api/records') {
      return env.DB ? json({ error: 'not found' }, 404) : noDb();
    }

    if (request.method !== 'GET') return json({ error: 'GET만 지원합니다' }, 405);

    const handler = api[url.pathname];
    if (!handler) return json({ error: 'not found' }, 404);

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
