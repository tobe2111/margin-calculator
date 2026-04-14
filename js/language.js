// ===== Multi-Language System =====

// Current language (default: auto-detect or Korean)
let currentLanguage = 'ko';

// Initialize language system
function initLanguageSystem() {
    // Auto-detect browser language
    const browserLang = detectBrowserLanguage();
    
    // Check if user has saved language preference
    const savedLang = localStorage.getItem('selectedLanguage');
    
    // Set initial language
    currentLanguage = savedLang || browserLang;
    
    // Apply language
    applyLanguage(currentLanguage);
    
    // Setup language selector event listeners
    setupLanguageSelector();
    
    console.log('🌍 Language System Initialized:', currentLanguage);
}

// Detect browser language
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // 'en-US' -> 'en'
    
    // Supported languages
    const supportedLangs = ['ko', 'en', 'zh', 'ja', 'vi'];
    
    // Return language if supported, otherwise default to Korean
    return supportedLangs.includes(langCode) ? langCode : 'ko';
}

// Apply language to entire page
function applyLanguage(lang) {
    currentLanguage = lang;
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            // Special handling for footer contact - preserve email link
            if (key === 'ft.contact') {
                const emailLink = element.querySelector('a[href^="mailto:"]');
                if (emailLink) {
                    // Update only the text before the link
                    element.childNodes[0].textContent = translations[lang][key] + ' ';
                } else {
                    element.textContent = translations[lang][key];
                }
            } else {
                element.textContent = translations[lang][key];
            }
        }
    });
    
    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });
    
    // Update meta tags
    updateMetaTags(lang);
    
    // Update current language display
    updateLanguageDisplay(lang);
    
    // Save language preference
    localStorage.setItem('selectedLanguage', lang);
    
    // Track language change in GA4
    if (typeof gtag !== 'undefined') {
        gtag('event', 'language_change', {
            'language': lang,
            'previous_language': localStorage.getItem('previousLanguage') || 'none'
        });
    }
    
    localStorage.setItem('previousLanguage', lang);
}

// Update meta tags for SEO
function updateMetaTags(lang) {
    const titles = {
        ko: '유어팀 마진 계산기 | 라자다 틱톡샵 이베이 아마존 쇼피 셀러 수익 계산',
        en: 'YourTeam Margin Calculator | Lazada TikTok eBay Amazon Shopee Seller Profit Calculator',
        zh: '您的团队利润计算器 | Lazada TikTok eBay Amazon Shopee 卖家利润计算器',
        ja: 'ユアチームマージン計算機 | Lazada TikTok eBay Amazon Shopee セラー利益計算機',
        vi: 'Máy Tính Lợi Nhuận YourTeam | Lazada TikTok eBay Amazon Shopee'
    };
    
    const descriptions = {
        ko: '유어팀 마진 계산기 - 라자다, 틱톡샵, 이베이, 아마존, 쇼피, 큐텐 셀러 필수 도구! 해외판매 수익 실시간 계산.',
        en: 'YourTeam Margin Calculator - Essential tool for Lazada, TikTok Shop, eBay, Amazon, Shopee sellers! Real-time profit calculation.',
        zh: '您的团队利润计算器 - Lazada、TikTok Shop、eBay、Amazon、Shopee卖家必备工具！实时利润计算。',
        ja: 'ユアチームマージン計算機 - Lazada、TikTok Shop、eBay、Amazon、Shopeeセラー必須ツール！リアルタイム利益計算。',
        vi: 'Máy Tính Lợi Nhuận YourTeam - Công cụ thiết yếu cho người bán Lazada, TikTok Shop, eBay, Amazon, Shopee!'
    };
    
    // Update title
    document.title = titles[lang] || titles.ko;
    
    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = descriptions[lang] || descriptions.ko;
    
    // Update OG title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = titles[lang] || titles.ko;
    
    // Update OG description
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = descriptions[lang] || descriptions.ko;
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
}

// Update language display in dropdown
function updateLanguageDisplay(lang) {
    const currentLangSpan = document.getElementById('currentLang');
    if (currentLangSpan && languageNames[lang]) {
        currentLangSpan.textContent = languageNames[lang];
    }
    
    // Update active state in dropdown
    document.querySelectorAll('.language-option').forEach(option => {
        const optionLang = option.getAttribute('data-lang');
        if (optionLang === lang) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Setup language selector event listeners
function setupLanguageSelector() {
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');
    const languageOptions = document.querySelectorAll('.language-option');
    
    if (!languageBtn || !languageDropdown) return;
    
    // Toggle dropdown
    languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        languageBtn.classList.toggle('active');
        languageDropdown.classList.toggle('active');
    });
    
    // Select language
    languageOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedLang = option.getAttribute('data-lang');
            
            // Apply language
            applyLanguage(selectedLang);
            
            // Close dropdown
            languageBtn.classList.remove('active');
            languageDropdown.classList.remove('active');
            
            console.log('🌍 Language changed to:', selectedLang);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (languageBtn.classList.contains('active')) {
            languageBtn.classList.remove('active');
            languageDropdown.classList.remove('active');
        }
    });
    
    // Prevent dropdown from closing when clicking inside
    languageDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initLanguageSystem();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initLanguageSystem,
        applyLanguage,
        currentLanguage
    };
}
