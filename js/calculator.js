// ===== 환율 데이터 (실시간 API 사용) =====
let defaultExchangeRates = {
    USD: 1300, SGD: 980, EUR: 1420, GBP: 1650, JPY: 9.5, CNY: 180,
    AUD: 870, CAD: 960, CHF: 1480, HKD: 165, IDR: 0.085, MYR: 290,
    PHP: 23, THB: 37, TWD: 42, VND: 0.053, BRL: 260, KRW: 1
};

const currencyInfo = {
    USD: { symbol: '$', name: '미국 달러' }, SGD: { symbol: 'S$', name: '싱가포르 달러' },
    EUR: { symbol: '€', name: '유로' }, GBP: { symbol: '£', name: '영국 파운드' },
    JPY: { symbol: '¥', name: '일본 엔' }, CNY: { symbol: '¥', name: '중국 위안' },
    AUD: { symbol: 'A$', name: '호주 달러' }, CAD: { symbol: 'C$', name: '캐나다 달러' },
    CHF: { symbol: 'Fr', name: '스위스 프랑' }, HKD: { symbol: 'HK$', name: '홍콩 달러' },
    IDR: { symbol: 'Rp', name: '인도네시아 루피아' }, MYR: { symbol: 'RM', name: '말레이시아 링깃' },
    PHP: { symbol: '₱', name: '필리핀 페소' }, THB: { symbol: '฿', name: '태국 바트' },
    TWD: { symbol: 'NT$', name: '대만 달러' }, VND: { symbol: '₫', name: '베트남 동' },
    BRL: { symbol: 'R$', name: '브라질 레알' }, KRW: { symbol: '₩', name: '한국 원' }
};

const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest/KRW';
const RATE_CACHE_KEY = 'marginRateCache';
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1시간
let currentCurrency = 'USD';
let currentExchangeRate = 1300;
let calculationHistory = [];

const productNameInput = document.getElementById('productName');
const purchasePriceInput = document.getElementById('purchasePrice');
const sellingPriceInput = document.getElementById('sellingPrice');
const currencySelect = document.getElementById('currency');
const platformFeeInput = document.getElementById('platformFee');
const fxSpreadInput = document.getElementById('fxSpread');
const domesticShippingInput = document.getElementById('domesticShipping');
const intlShippingInput = document.getElementById('intlShipping');
const vatRefundCheckbox = document.getElementById('vatRefund');
const exchangeRateDisplay = document.getElementById('exchangeRate');
const sellingPriceCurrency = document.getElementById('sellingPriceCurrency');
const calculateBtn = document.getElementById('calculateBtn');
const refreshExchangeRateBtn = document.getElementById('refreshExchangeRate');
const historySection = document.getElementById('historySection');
const historyTableBody = document.getElementById('historyTableBody');
const excelDownloadBtn = document.getElementById('excelDownloadBtn');
const targetMarginInput = document.getElementById('targetMargin');
const reverseCalcBtn = document.getElementById('reverseCalcBtn');
const reverseResult = document.getElementById('reverseResult');
const recommendedPrice = document.getElementById('recommendedPrice');

function loadCachedRates() {
    try {
        const raw = localStorage.getItem(RATE_CACHE_KEY);
        if (!raw) return false;
        const { rates, ts } = JSON.parse(raw);
        if (Date.now() - ts > RATE_CACHE_TTL) return false;
        defaultExchangeRates = rates;
        currentExchangeRate = defaultExchangeRates[currentCurrency];
        updateExchangeRateDisplay();
        return true;
    } catch(e) { return false; }
}

function saveCachedRates() {
    try {
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates: defaultExchangeRates, ts: Date.now() }));
    } catch(e) {}
}

