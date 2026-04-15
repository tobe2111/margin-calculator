// ===== Shared Navigation Component =====
(function () {
    // ===== Dark Mode =====
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    function toggleDarkMode() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.getElementById('darkToggleIcon');
        if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // ===== Nav Links =====
    const links = [
        { href: '/',           label: '마진 계산기' },
        { href: '/platforms/', label: '플랫폼 비교'  },
        { href: '/tools/',     label: '도구 모음'    },
        { href: '/market/',    label: '시장 정보'    },
        { href: '/guide/',     label: '셀러 가이드'  },
    ];

    const path = window.location.pathname.replace(/\/index\.html$/, '/');

    function isActive(href) {
        if (href === '/') return path === '/';
        return path.startsWith(href);
    }

    const navLinksHTML = links.map(l =>
        `<a href="${l.href}" class="nav-link${isActive(l.href) ? ' active' : ''}">${l.label}</a>`
    ).join('');

    const isDark = savedTheme === 'dark';

    const navHTML = `
        <div class="site-nav-inner">
            <a href="/" class="nav-brand">
                <img src="/favicon.svg" alt="유어팀" width="24" height="24" onerror="this.style.display='none'">
                <span>유어팀 마진 계산기</span>
            </a>
            <nav class="nav-links" id="siteNavLinks" role="navigation" aria-label="메인 네비게이션">
                ${navLinksHTML}
            </nav>
            <div class="nav-actions">
                <button class="nav-dark-toggle" id="darkToggle" aria-label="다크모드 전환" title="다크모드">
                    <i id="darkToggleIcon" class="${isDark ? 'fas fa-sun' : 'fas fa-moon'}"></i>
                </button>
                <button class="nav-toggle" id="siteNavToggle" aria-label="메뉴 열기" aria-expanded="false">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
        </div>
    `;

    const siteNav = document.createElement('div');
    siteNav.className = 'site-nav';
    siteNav.innerHTML = navHTML;

    const insertAfter = document.querySelector('.header, header, #topBanner');
    if (insertAfter) {
        insertAfter.after(siteNav);
    } else {
        document.body.insertBefore(siteNav, document.body.firstChild);
    }

    // Dark mode toggle
    document.getElementById('darkToggle').addEventListener('click', toggleDarkMode);

    // Mobile toggle
    const toggle = document.getElementById('siteNavToggle');
    const navLinks = document.getElementById('siteNavLinks');
    if (toggle && navLinks) {
        toggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen);
            toggle.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
        });
        document.addEventListener('click', (e) => {
            if (!siteNav.contains(e.target)) {
                navLinks.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.querySelector('i').className = 'fas fa-bars';
            }
        });
    }

    // ===== Service Worker Registration =====
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
    }
})();
