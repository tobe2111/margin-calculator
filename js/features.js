// ===== Platform Fee Presets =====
const platformFees = {
    lazada:  { name: 'Lazada',      icon: 'fas fa-store',         fee: 4.5,  note: '커미션 2.5% + 결제 2%' },
    tiktok:  { name: 'TikTok Shop', icon: 'fab fa-tiktok',        fee: 6.4,  note: '플랫폼 3.5% + 결제 2.9%' },
    ebay:    { name: 'eBay',        icon: 'fab fa-ebay',          fee: 16.4, note: '최종가치 12.9% + PayPal 3.5%' },
    amazon:  { name: 'Amazon',      icon: 'fab fa-amazon',        fee: 14.9, note: '추천 12% + 결제 2.9%' },
    shopee:  { name: 'Shopee',      icon: 'fas fa-shopping-bag',  fee: 5.0,  note: '판매 3% + 결제 2%' },
    qoo10:   { name: 'Qoo10',       icon: 'fas fa-shopping-cart', fee: 11.0, note: '판매 8% + 결제 3%' },
    rakuten: { name: 'Rakuten',     icon: 'fas fa-gem',           fee: 9.0,  note: '거래 6.5% + 결제 2.5%' }
};

// ===== Toast =====
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Auto-save =====
function saveInputsToLocalStorage() {
    try {
        const inputs = {
            productName: document.getElementById('productName').value,
            purchasePrice: document.getElementById('purchasePrice').value,
            currency: document.getElementById('currency').value,
            sellingPrice: document.getElementById('sellingPrice').value,
            platformFee: document.getElementById('platformFee').value,
            fxSpread: document.getElementById('fxSpread').value,
            domesticShipping: document.getElementById('domesticShipping').value,
            intlShipping: document.getElementById('intlShipping').value,
            vatRefund: document.getElementById('vatRefund').checked,
            targetMargin: document.getElementById('targetMargin').value,
            adCostPerUnit: document.getElementById('adCostPerUnit')?.value,
            returnRate: document.getElementById('returnRate')?.value
        };
        localStorage.setItem('marginCalcInputs', JSON.stringify(inputs));
    } catch(e) {}
}

function restoreInputsFromLocalStorage() {
    // URL params take priority
    const params = new URLSearchParams(window.location.search);
    if (params.get('p') || params.get('s')) { restoreFromURL(params); return; }
    try {
        const saved = localStorage.getItem('marginCalcInputs');
        if (!saved) return;
        const d = JSON.parse(saved);
        const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== '') el.value = val; };
        set('productName', d.productName);
        set('purchasePrice', d.purchasePrice);
        set('sellingPrice', d.sellingPrice);
        set('platformFee', d.platformFee);
        set('fxSpread', d.fxSpread);
        set('domesticShipping', d.domesticShipping);
        set('intlShipping', d.intlShipping);
        set('targetMargin', d.targetMargin);
        set('adCostPerUnit', d.adCostPerUnit);
        set('returnRate', d.returnRate);
        // 저장된 값이 있으면 고급 설정 패널을 열어둔다
        if ((parseFloat(d.adCostPerUnit) || 0) > 0 || (parseFloat(d.returnRate) || 0) > 0) {
            openAdvancedFields();
        }
        if (d.currency) {
            document.getElementById('currency').value = d.currency;
            currentCurrency = d.currency;
            const sc = document.getElementById('sellingPriceCurrency');
            if (sc) sc.textContent = d.currency;
        }
        if (d.vatRefund !== undefined) document.getElementById('vatRefund').checked = d.vatRefund;
        notifyRestored(d);
    } catch(e) {}
}

/**
 * 값이 복원됐다는 사실을 알린다.
 * 예전에는 지난 방문의 입력값이 말없이 채워져, 사용자가 넣은 적 없다고
 * 여기는 숫자가 그대로 계산에 쓰였다. 어디서 온 값인지 밝히고
 * 한 번에 비울 수 있게 한다.
 */
function notifyRestored(d) {
    const bar = document.getElementById('restoredNotice');
    if (!bar) return;
    const filled = ['productName','purchasePrice','sellingPrice','domesticShipping','intlShipping']
        .filter(k => d[k] !== undefined && String(d[k]).trim() !== '' && String(d[k]) !== '0');
    if (!filled.length) return;
    bar.classList.add('show');
}

