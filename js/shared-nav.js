// ===== Shared Navigation Component =====
(function () {
    const links = [
        { href: '/',           label: '마진 계산기', icon: 'fa-calculator' },
        { href: '/platforms/', label: '플랫폼 비교',  icon: 'fa-balance-scale' },
        { href: '/tools/',     label: '도구 모음',    icon: 'fa-tools' },
        { href: '/guide/',     label: '셀러 가이드',  icon: 'fa-book-open' },
    ];

    const path = window.location.pathname.replace(/\/index\.html$/, '/');

    function isActive(href) {
        if (href === '/') return path === '/';
        return path.startsWith(href);
    }

    const navLinksHTML = links.map(l => `
        <a href="${l.href}" class="nav-link${isActive(l.href) ? ' active' : ''}">${l.label}</a>
    `).join('');

    const navHTML = `
        <div class="site-nav-inner">
            <a href="/" class="nav-brand">
                <img src="/favicon.svg" alt="유어팀" width="24" height="24" onerror="this.style.display='none'">
                <span>유어팀 마진 계산기</span>
            </a>
            <nav class="nav-links" id="siteNavLinks" role="navigation" aria-label="메인 네비게이션">
                ${navLinksHTML}
            </nav>
            <button class="nav-toggle" id="siteNavToggle" aria-label="메뉴 열기" aria-expanded="false">
                <i class="fas fa-bars"></i>
            </button>
        </div>
    `;

    const siteNav = document.createElement('div');
    siteNav.className = 'site-nav';
    siteNav.innerHTML = navHTML;

    // Insert after header or top-banner, before main content
    const insertAfter = document.querySelector('.header, header, #topBanner');
    if (insertAfter) {
        insertAfter.after(siteNav);
    } else {
        document.body.insertBefore(siteNav, document.body.firstChild);
    }

    // Mobile toggle
    const toggle = document.getElementById('siteNavToggle');
    const navLinks = document.getElementById('siteNavLinks');
    if (toggle && navLinks) {
        toggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen);
            toggle.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
        });
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!siteNav.contains(e.target)) {
                navLinks.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.querySelector('i').className = 'fas fa-bars';
            }
        });
    }
})();