async function fetchRealTimeExchangeRates() {
    // 캐시 히트 시 API 호출 생략 (수동 새로고침 제외)
    if (loadCachedRates()) return true;
    try {
        if (exchangeRateDisplay) exchangeRateDisplay.value = '업데이트 중...';
        const response = await fetch(EXCHANGE_RATE_API);
        if (!response.ok) throw new Error('환율 API 요청 실패');
        const data = await response.json();
        if (data.result === 'success' && data.rates) {
            const rates = data.rates;
            defaultExchangeRates = {
                USD: rates.USD ? Math.round(1 / rates.USD) : 1300,
                SGD: rates.SGD ? Math.round(1 / rates.SGD) : 980,
                EUR: rates.EUR ? Math.round(1 / rates.EUR) : 1420,
                GBP: rates.GBP ? Math.round(1 / rates.GBP) : 1650,
                JPY: rates.JPY ? Math.round(1 / rates.JPY * 10) / 10 : 9.5,
                CNY: rates.CNY ? Math.round(1 / rates.CNY) : 180,
                AUD: rates.AUD ? Math.round(1 / rates.AUD) : 870,
                CAD: rates.CAD ? Math.round(1 / rates.CAD) : 960,
                CHF: rates.CHF ? Math.round(1 / rates.CHF) : 1480,
                HKD: rates.HKD ? Math.round(1 / rates.HKD) : 165,
                IDR: rates.IDR ? Math.round(1 / rates.IDR * 1000) / 1000 : 0.085,
                MYR: rates.MYR ? Math.round(1 / rates.MYR) : 290,
                PHP: rates.PHP ? Math.round(1 / rates.PHP) : 23,
                THB: rates.THB ? Math.round(1 / rates.THB) : 37,
                TWD: rates.TWD ? Math.round(1 / rates.TWD) : 42,
                VND: rates.VND ? Math.round(1 / rates.VND * 1000) / 1000 : 0.053,
                BRL: rates.BRL ? Math.round(1 / rates.BRL) : 260,
                KRW: 1
            };
            currentExchangeRate = defaultExchangeRates[currentCurrency];
            updateExchangeRateDisplay();
            updateExchangeRateTimestamp(data.time_last_update_utc);
            saveCachedRates();
            return true;
        } else {
            throw new Error('잘못된 API 응답');
        }
    } catch (error) {
        console.warn('⚠️ 실시간 환율 로드 실패, 기본 환율 사용:', error.message);
        currentExchangeRate = defaultExchangeRates[currentCurrency];
        updateExchangeRateDisplay();
        return false;
    }
}

function updateExchangeRateDisplay() {
    if (exchangeRateDisplay) {
        const symbol = currencyInfo[currentCurrency]?.symbol || '';
        const rate = currentExchangeRate.toLocaleString('ko-KR');
        exchangeRateDisplay.value = `1 ${symbol} = ${rate} 원`;
    }
}

function updateExchangeRateTimestamp(timestamp) {
    const exchangeRateHelp = document.getElementById('exchangeRateHelp');
    if (exchangeRateHelp && timestamp) {
        const date = new Date(timestamp);
        const koreanTime = date.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit',
            day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        if (!exchangeRateHelp.textContent.includes('업데이트:')) {
            exchangeRateHelp.textContent += ` (업데이트: ${koreanTime})`;
        } else {
            const baseText = exchangeRateHelp.textContent.split('(업데이트:')[0];
            exchangeRateHelp.textContent = `${baseText}(업데이트: ${koreanTime})`;
        }
    }
}

if (currencySelect) {
    currencySelect.addEventListener('change', async () => {
        currentCurrency = currencySelect.value;
        if (sellingPriceCurrency) sellingPriceCurrency.textContent = currentCurrency;
        await fetchRealTimeExchangeRates();
    });
}

if (refreshExchangeRateBtn) {
    refreshExchangeRateBtn.addEventListener('click', async () => {
        const icon = refreshExchangeRateBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        // 강제 새로고침: 캐시 무효화 후 API 호출
        localStorage.removeItem(RATE_CACHE_KEY);
        await fetchRealTimeExchangeRates();
        setTimeout(() => { if (icon) icon.classList.remove('fa-spin'); }, 1000);
    });
}


function setCalcBtnLoading(loading) {
    if (!calculateBtn) return;
    if (loading) {
        calculateBtn.disabled = true;
        calculateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 계산 중...';
    } else {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = '<i class="fas fa-calculator"></i> 마진 계산하기';
    }
}

