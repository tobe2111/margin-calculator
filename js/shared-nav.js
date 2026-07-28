// ===== 좌측 사이드바 =====
// 증권사 대시보드처럼 이동 메뉴와 시세를 항상 왼쪽에 띄워둔다.
// 상단 가로 바보다 세로 공간을 덜 먹고, 환율·바로가기를 상시 노출할 수 있어
// 화면 밀도가 올라간다. 모든 페이지가 이 파일 하나로 같은 구조를 갖는다.
(function () {
    const links = [
        { href: '/',           label: '마진 계산기',   icon: 'fa-calculator' },
        { href: '/tools/',     label: '도구 모음',     icon: 'fa-toolbox' },
        { href: '/dashboard/', label: '셀러 대시보드', icon: 'fa-chart-pie' },
        { href: '/platforms/', label: '플랫폼 비교',   icon: 'fa-scale-balanced' },
        { href: '/guide/',     label: '셀러 가이드',   icon: 'fa-book-open' },
    ];

    // 사이드바에 상시 노출할 바로가기 (도구 페이지 앵커)
    const shortcuts = [
        { href: '/tools/#tool-shipping', label: '배송비 계산' },
        { href: '/tools/#tool-fba',      label: 'FBA 수수료' },
        { href: '/tools/#tool-minprice', label: '최소 판매가' },
        { href: '/tools/#tool-fxstress', label: '환율 스트레스' },
    ];

    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    const isActive = (href) => (href === '/' ? path === '/' : path.startsWith(href));

    const navHTML = `
      <div class="sidebar-inner">
        <a href="/" class="sb-brand">
          <img src="/favicon.svg" alt="" width="22" height="22" onerror="this.style.display='none'">
          <span>유어팀 마진 계산기</span>
        </a>

        <nav class="sb-nav" aria-label="메인 네비게이션">
          ${links.map(l => `
            <a href="${l.href}" class="sb-link${isActive(l.href) ? ' active' : ''}">
              <i class="fas ${l.icon}" aria-hidden="true"></i><span>${l.label}</span>
            </a>`).join('')}
        </nav>

        <div class="sb-block">
          <div class="sb-block-head">주요 환율<span id="sbRateState"></span></div>
          <ul class="sb-rates" id="sbRates">
            <li><b>USD</b><em data-sb="USD">—</em></li>
            <li><b>JPY<small>100</small></b><em data-sb="JPY100">—</em></li>
            <li><b>EUR</b><em data-sb="EUR">—</em></li>
            <li><b>CNY</b><em data-sb="CNY">—</em></li>
          </ul>
        </div>

        <div class="sb-block">
          <div class="sb-block-head">바로가기</div>
          <div class="sb-shortcuts">
            ${shortcuts.map(s => `<a href="${s.href}">${s.label}</a>`).join('')}
          </div>
        </div>

        <div class="sb-foot">
          <a href="/privacy/">개인정보처리방침</a>
          <a href="/terms/">이용약관</a>
        </div>
      </div>`;

    const sidebar = document.createElement('aside');
    sidebar.className = 'site-sidebar';
    sidebar.id = 'siteSidebar';
    sidebar.innerHTML = navHTML;

    // 모바일용 열기 버튼 + 배경 가림막
    const bar = document.createElement('div');
    bar.className = 'sb-mobilebar';
    bar.innerHTML = `
      <button class="sb-toggle" id="sbToggle" aria-label="메뉴 열기" aria-expanded="false">
        <i class="fas fa-bars"></i>
      </button>
      <a href="/" class="sb-mobilebrand">유어팀 마진 계산기</a>`;
    const scrim = document.createElement('div');
    scrim.className = 'sb-scrim';
    scrim.id = 'sbScrim';

    document.body.insertBefore(scrim, document.body.firstChild);
    document.body.insertBefore(sidebar, document.body.firstChild);
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-sidebar');

    const toggle = document.getElementById('sbToggle');
    const close = () => {
        sidebar.classList.remove('open');
        scrim.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.querySelector('i').className = 'fas fa-bars';
    };
    toggle.addEventListener('click', () => {
        const open = sidebar.classList.toggle('open');
        scrim.classList.toggle('show', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.querySelector('i').className = open ? 'fas fa-times' : 'fas fa-bars';
    });
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

    /**
     * 사이드바 환율 표시.
     * 계산기 페이지에서는 calculator.js 가 이미 환율을 들고 있으므로 그 값을
     * 쓰고(renderSidebarRates 를 노출), 다른 페이지에서는 직접 한 번 가져온다.
     */
    window.renderSidebarRates = function (rates, state) {
        const box = document.getElementById('sbRates');
        if (!box || !rates) return;
        const put = (k, v) => {
            const el = box.querySelector(`[data-sb="${k}"]`);
            if (el) el.textContent = (typeof v === 'number' && isFinite(v) && v > 0)
                ? v.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '—';
        };
        put('USD', rates.USD);
        put('JPY100', typeof rates.JPY === 'number' ? rates.JPY * 100 : null);
        put('EUR', rates.EUR);
        put('CNY', rates.CNY);
        const st = document.getElementById('sbRateState');
        if (st && state) {
            const map = { live: '실시간', cache: '캐시', stale: '지연', fallback: '연결 실패' };
            st.textContent = map[state] || '';
            st.className = (state === 'fallback' || state === 'stale') ? 'warn' : '';
        }
    };

    // 계산기 페이지가 아니면 스스로 한 번 불러온다
    if (!document.getElementById('exchangeRate')) {
        fetch('/api/rates')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(j => {
                const r = j.rates || {};
                const inv = (c) => (r[c] ? Math.round(1 / r[c]) : null);
                window.renderSidebarRates({
                    USD: inv('USD'), EUR: inv('EUR'), CNY: inv('CNY'),
                    JPY: r.JPY ? (1 / r.JPY) : null,
                }, 'live');
            })
            .catch(() => {
                const st = document.getElementById('sbRateState');
                if (st) { st.textContent = '연결 실패'; st.className = 'warn'; }
            });
    }
})();