function clearRestored() {
    ['productName','purchasePrice','sellingPrice','domesticShipping','intlShipping',
     'platformFee','targetMargin'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    ['adCostPerUnit','returnRate'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '0';
    });
    localStorage.removeItem('marginCalcInputs');
    document.getElementById('restoredNotice')?.classList.remove('show');
    document.querySelectorAll('.platform-quick-btn').forEach(b => b.classList.remove('active'));
    showToast('입력값을 비웠습니다');
}

function dismissRestored() {
    document.getElementById('restoredNotice')?.classList.remove('show');
}

function restoreFromURL(params) {
    const set = (id, key) => { const el = document.getElementById(id); if (el && params.get(key)) el.value = params.get(key); };
    set('productName', 'n'); set('purchasePrice', 'p'); set('sellingPrice', 's');
    set('platformFee', 'pf'); set('fxSpread', 'fx');
    set('domesticShipping', 'ds'); set('intlShipping', 'is');
    if (params.get('c')) {
        document.getElementById('currency').value = params.get('c');
        currentCurrency = params.get('c');
        const sc = document.getElementById('sellingPriceCurrency');
        if (sc) sc.textContent = params.get('c');
    }
}

// ===== Reset =====
function resetForm() {
    if (!confirm('입력한 내용을 모두 초기화할까요?')) return;
    ['productName','purchasePrice','sellingPrice','platformFee','targetMargin','domesticShipping','intlShipping'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('fxSpread').value = '1';
    document.getElementById('vatRefund').checked = true;
    ['adCostPerUnit','returnRate'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '0';
    });
    ['rowAdCost','rowReturnRisk'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    document.querySelector('.calculator-container')?.classList.remove('has-result');
    const pre = document.getElementById('preResult');
    if (pre) pre.style.display = '';
    ['resultSection','reverseResult','coupangBanner','chartSection','comparisonSection'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const ss = document.getElementById('shareSection'); if (ss) ss.style.display = 'none';
    const sg = document.getElementById('rateSimResultGrid'); if (sg) sg.style.display = 'none';
    localStorage.removeItem('marginCalcInputs');
    document.querySelectorAll('.platform-quick-btn').forEach(b => b.classList.remove('active'));
    const help = document.getElementById('platformFeeHelp');
    if (help) help.textContent = '플랫폼 판매 수수료를 입력하세요 (예: 15.5)';
    showToast('✅ 초기화 완료!');
}

// ===== Platform Select =====
function selectPlatform(key) {
    const p = platformFees[key]; if (!p) return;
    document.getElementById('platformFee').value = p.fee;
    document.querySelectorAll('.platform-quick-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-platform="${key}"]`);
    if (btn) btn.classList.add('active');
    const help = document.getElementById('platformFeeHelp');
    if (help) help.textContent = `${p.name}: ${p.note}`;
    saveInputsToLocalStorage();
}

// ===== Presets =====
function savePreset() {
    const name = prompt('프리셋 이름을 입력하세요\n예: 내 라자다 설정, 아마존 기본');
    if (!name || !name.trim()) return;
    const preset = {
        name: name.trim(),
        currency: document.getElementById('currency').value,
        platformFee: document.getElementById('platformFee').value,
        fxSpread: document.getElementById('fxSpread').value,
        domesticShipping: document.getElementById('domesticShipping').value,
        intlShipping: document.getElementById('intlShipping').value,
        vatRefund: document.getElementById('vatRefund').checked
    };
    const presets = JSON.parse(localStorage.getItem('marginCalcPresets') || '[]');
    presets.push(preset);
    localStorage.setItem('marginCalcPresets', JSON.stringify(presets));
    renderPresets();
    showToast(`💾 "${preset.name}" 저장 완료!`);
}

function loadPreset(index) {
    const presets = JSON.parse(localStorage.getItem('marginCalcPresets') || '[]');
    const p = presets[index]; if (!p) return;
    if (p.currency) {
        document.getElementById('currency').value = p.currency;
        currentCurrency = p.currency;
        const sc = document.getElementById('sellingPriceCurrency'); if (sc) sc.textContent = p.currency;
        fetchRealTimeExchangeRates();
    }
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    set('platformFee', p.platformFee); set('fxSpread', p.fxSpread);
    set('domesticShipping', p.domesticShipping); set('intlShipping', p.intlShipping);
    if (p.vatRefund !== undefined) document.getElementById('vatRefund').checked = p.vatRefund;
    showToast(`📂 "${p.name}" 불러오기 완료!`);
}

function deletePreset(index) {
    const presets = JSON.parse(localStorage.getItem('marginCalcPresets') || '[]');
    const name = presets[index]?.name;
    presets.splice(index, 1);
    localStorage.setItem('marginCalcPresets', JSON.stringify(presets));
    renderPresets();
    showToast(`🗑️ "${name}" 삭제 완료`);
}

function renderPresets() {
    const container = document.getElementById('presetList'); if (!container) return;
    const presets = JSON.parse(localStorage.getItem('marginCalcPresets') || '[]');
    if (presets.length === 0) { container.innerHTML = '<p class="no-presets">저장된 프리셋 없음</p>'; return; }
    container.innerHTML = presets.map((p, i) => `
        <div class="preset-item">
            <button class="preset-load-btn" onclick="loadPreset(${i})" title="${p.currency} | 수수료 ${p.platformFee}%">${p.name}</button>
            <button class="preset-delete-btn" onclick="deletePreset(${i})" title="삭제"><i class="fas fa-times"></i></button>
        </div>`).join('');
}

// ===== Chart =====
let marginChart = null;

function updateChart(revenue, purchasePrice, platformFeeAmt, fxSpreadAmt, domesticShipping, intlShipping, vatRefund, netProfit) {
    const ctx = document.getElementById('marginChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const adjustedPurchase = Math.max(0, purchasePrice - vatRefund);
    const adjustedProfit = Math.max(0, netProfit);
    const data = [adjustedPurchase, platformFeeAmt, fxSpreadAmt, domesticShipping, intlShipping, adjustedProfit];
    const labels = ['매입가', '플랫폼 수수료', '환전 수수료', '국내배송비', '해외배송비', '순이익'];
    const colors = ['#9AA1AC', '#9A6212', '#6B7280', '#3D424D', '#0E7A5F', '#0F1115'];
    if (marginChart) {
        marginChart.data.datasets[0].data = data; marginChart.update();
    } else {
        marginChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff' }] },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 14 } },
                    tooltip: { callbacks: { label: (c) => ` ${c.label}: ₩${Math.round(c.raw).toLocaleString('ko-KR')} (${revenue > 0 ? ((c.raw/revenue)*100).toFixed(1) : 0}%)` } }
                }
            }
        });
    }
    const chartSection = document.getElementById('chartSection');
    if (chartSection) chartSection.style.display = 'block';
}

