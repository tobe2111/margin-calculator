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
            targetMargin: document.getElementById('targetMargin').value
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
        if (d.currency) {
            document.getElementById('currency').value = d.currency;
            currentCurrency = d.currency;
            const sc = document.getElementById('sellingPriceCurrency');
            if (sc) sc.textContent = d.currency;
        }
        if (d.vatRefund !== undefined) document.getElementById('vatRefund').checked = d.vatRefund;
    } catch(e) {}
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
    const colors = ['#6b7280', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#0066FF'];
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
            <td><i class="${platform.icon}" style="color:#0066FF;margin-right:6px;"></i>${platform.name}</td>
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
    // Auto-save on any input change
    document.querySelectorAll('#productName,#purchasePrice,#currency,#sellingPrice,#platformFee,#fxSpread,#domesticShipping,#intlShipping,#vatRefund,#targetMargin').forEach(el => {
        el.addEventListener('change', saveInputsToLocalStorage);
        el.addEventListener('input', saveInputsToLocalStorage);
    });
});
