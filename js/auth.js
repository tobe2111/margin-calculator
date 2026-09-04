/**
 * 계정 · 저장 데이터 프런트엔드.
 *
 * 설계 원칙
 *  1) 로그인은 '있으면 좋은 것'이다. 서버가 계정 기능을 켜지 않았거나(D1 미설정)
 *     네트워크가 끊겨도 계산기는 지금처럼 localStorage 만으로 동작해야 한다.
 *     그래서 모든 서버 호출은 실패해도 조용히 로컬 동작으로 되돌아간다.
 *  2) 로그인하면 히스토리·프로젝트가 서버에도 남아 기기를 옮겨도 이어진다.
 *     로그인하는 순간, 그때까지 이 브라우저에 쌓인 로컬 기록을 한 번 올려준다.
 *  3) 비밀번호는 서버에서만 다루고, 세션은 HttpOnly 쿠키라 JS가 읽지 못한다.
 */
(function () {
    'use strict';

    const state = { ready: false, available: false, user: null };
    const listeners = [];

    const api = async (path, options = {}) => {
        const res = await fetch(path, {
            credentials: 'same-origin',
            headers: options.body ? { 'content-type': 'application/json' } : {},
            ...options,
        });
        let data = null;
        try { data = await res.json(); } catch (e) { /* 본문 없는 응답 */ }
        if (!res.ok) {
            const err = new Error((data && data.error) || '요청에 실패했습니다');
            err.status = res.status;
            err.code = data && data.code;
            throw err;
        }
        return data || {};
    };

    const emit = () => listeners.forEach(fn => { try { fn(state); } catch (e) {} });

    /**
     * 알림. 메인 계산기에는 showToast 가 이미 있고, 다른 페이지에는 없으므로
     * 없으면 같은 모양의 토스트를 직접 만들어 띄운다.
     */
    let toastEl = null, toastTimer = null;
    const toast = (msg) => {
        if (typeof window.showToast === 'function') { window.showToast(msg); return; }
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'auth-toast';
            toastEl.setAttribute('role', 'status');
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
    };

    // ── 사이드바 계정 블록 ────────────────────────────────
    function renderAccount() {
        const box = document.getElementById('sbAccount');
        if (!box) return;
        if (!state.available) { box.hidden = true; box.innerHTML = ''; return; }
        box.hidden = false;

        if (state.user) {
            const label = state.user.name || state.user.email.split('@')[0];
            box.innerHTML = `
              <div class="sb-acc-in">
                <span class="sb-avatar" aria-hidden="true">${escapeHtml(label.slice(0, 1).toUpperCase())}</span>
                <span class="sb-acc-name" title="${escapeHtml(state.user.email)}">${escapeHtml(label)}</span>
              </div>
              <div class="sb-acc-actions">
                <button type="button" data-auth="saved">저장한 계산</button>
                <button type="button" data-auth="account">계정</button>
              </div>`;
        } else {
            box.innerHTML = `
              <button type="button" class="sb-login-btn" data-auth="open-login">
                <i class="fas fa-right-to-bracket" aria-hidden="true"></i> 로그인 / 회원가입
              </button>
              <p class="sb-acc-hint">로그인하면 계산 히스토리가 계정에 저장돼 다른 기기에서도 이어집니다.</p>`;
        }
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ── 모달 ─────────────────────────────────────────────
    let modal = null;
    let lastFocused = null;

    function ensureModal() {
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.id = 'authModal';
        modal.hidden = true;
        modal.innerHTML = `
          <div class="auth-scrim" data-auth="close"></div>
          <div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="authTitle">
            <button type="button" class="auth-close" data-auth="close" aria-label="닫기">
              <i class="fas fa-xmark"></i>
            </button>
            <h2 id="authTitle">로그인</h2>
            <div class="auth-body"></div>
          </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-auth="close"]')) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) closeModal();
        });
        return modal;
    }

    function openModal(title, html, onMount) {
        const m = ensureModal();
        lastFocused = document.activeElement;
        m.querySelector('#authTitle').textContent = title;
        const body = m.querySelector('.auth-body');
        body.innerHTML = html;
        m.hidden = false;
        document.body.classList.add('auth-open');
        if (onMount) onMount(body);
        const first = body.querySelector('input, button, select, textarea');
        if (first) first.focus();
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('auth-open');
        if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    const errLine = '<p class="auth-err" role="alert" hidden></p>';
    const showErr = (body, msg) => {
        const el = body.querySelector('.auth-err');
        if (!el) return;
        el.textContent = msg;
        el.hidden = !msg;
    };

    function loginForm(prefill = '') {
        openModal('로그인', `
          <form class="auth-form" data-form="login" novalidate>
            ${errLine}
            <label for="authEmail">이메일</label>
            <input type="email" id="authEmail" name="email" autocomplete="username"
                   inputmode="email" required value="${escapeHtml(prefill)}">
            <label for="authPw">비밀번호</label>
            <input type="password" id="authPw" name="password" autocomplete="current-password" required>
            <button type="submit" class="auth-submit">로그인</button>
            <p class="auth-alt">계정이 없으신가요?
              <button type="button" data-auth="to-signup">회원가입</button>
            </p>
          </form>`, (body) => {
            body.querySelector('[data-auth="to-signup"]').onclick = () =>
                signupForm(body.querySelector('#authEmail').value);
            body.querySelector('form').onsubmit = async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('.auth-submit');
                btn.disabled = true; btn.textContent = '로그인 중…';
                showErr(body, '');
                try {
                    const r = await api('/api/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({
                            email: body.querySelector('#authEmail').value,
                            password: body.querySelector('#authPw').value,
                        }),
                    });
                    state.user = r.user;
                    closeModal();
                    renderAccount();
                    emit();
                    toast('로그인했습니다');
                    await pushLocalHistory();
                    if (typeof gtag === 'function') gtag('event', 'login', { method: 'password' });
                } catch (err) {
                    showErr(body, err.message);
                    btn.disabled = false; btn.textContent = '로그인';
                }
            };
        });
    }

    function signupForm(prefill = '') {
        openModal('회원가입', `
          <form class="auth-form" data-form="signup" novalidate>
            ${errLine}
            <label for="suName">이름 <span class="auth-opt">(선택)</span></label>
            <input type="text" id="suName" name="name" autocomplete="nickname" maxlength="40">
            <label for="suEmail">이메일</label>
            <input type="email" id="suEmail" name="email" autocomplete="username"
                   inputmode="email" required value="${escapeHtml(prefill)}">
            <label for="suPw">비밀번호 <span class="auth-opt">(8자 이상)</span></label>
            <input type="password" id="suPw" name="password" autocomplete="new-password"
                   minlength="8" required>
            <button type="submit" class="auth-submit">가입하고 시작하기</button>
            <p class="auth-note">가입하면 <a href="/terms/" target="_blank" rel="noopener">이용약관</a>과
              <a href="/privacy/" target="_blank" rel="noopener">개인정보처리방침</a>에 동의하는 것으로 봅니다.
              저장되는 정보는 이메일과 직접 저장한 계산 내용뿐입니다.</p>
            <p class="auth-alt">이미 계정이 있으신가요?
              <button type="button" data-auth="to-login">로그인</button>
            </p>
          </form>`, (body) => {
            body.querySelector('[data-auth="to-login"]').onclick = () =>
                loginForm(body.querySelector('#suEmail').value);
            body.querySelector('form').onsubmit = async (e) => {
                e.preventDefault();
                const pw = body.querySelector('#suPw').value;
                if (pw.length < 8) return showErr(body, '비밀번호는 8자 이상이어야 합니다');
                const btn = e.target.querySelector('.auth-submit');
                btn.disabled = true; btn.textContent = '가입 중…';
                showErr(body, '');
                try {
                    const r = await api('/api/auth/signup', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: body.querySelector('#suName').value,
                            email: body.querySelector('#suEmail').value,
                            password: pw,
                        }),
                    });
                    state.user = r.user;
                    closeModal();
                    renderAccount();
                    emit();
                    toast('가입이 완료되었습니다');
                    await pushLocalHistory();
                    if (typeof gtag === 'function') gtag('event', 'sign_up', { method: 'password' });
                } catch (err) {
                    showErr(body, err.message);
                    btn.disabled = false; btn.textContent = '가입하고 시작하기';
                }
            };
        });
    }

    // ── 저장한 계산 목록 ──────────────────────────────────
    const KIND_LABEL = {
        calc: '마진 계산', shopee: '쇼피 국가별', qoo10: '큐텐 재팬', project: '프로젝트',
    };

    async function savedList() {
        openModal('저장한 계산', '<p class="auth-loading">불러오는 중…</p>', async (body) => {
            let items = [];
            try {
                items = (await api('/api/records?limit=200')).items || [];
            } catch (err) {
                body.innerHTML = `<p class="auth-err">${escapeHtml(err.message)}</p>`;
                return;
            }
            if (!items.length) {
                body.innerHTML = `<p class="auth-empty">아직 저장한 계산이 없습니다.<br>
                  계산 결과 아래의 <strong>계정에 저장</strong> 버튼을 눌러 보세요.</p>`;
                return;
            }
            body.innerHTML = `
              <div class="saved-toolbar">
                <span>${items.length}건</span>
                <button type="button" data-saved="export">JSON 내보내기</button>
              </div>
              <ul class="saved-list">
                ${items.map(it => `
                  <li data-id="${escapeHtml(it.id)}">
                    <div class="saved-main">
                      <span class="saved-kind k-${escapeHtml(it.kind)}">${escapeHtml(KIND_LABEL[it.kind] || it.kind)}</span>
                      <strong>${escapeHtml(it.title || '(제목 없음)')}</strong>
                      <em>${new Date(it.createdAt * 1000).toLocaleString('ko-KR')}</em>
                    </div>
                    <div class="saved-side">
                      ${summarize(it)}
                      <button type="button" class="saved-del" data-saved="del"
                              aria-label="삭제"><i class="fas fa-trash"></i></button>
                    </div>
                  </li>`).join('')}
              </ul>`;

            body.querySelector('[data-saved="export"]').onclick = () => {
                const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `margin-records-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            };
            body.querySelectorAll('[data-saved="del"]').forEach(btn => {
                btn.onclick = async () => {
                    const li = btn.closest('li');
                    btn.disabled = true;
                    try {
                        await api(`/api/records?id=${encodeURIComponent(li.dataset.id)}`,
                            { method: 'DELETE' });
                        li.remove();
                        if (!body.querySelector('.saved-list li')) savedList();
                    } catch (err) {
                        btn.disabled = false;
                        toast(err.message);
                    }
                };
            });
        });
    }

    function summarize(item) {
        const p = item.payload || {};
        const won = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');
        if (typeof p.netProfit === 'number' && typeof p.marginRate === 'number') {
            const cls = p.netProfit >= 0 ? 'pos' : 'neg';
            return `<span class="saved-num ${cls}">${won(p.netProfit)} · ${p.marginRate.toFixed(1)}%</span>`;
        }
        if (typeof p.bestCountry === 'string') {
            return `<span class="saved-num">${escapeHtml(p.bestCountry)}</span>`;
        }
        return '';
    }

    // ── 계정 관리 ────────────────────────────────────────
    function accountPanel() {
        const u = state.user;
        openModal('계정', `
          <dl class="acc-info">
            <div><dt>이메일</dt><dd>${escapeHtml(u.email)}</dd></div>
            ${u.name ? `<div><dt>이름</dt><dd>${escapeHtml(u.name)}</dd></div>` : ''}
          </dl>
          <form class="auth-form" data-form="pw">
            ${errLine}
            <label for="curPw">현재 비밀번호</label>
            <input type="password" id="curPw" autocomplete="current-password">
            <label for="newPw">새 비밀번호 <span class="auth-opt">(8자 이상)</span></label>
            <input type="password" id="newPw" autocomplete="new-password" minlength="8">
            <button type="submit" class="auth-submit secondary">비밀번호 변경</button>
          </form>
          <div class="acc-danger">
            <button type="button" data-auth="logout" class="acc-logout">
              <i class="fas fa-right-from-bracket"></i> 로그아웃
            </button>
            <button type="button" data-auth="delete" class="acc-delete">계정 삭제</button>
          </div>
          <p class="auth-note">계정을 삭제하면 저장한 계산도 함께 지워지며 되돌릴 수 없습니다.</p>
        `, (body) => {
            body.querySelector('form').onsubmit = async (e) => {
                e.preventDefault();
                showErr(body, '');
                const btn = e.target.querySelector('.auth-submit');
                btn.disabled = true;
                try {
                    await api('/api/auth/password', {
                        method: 'POST',
                        body: JSON.stringify({
                            currentPassword: body.querySelector('#curPw').value,
                            newPassword: body.querySelector('#newPw').value,
                        }),
                    });
                    closeModal();
                    toast('비밀번호를 변경했습니다. 다른 기기는 다시 로그인해야 합니다.');
                } catch (err) {
                    showErr(body, err.message);
                } finally {
                    btn.disabled = false;
                }
            };
            body.querySelector('[data-auth="logout"]').onclick = () => logout();
            body.querySelector('[data-auth="delete"]').onclick = async () => {
                if (!confirm('정말 계정을 삭제할까요? 저장한 계산이 모두 지워지며 되돌릴 수 없습니다.')) return;
                try {
                    await api('/api/auth/account', { method: 'DELETE' });
                    state.user = null;
                    closeModal();
                    renderAccount();
                    emit();
                    toast('계정을 삭제했습니다');
                } catch (err) {
                    toast(err.message);
                }
            };
        });
    }

    async function logout() {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
        state.user = null;
        closeModal();
        renderAccount();
        emit();
        toast('로그아웃했습니다');
    }

    /**
     * 로그인 직후, 이 브라우저에 쌓여 있던 로컬 히스토리를 한 번 올린다.
     * 여러 번 올리지 않도록 올린 항목의 타임스탬프를 기억한다.
     */
    async function pushLocalHistory() {
        let local = [];
        try {
            local = JSON.parse(localStorage.getItem('marginCalcHistory') || '[]');
        } catch (e) { return; }
        if (!Array.isArray(local) || !local.length) return;

        let synced = [];
        try { synced = JSON.parse(localStorage.getItem('syncedHistory') || '[]'); } catch (e) {}
        const pending = local.filter(h => h && !synced.includes(h.timestamp)).slice(0, 50);
        if (!pending.length) return;

        let ok = 0;
        for (const h of pending) {
            try {
                await api('/api/records', {
                    method: 'POST',
                    body: JSON.stringify({
                        kind: 'calc',
                        title: h.productName || '이름 없는 계산',
                        payload: h,
                    }),
                });
                synced.push(h.timestamp);
                ok++;
            } catch (e) { break; }  // 실패하면 멈춘다. 다음 로그인 때 다시 시도한다.
        }
        try { localStorage.setItem('syncedHistory', JSON.stringify(synced.slice(-500))); } catch (e) {}
        if (ok) toast(`이 기기의 계산 ${ok}건을 계정에 올렸습니다`);
    }

    // ── 공개 API ─────────────────────────────────────────
    const Auth = {
        get state() { return state; },
        get user() { return state.user; },
        isLoggedIn: () => Boolean(state.user),
        isAvailable: () => state.available,
        onChange(fn) { listeners.push(fn); if (state.ready) fn(state); },
        openLogin: () => loginForm(),
        openSaved: () => savedList(),
        logout,

        /** 로그인 상태면 서버에 저장한다. 아니면 로그인 창을 띄운다. */
        async save(kind, title, payload) {
            if (!state.available) { toast('계정 기능이 아직 열리지 않았습니다'); return null; }
            if (!state.user) { loginForm(); return null; }
            try {
                const r = await api('/api/records', {
                    method: 'POST',
                    body: JSON.stringify({ kind, title, payload }),
                });
                toast('계정에 저장했습니다');
                return r.id;
            } catch (err) {
                toast(err.message);
                return null;
            }
        },

        /**
         * 계산할 때마다 자동으로 올리는 경로. 알림을 띄우지 않고,
         * 로그인 상태가 아니거나 실패해도 아무 일도 일어나지 않는다.
         * (로컬 히스토리는 이와 무관하게 이미 저장돼 있다)
         */
        async saveSilent(kind, title, payload) {
            if (!state.available || !state.user) return null;
            try {
                const r = await api('/api/records', {
                    method: 'POST',
                    body: JSON.stringify({ kind, title, payload }),
                });
                return r.id;
            } catch (err) {
                return null;
            }
        },

        async list(kind) {
            if (!state.user) return [];
            try {
                const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
                return (await api(`/api/records${q}`)).items || [];
            } catch (e) { return []; }
        },
    };
    window.Auth = Auth;

    // ── 부트 ─────────────────────────────────────────────
    function bindDelegates() {
        document.addEventListener('click', (e) => {
            const t = e.target.closest('[data-auth]');
            if (!t) return;
            const action = t.getAttribute('data-auth');
            if (action === 'open-login') { e.preventDefault(); loginForm(); }
            else if (action === 'saved')  { e.preventDefault(); savedList(); }
            else if (action === 'account'){ e.preventDefault(); accountPanel(); }
        });
    }

    async function boot() {
        bindDelegates();
        try {
            const r = await api('/api/auth/me');
            state.available = r.available !== false;
            state.user = r.user || null;
        } catch (err) {
            // 503(auth_unavailable)이면 서버가 아직 계정 기능을 켜지 않은 것이다.
            // 그 외(네트워크 오류 등)도 로그인 UI 없이 계산기만 쓰게 둔다.
            state.available = false;
            state.user = null;
        }
        state.ready = true;
        renderAccount();
        emit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