// ===== Share =====
function shareURL() {
    const get = (id) => document.getElementById(id)?.value || '';
    const params = new URLSearchParams({
        n: get('productName'), p: get('purchasePrice'), c: get('currency') || 'USD',
        s: get('sellingPrice'), pf: get('platformFee'), fx: get('fxSpread') || '1',
        ds: get('domesticShipping'), is: get('intlShipping')
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url).then(() => showToast('🔗 URL 복사 완료!'));
}

function shareResult() {
    const product = document.getElementById('productName').value || '상품';
    const profit = document.getElementById('netProfitKRW')?.textContent || '-';
    const margin = document.getElementById('marginRate')?.textContent || '-';
    const text = `[유어팀 마진 계산 결과]\n상품: ${product}\n순이익: ${profit}\n마진율: ${margin}\n\n📊 유어팀 무료 마진 계산기\nhttps://margin.ur-team.com`;
    if (navigator.share) {
        navigator.share({ title: '유어팀 마진 계산 결과', text, url: 'https://margin.ur-team.com' }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => showToast('📋 결과 복사 완료!'));
    }
}

function saveAsImage() {
    if (typeof html2canvas === 'undefined') { showToast('잠시 후 다시 시도해주세요.'); return; }
    showToast('⏳ 이미지 생성 중...');
    const el = document.getElementById('resultSection');
    html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        const name = document.getElementById('productName').value || '결과';
        link.download = `마진계산_${name}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('✅ 이미지 저장 완료!');
    });
}

// ===== Multi-platform Comparison =====
function calculateComparison() {
    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    const fxSpreadRate = parseFloat(document.getElementById('fxSpread').value) || 0;
    const domesticShipping = parseFloat(document.getElementById('domesticShipping').value) || 0;
    const intlShipping = parseFloat(document.getElementById('intlShipping').value) || 0;
    const applyVatRefund = document.getElementById('vatRefund').checked;
    if (sellingPrice <= 0 || purchasePrice <= 0 || currentExchangeRate <= 0) return;

    const revenue = sellingPrice * currentExchangeRate;
    const vatRefund = applyVatRefund ? purchasePrice * 0.10 : 0;
    const tbody = document.getElementById('comparisonTableBody'); if (!tbody) return;

    const results = Object.entries(platformFees).map(([key, platform]) => {
        const pfAmt = revenue * (platform.fee / 100);
        const fxAmt = revenue * (fxSpreadRate / 100);
        const totalCost = purchasePrice + pfAmt + fxAmt + domesticShipping + intlShipping - vatRefund;
        const netProfit = revenue - totalCost;
        const marginRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;
        return { key, platform, netProfit, marginRate };
    });

    const bestProfit = Math.max(...results.map(r => r.netProfit));

    tbody.innerHTML = results.map(({ key, platform, netProfit, marginRate }) => {
        const cls = netProfit < 0 ? 'c-negative' : 'c-positive';
        const isBest = netProfit === bestProfit && netProfit > 0;
        return `<tr${isBest ? ' class="best-row"' : ''}>
            <td><i class="${platform.icon}" style="color:var(--ink-3);margin-right:6px;"></i>${platform.name}</td>
            <td>${platform.fee}%</td>
            <td class="${cls}">₩ ${Math.round(netProfit).toLocaleString('ko-KR')}</td>
            <td class="${cls}">${marginRate.toFixed(1)}%</td>
        </tr>`;
    }).join('');

    const section = document.getElementById('comparisonSection');
    if (section) { section.style.display = 'block'; }
}

// ===== Exchange Rate Simulation =====
function updateRateSimulation() {
    const slider = document.getElementById('rateSimSlider'); if (!slider) return;
    const adj = parseInt(slider.value);
    const baseRate = defaultExchangeRates[currentCurrency] || currentExchangeRate;
    const simRate = Math.round(baseRate * (1 + adj / 100));
    const sym = currencyInfo[currentCurrency]?.symbol || '';
    const adjText = adj > 0 ? `+${adj}%` : `${adj}%`;
    document.getElementById('rateSimValue').textContent = `${adjText} → 1 ${sym} = ₩${simRate.toLocaleString('ko-KR')}`;

    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    const platformFeeRate = parseFloat(document.getElementById('platformFee').value) || 0;
    const fxSpreadRate = parseFloat(document.getElementById('fxSpread').value) || 0;
    const domesticShipping = parseFloat(document.getElementById('domesticShipping').value) || 0;
    const intlShipping = parseFloat(document.getElementById('intlShipping').value) || 0;
    const applyVatRefund = document.getElementById('vatRefund').checked;

    if (sellingPrice > 0) {
        const revenue = sellingPrice * simRate;
        const pfAmt = revenue * (platformFeeRate / 100);
        const fxAmt = revenue * (fxSpreadRate / 100);
        const vat = applyVatRefund ? purchasePrice * 0.10 : 0;
        const totalCost = purchasePrice + pfAmt + fxAmt + domesticShipping + intlShipping - vat;
        const netProfit = revenue - totalCost;
        const marginRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;
        const cls = netProfit < 0 ? 'c-negative' : 'c-positive';
        const pg = document.getElementById('rateSimResultGrid');
        if (pg) pg.style.display = 'grid';
        const rp = document.getElementById('rateSimProfit');
        if (rp) { rp.textContent = `₩ ${Math.round(netProfit).toLocaleString('ko-KR')}`; rp.className = `sim-result-value ${cls}`; }
        const rm = document.getElementById('rateSimMargin');
        if (rm) { rm.textContent = `${marginRate.toFixed(2)}%`; rm.className = `sim-result-value ${cls}`; }
    }
}

// ===== Import Duty =====
function calculateImportDuty() {
    const dutyRate = parseFloat(document.getElementById('importDutyRate').value) || 0;
    const vatRate = parseFloat(document.getElementById('importVatRate').value) || 10;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    if (sellingPrice <= 0) { showToast('먼저 계산기에서 판매가를 입력해주세요.'); return; }
    const revenue = sellingPrice * currentExchangeRate;
    const dutyAmt = revenue * (dutyRate / 100);
    const vatAmt = (revenue + dutyAmt) * (vatRate / 100);
    const total = dutyAmt + vatAmt;
    document.getElementById('dutyAmount').textContent = `₩ ${Math.round(dutyAmt).toLocaleString('ko-KR')}`;
    document.getElementById('importVatAmount').textContent = `₩ ${Math.round(vatAmt).toLocaleString('ko-KR')}`;
    document.getElementById('totalImportCost').textContent = `₩ ${Math.round(total).toLocaleString('ko-KR')}`;
    document.getElementById('importDutyResult').style.display = 'block';
}

// ===== DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {
    restoreInputsFromLocalStorage();
    renderPresets();
    setupNumberFormatDisplay();
    registerServiceWorker();
    loadExchangeRateChart();
    setupMobileCalcButton();
    // Auto-save on any input change
    document.querySelectorAll('#productName,#purchasePrice,#currency,#sellingPrice,#platformFee,#fxSpread,#domesticShipping,#intlShipping,#vatRefund,#targetMargin,#adCostPerUnit,#returnRate').forEach(el => {
        el.addEventListener('change', saveInputsToLocalStorage);
        el.addEventListener('input', saveInputsToLocalStorage);
    });
});

// ===== 숫자 천단위 표시 =====
function setupNumberFormatDisplay() {
    const targets = [
        { id: 'purchasePrice',     unit: '원' },
        { id: 'domesticShipping',  unit: '원' },
        { id: 'intlShipping',      unit: '원' },
    ];
    targets.forEach(({ id, unit }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const display = document.createElement('span');
        display.className = 'num-format-hint';
        el.parentNode.insertAdjacentElement('afterend', display);
        const update = () => {
            const v = parseFloat(el.value);
            display.textContent = (!isNaN(v) && v > 0) ? `= ${v.toLocaleString('ko-KR')} ${unit}` : '';
        };
        el.addEventListener('input', update);
        update();
    });
}

// ===== 고급 설정 (광고비 · 반품률) 토글 =====
function openAdvancedFields() {
    const panel = document.getElementById('advancedFields');
    const btn = document.getElementById('advancedToggle');
    if (!panel || !btn) return;
    panel.classList.add('show');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
}

function toggleAdvancedFields() {
    const panel = document.getElementById('advancedFields');
    const btn = document.getElementById('advancedToggle');
    if (!panel || !btn) return;
    const open = panel.classList.toggle('show');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
}

// ===== 모바일 고정 계산 버튼 =====
function setupMobileCalcButton() {
    const fixed = document.getElementById('mobileCalcFixed');
    const mainBtn = document.getElementById('calculateBtn');
    if (!fixed || !mainBtn || !window.IntersectionObserver) return;
    // 인라인 style 을 쓰면 모바일 미디어쿼리를 덮어써 데스크톱에도 뜬다.
    // 클래스만 토글하고 실제 노출 여부는 CSS 브레이크포인트가 결정한다.
    const obs = new IntersectionObserver(entries => {
        fixed.classList.toggle('show', !entries[0].isIntersecting);
    }, { threshold: 0.5 });
    obs.observe(mainBtn);
}

// ===== PWA Service Worker 등록 =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .catch(() => {});
    }
}

// ===== 환율 추이 차트 =====
async function loadExchangeRateChart() {
    const canvas = document.getElementById('rateHistoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const today = new Date();
    const from  = new Date(today); from.setDate(from.getDate() - 29);
    const fmt   = d => d.toISOString().split('T')[0];

    let labels = [], data = [];
    try {
        // 자체 프록시 우선 (서버 KV 캐시 공유) → 실패 시 원본 API 직접 호출
        let series = null;
        try {
            const pr = await fetch('/api/rates/history');
            if (pr.ok) {
                const pj = await pr.json();
                if (pj && Array.isArray(pj.series) && pj.series.length) series = pj.series;
            }
        } catch (e) { /* 직접 호출로 폴백 */ }

        if (!series) {
            const res = await fetch(`https://api.frankfurter.app/${fmt(from)}..${fmt(today)}?from=KRW&to=USD`);
            const json = await res.json();
            if (!json.rates) throw new Error('no history data');
            series = Object.entries(json.rates).sort()
                .map(([date, r]) => ({ date, rate: r.USD ? Math.round(1 / r.USD) : null }))
                .filter(p => p.rate);
        }
        if (!series.length) throw new Error('empty history');
        series.forEach(p => { labels.push(p.date.slice(5)); data.push(p.rate); });
    } catch(e) {
        // Fallback: generate simulated data from current rate
        const base = defaultExchangeRates['USD'] || 1350;
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            labels.push(`${d.getMonth()+1}/${d.getDate()}`);
            data.push(Math.round(base * (1 + (Math.random() - 0.5) * 0.03)));
        }
    }

    if (!data.some(v => v)) return;

    const chartSection = document.getElementById('rateHistorySection');
    if (chartSection) chartSection.style.display = 'block';

    const min = Math.min(...data.filter(Boolean)) - 10;
    const max = Math.max(...data.filter(Boolean)) + 10;

    new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'USD/KRW',
                data,
                borderColor: '#0F1115',
                backgroundColor: 'rgba(15,17,21,0.06)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
                y: { min, max, grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, callback: v => '₩' + v.toLocaleString() } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `₩${c.raw.toLocaleString('ko-KR')}` } } },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// ===== 전체 백업 · 복원 =====