function calculateMargin() {
    const productName = productNameInput.value.trim();
    const purchasePrice = parseFloat(purchasePriceInput.value) || 0;
    const sellingPrice = parseFloat(sellingPriceInput.value) || 0;
    const platformFeeRate = parseFloat(platformFeeInput.value) || 0;
    const fxSpreadRate = parseFloat(fxSpreadInput.value) || 0;
    const domesticShipping = parseFloat(domesticShippingInput.value) || 0;
    const intlShipping = parseFloat(intlShippingInput.value) || 0;
    const applyVatRefund = vatRefundCheckbox.checked;

    if (sellingPrice <= 0) { alert('판매가를 입력해주세요.'); return; }
    if (currentExchangeRate <= 0) { alert('환율 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return; }
    setCalcBtnLoading(true);

    if (typeof gtag !== 'undefined') {
        gtag('event', 'calculate_margin', { 'event_category': 'calculator', 'event_label': 'margin_calculation', 'currency': currentCurrency, 'value': sellingPrice });
    }

    const revenue = sellingPrice * currentExchangeRate;
    const platformFee = revenue * (platformFeeRate / 100);
    const fxSpread = revenue * (fxSpreadRate / 100);
    const vatRefund = applyVatRefund ? purchasePrice * 0.10 : 0;
    const totalCostBeforeVat = purchasePrice + platformFee + fxSpread + domesticShipping + intlShipping;
    const totalCost = totalCostBeforeVat - vatRefund;
    const netProfit = revenue - totalCost;
    const marginRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
    const breakEvenPrice = currentExchangeRate > 0 ? totalCostBeforeVat / currentExchangeRate : 0;

    const symbol = currencyInfo[currentCurrency]?.symbol || '';
    const netProfitLocal = netProfit / currentExchangeRate;

    document.getElementById('netProfitLocal').textContent = `${symbol} ${netProfitLocal.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('netProfitKRW').textContent = `₩ ${Math.round(netProfit).toLocaleString('ko-KR')}`;
    document.getElementById('marginRate').textContent = `${marginRate.toFixed(2)} %`;
    document.getElementById('revenueLocal').textContent = `${symbol} ${sellingPrice.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('revenueKRW').textContent = `₩ ${Math.round(revenue).toLocaleString('ko-KR')}`;
    document.getElementById('totalCost').textContent = `₩ ${Math.round(totalCost).toLocaleString('ko-KR')}`;
    document.getElementById('costPurchase').textContent = `₩ ${Math.round(purchasePrice).toLocaleString('ko-KR')}`;
    document.getElementById('costPlatformFee').textContent = `₩ ${Math.round(platformFee).toLocaleString('ko-KR')}`;
    document.getElementById('costFxSpread').textContent = `₩ ${Math.round(fxSpread).toLocaleString('ko-KR')}`;
    document.getElementById('costDomesticShipping').textContent = `₩ ${Math.round(domesticShipping).toLocaleString('ko-KR')}`;
    document.getElementById('costIntlShipping').textContent = `₩ ${Math.round(intlShipping).toLocaleString('ko-KR')}`;
    document.getElementById('vatRefundAmount').textContent = `+ ₩ ${Math.round(vatRefund).toLocaleString('ko-KR')}`;
    document.getElementById('roi').textContent = `${roi.toFixed(2)} %`;
    document.getElementById('breakEvenPrice').textContent = `${symbol} ${breakEvenPrice.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('resultSection').style.display = 'block';

    // 마진율 시각화 (색상 + 게이지)
    updateMarginVisual(marginRate, netProfit);

    addToHistory({ productName: productName || '상품명 없음', purchasePrice, currency: currentCurrency, sellingPrice, exchangeRate: currentExchangeRate, domesticShipping, intlShipping, platformFeeRate, fxSpreadRate, netProfit, marginRate, timestamp: new Date() });

    // 차트 업데이트
    if (typeof updateChart === 'function') {
        updateChart(revenue, purchasePrice, platformFee, fxSpread, domesticShipping, intlShipping, vatRefund, netProfit);
    }

    // 플랫폼 비교 업데이트
    if (typeof calculateComparison === 'function') calculateComparison();

    // 공유 버튼 + 프로젝트 저장 UI 노출
    const shareSection = document.getElementById('shareSection');
    if (shareSection) shareSection.style.display = 'flex';
    const projectSaveRow = document.getElementById('projectSaveRow');
    if (projectSaveRow) projectSaveRow.style.display = 'flex';
    const coupangBanner = document.getElementById('coupangBanner');
    if (coupangBanner) coupangBanner.style.display = 'block';

    // 입력값 자동 저장
    if (typeof saveInputsToLocalStorage === 'function') saveInputsToLocalStorage();

    if (typeof gtag !== 'undefined') { gtag('event', 'calculate_complete', { 'event_category': 'calculator', 'event_label': 'margin_calculated', 'value': Math.round(marginRate) }); }

    setCalcBtnLoading(false);

    // 결과 섹션으로 부드럽게 스크롤
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
        setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
}

function updateMarginVisual(marginRate, netProfit) {
    const gradeMap = {
        excellent: { label: '우수', cls: 'margin-grade-excellent', fill: 'fill-excellent' },
        good:      { label: '양호', cls: 'margin-grade-good',      fill: 'fill-good' },
        warning:   { label: '주의', cls: 'margin-grade-warning',    fill: 'fill-warning' },
        danger:    { label: '위험', cls: 'margin-grade-danger',     fill: 'fill-danger' },
    };
    let grade = 'danger';
    if (marginRate >= 20) grade = 'excellent';
    else if (marginRate >= 12) grade = 'good';
    else if (marginRate >= 0) grade = 'warning';

    const { label, cls, fill } = gradeMap[grade];

    const badge = document.getElementById('marginGradeBadge');
    if (badge) {
        badge.textContent = label;
        badge.className = `margin-grade-badge ${cls}`;
    }

    const bar = document.getElementById('marginBarFill');
    if (bar) {
        const pct = Math.min(Math.max(marginRate, 0), 50);
        bar.style.width = `${(pct / 50) * 100}%`;
        bar.className = `margin-bar-fill ${fill}`;
    }

    const profitCard = document.querySelector('#resultSection .result-card:first-child');
    if (profitCard) {
        profitCard.className = `result-card profit-${grade}`;
    }
    const marginCard = document.getElementById('marginRateCard');
    if (marginCard) {
        marginCard.className = `result-card profit-${grade}`;
    }
}

function addToHistory(data) {
    calculationHistory.push(data);
    const row = document.createElement('tr');
    const no = calculationHistory.length;
    const symbol = currencyInfo[data.currency]?.symbol || '';
    const netProfitClass = data.netProfit < 0 ? 'negative-profit' : '';
    const marginRateClass = data.marginRate < 0 ? 'negative-profit' : '';

    row.innerHTML = `
        <td>${no}</td>
        <td>${data.productName}</td>
        <td>₩ ${Math.round(data.purchasePrice).toLocaleString('ko-KR')}</td>
        <td>${data.currency}</td>
        <td>${symbol} ${data.sellingPrice.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>₩ ${data.exchangeRate.toLocaleString('ko-KR')}</td>
        <td>₩ ${Math.round(data.domesticShipping).toLocaleString('ko-KR')}</td>
        <td>₩ ${Math.round(data.intlShipping).toLocaleString('ko-KR')}</td>
        <td>${data.platformFeeRate}%</td>
        <td>${data.fxSpreadRate}%</td>
        <td class="${netProfitClass}">₩ ${Math.round(data.netProfit).toLocaleString('ko-KR')}</td>
        <td class="${marginRateClass}">${data.marginRate.toFixed(2)}%</td>
        <td>${data.timestamp.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
    `;
    historyTableBody.appendChild(row);
    if (historySection) historySection.style.display = 'block';
    saveHistoryToLocalStorage();
}

function saveHistoryToLocalStorage() {
    try {
        const toSave = calculationHistory.slice(-50).map(d => ({ ...d, timestamp: d.timestamp.toISOString() }));
        localStorage.setItem('marginCalcHistory', JSON.stringify(toSave));
    } catch(e) {}
}

function loadHistoryFromLocalStorage() {
    try {
        const raw = localStorage.getItem('marginCalcHistory');
        if (!raw) return;
        const items = JSON.parse(raw);
        if (!Array.isArray(items) || items.length === 0) return;
        items.forEach(d => addToHistory({ ...d, timestamp: new Date(d.timestamp) }));
    } catch(e) {}
}

function downloadExcel() {
    if (calculationHistory.length === 0) { alert('다운로드할 계산 이력이 없습니다.'); return; }
    let csv = '\uFEFF';
    csv += 'No,상품명,매입가(원),판매 타겟 통화,판매가,환율(원),국내배송비(원),해외배송비(원),플랫폼 수수료(%),환전 수수료(%),순이익(원),마진율(%),계산일시\n';
    calculationHistory.forEach((data, index) => {
        const symbol = currencyInfo[data.currency]?.symbol || '';
        csv += `${index + 1},"${data.productName}",${Math.round(data.purchasePrice)},${data.currency},${symbol} ${data.sellingPrice.toFixed(2)},${data.exchangeRate},${Math.round(data.domesticShipping)},${Math.round(data.intlShipping)},${data.platformFeeRate},${data.fxSpreadRate},${Math.round(data.netProfit)},${data.marginRate.toFixed(2)},"${data.timestamp.toLocaleString('ko-KR')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `마진계산_이력_${today}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function reverseCalculate() {
    const targetMarginRate = parseFloat(targetMarginInput.value) || 0;
    const purchasePrice = parseFloat(purchasePriceInput.value) || 0;
    const platformFeeRate = parseFloat(platformFeeInput.value) || 0;
    const fxSpreadRate = parseFloat(fxSpreadInput.value) || 0;
    const domesticShipping = parseFloat(domesticShippingInput.value) || 0;
    const intlShipping = parseFloat(intlShippingInput.value) || 0;
    const applyVatRefund = vatRefundCheckbox.checked;

    if (targetMarginRate <= 0 || targetMarginRate >= 100) { alert('목표 마진율을 1~99% 사이로 입력해주세요.'); return; }
    if (purchasePrice <= 0) { alert('매입가를 먼저 입력해주세요.'); return; }
    if (currentExchangeRate <= 0) { alert('환율 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return; }

    const vatRefund = applyVatRefund ? purchasePrice * 0.10 : 0;
    const fixedCost = purchasePrice + domesticShipping + intlShipping - vatRefund;
    const totalFeeRate = platformFeeRate + fxSpreadRate + targetMarginRate;

    if (totalFeeRate >= 100) { alert('플랫폼 수수료 + 환전 수수료 + 목표 마진율의 합이 100% 이상입니다. 값을 조정해주세요.'); return; }

    const requiredRevenue = fixedCost / (1 - totalFeeRate / 100);
    const requiredSellingPrice = requiredRevenue / currentExchangeRate;

    const symbol = currencyInfo[currentCurrency]?.symbol || '';
    recommendedPrice.textContent = `${symbol} ${requiredSellingPrice.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    reverseResult.style.display = 'block';
    sellingPriceInput.value = requiredSellingPrice.toFixed(2);

    if (typeof gtag !== 'undefined') { gtag('event', 'reverse_calculate', { 'event_category': 'calculator', 'event_label': 'reverse_margin', 'value': targetMarginRate }); }
}

// ===== 프로젝트 관리 =====
function getProjects() {
    try { return JSON.parse(localStorage.getItem('marginProjects') || '[]'); } catch(e) { return []; }
}

function saveProject() {
    const name = document.getElementById('projectNameInput')?.value.trim();
    if (!name) { showToast('프로젝트 이름을 입력해주세요.'); return; }

    const revenue = (parseFloat(sellingPriceInput.value) || 0) * currentExchangeRate;
    const purchase = parseFloat(purchasePriceInput.value) || 0;
    const fee = revenue * ((parseFloat(platformFeeInput.value) || 0) / 100);
    const fx  = revenue * ((parseFloat(fxSpreadInput.value) || 0) / 100);
    const dom = parseFloat(domesticShippingInput.value) || 0;
    const intl = parseFloat(intlShippingInput.value) || 0;
    const vat = vatRefundCheckbox.checked ? purchase * 0.1 : 0;
    const netProfit  = revenue - purchase - fee - fx - dom - intl + vat;
    const marginRate = revenue > 0 ? (netProfit / revenue * 100) : 0;

    const data = {
        id: Date.now(),
        name,
        purchasePrice: purchase,
        currency: currentCurrency,
        sellingPrice: parseFloat(sellingPriceInput.value) || 0,
        exchangeRate: currentExchangeRate,
        domesticShipping: dom,
        intlShipping: intl,
        platformFeeRate: parseFloat(platformFeeInput.value) || 0,
        fxSpreadRate: parseFloat(fxSpreadInput.value) || 0,
        vatRefund: vatRefundCheckbox.checked,
        netProfit,
        marginRate,
        savedAt: new Date().toISOString(),
    };

    const projects = getProjects();
    projects.unshift(data);
    localStorage.setItem('marginProjects', JSON.stringify(projects.slice(0, 20)));
    document.getElementById('projectNameInput').value = '';
    renderProjects();
    showToast(`"${name}" 저장 완료!`);
    if (typeof gtag !== 'undefined') gtag('event', 'save_project', { event_category: 'projects' });
}

function renderProjects() {
    const projects = getProjects();
    const section = document.getElementById('projectsSection');
    const grid    = document.getElementById('projectsGrid');
    if (!section || !grid) return;
    section.style.display = 'block';

    if (!projects.length) {
        grid.innerHTML = '<p class="no-projects">저장된 프로젝트가 없습니다. 계산 후 이름을 입력하고 저장해보세요.</p>';
        return;
    }

    grid.innerHTML = projects.map(p => `
        <div class="project-card" onclick="loadProject(${p.id})">
            <div class="project-card-name">${p.name}</div>
            <div class="project-card-meta">${p.currency} · 수수료 ${p.platformFeeRate}% · ${new Date(p.savedAt).toLocaleDateString('ko-KR')}</div>
            <div class="project-card-profit ${p.netProfit >= 0 ? 'pos' : 'neg'}">
                ${p.netProfit >= 0 ? '+' : ''}₩${Math.round(p.netProfit).toLocaleString('ko-KR')} (${p.marginRate.toFixed(1)}%)
            </div>
        </div>
    `).join('') + `<div class="project-card project-card-delete" onclick="clearAllProjects()"><i class="fas fa-trash"></i> 전체 삭제</div>`;
}

function loadProject(id) {
    const p = getProjects().find(x => x.id === id);
    if (!p) return;
    purchasePriceInput.value    = p.purchasePrice;
    currencySelect.value        = p.currency;
    sellingPriceInput.value     = p.sellingPrice;
    platformFeeInput.value      = p.platformFeeRate;
    fxSpreadInput.value         = p.fxSpreadRate;
    domesticShippingInput.value = p.domesticShipping;
    intlShippingInput.value     = p.intlShipping;
    vatRefundCheckbox.checked   = p.vatRefund;
    currentCurrency             = p.currency;
    currentExchangeRate         = p.exchangeRate;
    if (sellingPriceCurrency) sellingPriceCurrency.textContent = p.currency;
    updateExchangeRateDisplay();
    showToast(`"${p.name}" 불러오기 완료`);
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
}

function clearAllProjects() {
    if (!confirm('저장된 프로젝트를 모두 삭제할까요?')) return;
    localStorage.removeItem('marginProjects');
    renderProjects();
}

function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
}

// ===== 실시간 환율 알림 =====
let rateAlertActive = false;
let rateAlertInterval = null;

function toggleRateAlert() {
    const panel = document.getElementById('rateAlertPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function saveAlertSettings() {
    const target = parseFloat(document.getElementById('alertTargetRate')?.value) || 0;
    if (!target) { showToast('목표 환율을 입력해주세요.'); return; }

    if (!('Notification' in window)) {
        document.getElementById('alertStatusText').textContent = '이 브라우저는 알림을 지원하지 않습니다.';
        return;
    }

    Notification.requestPermission().then(perm => {
        if (perm !== 'granted') {
            document.getElementById('alertStatusText').textContent = '알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.';
            return;
        }
        localStorage.setItem('rateAlertTarget', String(target));
        rateAlertActive = true;
        document.getElementById('alertStatusText').textContent = `✅ 환율 ₩${target.toLocaleString('ko-KR')} 도달 시 알림 발송`;
        document.getElementById('rateAlertTrigger').classList.add('active');
        startRateAlertCheck(target);
    });
}

function cancelRateAlert() {
    rateAlertActive = false;
    if (rateAlertInterval) { clearInterval(rateAlertInterval); rateAlertInterval = null; }
    localStorage.removeItem('rateAlertTarget');
    const statusEl = document.getElementById('alertStatusText');
    if (statusEl) statusEl.textContent = '알림이 해제되었습니다.';
    document.getElementById('rateAlertTrigger')?.classList.remove('active');
}

function startRateAlertCheck(target) {
    if (rateAlertInterval) clearInterval(rateAlertInterval);
    rateAlertInterval = setInterval(async () => {
        if (!rateAlertActive) { clearInterval(rateAlertInterval); return; }
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/KRW');
            const d   = await res.json();
            if (d.result === 'success' && d.rates?.USD) {
                const current = Math.round(1 / d.rates.USD);
                if (current >= target) {
                    new Notification('환율 알림 — 유어팀 마진 계산기', {
                        body: `현재 환율 ₩${current.toLocaleString('ko-KR')}이 목표(₩${target.toLocaleString('ko-KR')})에 도달했습니다!`,
                        icon: '/favicon.ico'
                    });
                    cancelRateAlert();
                }
            }
        } catch(e) {}
    }, 5 * 60 * 1000);
}

function loadAlertSettings() {
    const stored = localStorage.getItem('rateAlertTarget');
    if (!stored) return;
    const target = parseFloat(stored);
    if (!target) return;
    const inp = document.getElementById('alertTargetRate');
    if (inp) inp.value = target;
    const statusEl = document.getElementById('alertStatusText');
    if (statusEl) statusEl.textContent = `⏰ 환율 ₩${target.toLocaleString('ko-KR')} 알림 대기 중`;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        rateAlertActive = true;
        document.getElementById('rateAlertTrigger')?.classList.add('active');
        startRateAlertCheck(target);
    }
}

if (calculateBtn) calculateBtn.addEventListener('click', calculateMargin);
if (reverseCalcBtn) reverseCalcBtn.addEventListener('click', reverseCalculate);
if (excelDownloadBtn) excelDownloadBtn.addEventListener('click', downloadExcel);

document.querySelectorAll('input[type="number"], input[type="text"]').forEach(input => {
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') calculateMargin(); });
    // 콤마 포함 숫자 붙여넣기 처리
    input.addEventListener('paste', (e) => {
        const text = e.clipboardData.getData('text');
        const cleaned = text.replace(/,/g, '').trim();
        if (cleaned !== '' && !isNaN(cleaned)) {
            e.preventDefault();
            input.value = cleaned;
            input.dispatchEvent(new Event('input'));
        }
    });
});

// Ctrl+Enter 단축키
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        calculateMargin();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    currentCurrency = 'USD';
    currentExchangeRate = defaultExchangeRates[currentCurrency];
    if (sellingPriceCurrency) sellingPriceCurrency.textContent = currentCurrency;
    await fetchRealTimeExchangeRates();
    loadHistoryFromLocalStorage();
    renderProjects();
    loadAlertSettings();
});