//
// 모든 데이터가 localStorage 에만 있어 브라우저 데이터 삭제·기기 변경 시
// 복구가 불가능했다. 이용약관에 소실 위험을 고지해 두고 정작 대비 수단이
// 없었으므로, 파일 하나로 통째로 내보내고 되돌릴 수 있게 한다.
const BACKUP_KEYS = [
    'marginProjects', 'marginCalcHistory', 'marginCalcPresets',
    'marginCalcInputs', 'rateAlertTarget', 'marginMonthlyGoal', 'selectedLanguage',
];
const BACKUP_FORMAT = 1;

function exportAllData() {
    const data = {};
    let items = 0;
    BACKUP_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v === null) return;
        try { data[k] = JSON.parse(v); } catch (e) { data[k] = v; }
        if (Array.isArray(data[k])) items += data[k].length;
    });
    if (!Object.keys(data).length) {
        showToast('내보낼 데이터가 없습니다.');
        return;
    }
    const payload = {
        format: BACKUP_FORMAT,
        app: 'margin.ur-team.com',
        exportedAt: new Date().toISOString(),
        data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    a.download = `마진계산기_백업_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`백업 파일 저장 완료 (${Object.keys(data).length}종)`);
    if (typeof gtag !== 'undefined') gtag('event', 'backup_export', { event_category: 'data' });
}

async function importAllData(file) {
    if (!file) return;
    try {
        const payload = JSON.parse(await file.text());
        const data = payload && payload.data;
        if (!data || typeof data !== 'object') throw new Error('형식을 알 수 없는 파일입니다');
        if (payload.format > BACKUP_FORMAT) {
            throw new Error('더 새로운 버전의 백업 파일입니다. 최신 페이지에서 시도해주세요');
        }
        const found = BACKUP_KEYS.filter(k => k in data);
        if (!found.length) throw new Error('복원할 항목이 없습니다');

        const when = payload.exportedAt
            ? new Date(payload.exportedAt).toLocaleString('ko-KR') : '알 수 없음';
        const ok = confirm(
            `백업 생성 시각: ${when}\n복원 항목: ${found.length}종\n\n` +
            '현재 브라우저에 저장된 계산 이력·프로젝트·프리셋을 이 백업으로 덮어씁니다.\n계속할까요?'
        );
        if (!ok) return;

        found.forEach(k => {
            const v = data[k];
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        });
        showToast(`복원 완료 (${found.length}종) — 새로고침합니다`);
        if (typeof gtag !== 'undefined') gtag('event', 'backup_import', { event_category: 'data' });
        setTimeout(() => location.reload(), 900);
    } catch (err) {
        showToast('복원 실패: ' + (err.message || '파일을 읽을 수 없습니다'));
    }
}

function handleBackupFile(e) {
    importAllData(e.target.files[0]);
    e.target.value = '';
}

// ===== 계산 이력 → 계산기로 되돌리기 =====
// 이력은 보기 전용이라 과거 조건으로 다시 계산하려면 전부 다시 입력해야 했다.
function loadFromHistory(index) {
    try {
        const hist = JSON.parse(localStorage.getItem('marginCalcHistory') || '[]');
        const h = hist[index];
        if (!h) return;
        const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
        set('productName', h.productName === '상품명 없음' ? '' : h.productName);
        set('purchasePrice', h.purchasePrice);
        set('sellingPrice', h.sellingPrice);
        set('platformFee', h.platformFeeRate);
        set('fxSpread', h.fxSpreadRate);
        set('domesticShipping', h.domesticShipping);
        set('intlShipping', h.intlShipping);
        if (h.currency) {
            const cs = document.getElementById('currency');
            if (cs) { cs.value = h.currency; currentCurrency = h.currency; }
            const sc = document.getElementById('sellingPriceCurrency');
            if (sc) sc.textContent = h.currency;
        }
        saveInputsToLocalStorage();
        if (typeof calculateMargin === 'function') calculateMargin();
        showToast('이력을 불러왔습니다');
    } catch (e) { showToast('이력을 불러오지 못했습니다'); }
}

// ===== 오류 수집 =====
// 사용자 기기에서 스크립트가 깨져도 운영자가 알 방법이 없었다.
// 개인정보는 담지 않고 오류 지점만 GA4 이벤트로 남긴다.
(function setupErrorReporting() {
    let sent = 0;
    const report = (label) => {
        if (sent >= 5) return;           // 한 세션에 5건까지만
        sent++;
        if (typeof gtag === 'function') {
            gtag('event', 'js_error', {
                event_category: 'error',
                event_label: String(label).slice(0, 300),
                page_path: location.pathname,
            });
        }
    };
    window.addEventListener('error', (e) => {
        if (e.message) report(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`);
    });
    window.addEventListener('unhandledrejection', (e) => {
        report('unhandled: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
    });
})();

// ===== 홈 화면에 추가 안내 =====
// manifest·아이콘·서비스워커를 갖췄는데 설치 경로를 알리지 않고 있었다.
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (localStorage.getItem('installDismissed')) return;
    const bar = document.getElementById('installPrompt');
    if (bar) bar.classList.add('show');
});
function acceptInstall() {
    const bar = document.getElementById('installPrompt');
    if (bar) bar.classList.remove('show');
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then((c) => {
        if (typeof gtag === 'function') {
            gtag('event', 'pwa_install', { event_category: 'pwa', event_label: c.outcome });
        }
        deferredInstall = null;
    });
}
function dismissInstall() {
    localStorage.setItem('installDismissed', '1');
    document.getElementById('installPrompt')?.classList.remove('show');
}
window.addEventListener('appinstalled', () => {
    document.getElementById('installPrompt')?.classList.remove('show');
});

// ===== 계산기 → 도구 값 전달 =====
// 도구를 쓰려면 매입가·판매가·환율을 처음부터 다시 입력해야 했다.
function openToolsWithValues(hash) {
    const g = (id) => (document.getElementById(id)?.value || '').trim();
    const q = new URLSearchParams();
    const map = { p: 'purchasePrice', s: 'sellingPrice', f: 'platformFee', ds: 'domesticShipping', is: 'intlShipping' };
    Object.entries(map).forEach(([k, id]) => { const v = g(id); if (v) q.set(k, v); });
    if (typeof currentExchangeRate === 'number' && currentExchangeRate > 0) q.set('r', Math.round(currentExchangeRate));
    if (typeof currentCurrency === 'string') q.set('c', currentCurrency);
    location.href = '/tools/?' + q.toString() + (hash || '');
}
