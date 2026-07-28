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
const RATE_API_PROXY = '/api/rates';
const RATE_CACHE_KEY = 'marginRateCache';

/**
 * 환율 원본 데이터를 가져온다.
 * 자체 프록시(/api/rates)를 우선 사용 — 서버 KV 캐시를 공유하므로
 * 외부 API 호출량이 사용자 수와 무관하게 일정하고 응답도 빠르다.
 * 프록시가 없는 환경(로컬 정적 서버 등)에서는 직접 호출로 폴백한다.
 */
async function fetchRatesPayload() {
    try {
        const r = await fetch(RATE_API_PROXY);
        if (r.ok) {
            const j = await r.json();
            if (j && j.rates) return j;
        }
    } catch (e) { /* 직접 호출로 폴백 */ }
    const r2 = await fetch(EXCHANGE_RATE_API);
    if (!r2.ok) throw new Error('환율 API 요청 실패');
    const j2 = await r2.json();
    if (!j2 || !j2.rates) throw new Error('잘못된 API 응답');
    return { rates: j2.rates, updated: j2.time_last_update_utc || null };
}
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1시간
let currentCurrency = 'USD';
let currentExchangeRate = 1300;
let calculationHistory = [];

/**
 * 지금 화면의 환율이 어디서 왔는지.
 * 'live'  — 방금 API에서 받음
 * 'cache' — 로컬 캐시 (1시간 이내)
 * 'stale' — API 실패, 만료된 캐시로 버팀
 * 'fallback' — API도 캐시도 없어 내장 기준값 사용
 *
 * 예전에는 실패해도 console.warn 만 찍고 내장 기준값으로 조용히 계산했다.
 * 사용자는 실시간 환율인 줄 알고 그 숫자로 판매가를 정하게 되므로,
 * 출처를 화면에 반드시 표시한다.
 */
let rateSource = 'fallback';
let rateAsOf = null;

function setRateSource(kind, asOf) {
    rateSource = kind;
    rateAsOf = asOf || null;
    renderRateSourceBadge();
    renderHeroRates();
    // 좌측 사이드바 시세도 같은 값으로 맞춘다
    if (typeof window.renderSidebarRates === 'function') {
        window.renderSidebarRates(defaultExchangeRates, kind);
    }
}

/** 히어로 오른쪽 환율 패널. 환율이 갱신될 때마다 같이 다시 그린다. */
function renderHeroRates() {
    const list = document.getElementById('heroRatesList');
    if (!list) return;
    const put = (key, val) => {
        const el = list.querySelector(`[data-hr="${key}"]`);
        if (el) el.textContent = val;
    };
    const r = defaultExchangeRates || {};
    const fmt = (v, d = 0) => (typeof v === 'number' && isFinite(v) && v > 0)
        ? '₩ ' + v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d })
        : '—';
    put('USD', fmt(r.USD));
    put('JPY100', fmt(typeof r.JPY === 'number' ? r.JPY * 100 : null));
    put('EUR', fmt(r.EUR));
    put('CNY', fmt(r.CNY));

    const foot = document.getElementById('heroRatesFoot');
    if (foot) {
        const label = {
            live: '실시간 기준', cache: '최근 조회 기준',
            stale: '지연 — 최근 성공한 값', fallback: '실시간 연결 실패 — 내장 기준값',
        }[rateSource] || '';
        foot.textContent = label + (rateSource === 'fallback' ? '. 실제 환율과 다를 수 있습니다.' : '');
        foot.style.color = rateSource === 'fallback' ? 'var(--neg)' : '';
    }
}

function renderRateSourceBadge() {
    const el = document.getElementById('rateSourceBadge');
    if (!el) return;
    const rel = (t) => {
        if (!t) return '';
        const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
        if (!isFinite(m) || m < 0) return '';
        if (m < 1) return '방금';
        if (m < 60) return `${m}분 전`;
        const h = Math.floor(m / 60);
        return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
    };
    const map = {
        live:     { cls: 'ok',   txt: '실시간',   sub: rel(rateAsOf) },
        cache:    { cls: 'ok',   txt: '캐시',     sub: rel(rateAsOf) },
        stale:    { cls: 'warn', txt: '지연',     sub: `최근 성공 ${rel(rateAsOf)}` },
        fallback: { cls: 'bad',  txt: '연결 실패', sub: '내장 기준값으로 계산 중' },
    };
    const m = map[rateSource] || map.fallback;
    el.className = 'rate-source ' + m.cls;
    el.innerHTML = `<b>${m.txt}</b>${m.sub ? `<span>${m.sub}</span>` : ''}`;
    el.title = rateSource === 'fallback'
        ? '실시간 환율을 불러오지 못해 내장 기준값을 쓰고 있습니다. 실제 환율과 차이가 클 수 있으니 새로고침하거나 직접 확인하세요.'
        : '';
}

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
        setRateSource('cache', ts);
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
        const data = await fetchRatesPayload();
        if (data && data.rates) {
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
            updateExchangeRateTimestamp(data.updated);
            saveCachedRates();
            setRateSource('live', Date.now());
            return true;
        } else {
            throw new Error('잘못된 API 응답');
        }
    } catch (error) {
        console.warn('⚠️ 실시간 환율 로드 실패:', error.message);
        // 만료됐더라도 캐시가 있으면 내장 기준값보다 낫다.
        let usedStale = false;
        try {
            const raw = localStorage.getItem(RATE_CACHE_KEY);
            if (raw) {
                const { rates, ts } = JSON.parse(raw);
                if (rates && rates[currentCurrency]) {
                    defaultExchangeRates = rates;
                    setRateSource('stale', ts);
                    usedStale = true;
                }
            }
        } catch (e) { /* 내장 기준값으로 */ }
        if (!usedStale) setRateSource('fallback', null);
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
    const adCostPerUnit = parseFloat(document.getElementById('adCostPerUnit')?.value) || 0;
    const returnRate = parseFloat(document.getElementById('returnRate')?.value) || 0;

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
    // 반품 시 매입가·플랫폼 수수료·배송비는 회수 불가로 가정한 기대 손실
    const returnLoss = (returnRate / 100) * (purchasePrice + platformFee + domesticShipping + intlShipping);
    const totalCostBeforeVat = purchasePrice + platformFee + fxSpread + domesticShipping + intlShipping + adCostPerUnit + returnLoss;
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

    // 광고비 / 반품 손실은 입력이 있을 때만 상세내역에 노출
    const rowAd = document.getElementById('rowAdCost');
    if (rowAd) {
        rowAd.style.display = adCostPerUnit > 0 ? 'flex' : 'none';
        document.getElementById('costAdSpend').textContent = `₩ ${Math.round(adCostPerUnit).toLocaleString('ko-KR')}`;
    }
    const rowRet = document.getElementById('rowReturnRisk');
    if (rowRet) {
        rowRet.style.display = returnLoss > 0 ? 'flex' : 'none';
        document.getElementById('costReturnRisk').textContent = `₩ ${Math.round(returnLoss).toLocaleString('ko-KR')} (${returnRate}%)`;
    }
    document.getElementById('roi').textContent = `${roi.toFixed(2)} %`;
    document.getElementById('breakEvenPrice').textContent = `${symbol} ${breakEvenPrice.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('resultSection').style.display = 'block';
    document.querySelector('.calculator-container')?.classList.add('has-result');
    const preResult = document.getElementById('preResult');
    if (preResult) preResult.style.display = 'none';

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
    const toolHandoff = document.getElementById('toolHandoff');
    if (toolHandoff) toolHandoff.style.display = 'flex';

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
        <td><button type="button" class="history-load-btn" data-hidx="${no - 1}" title="이 조건으로 다시 계산">불러오기</button></td>
    `;
    const loadBtn = row.querySelector('.history-load-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            if (typeof loadFromHistory === 'function') loadFromHistory(Number(loadBtn.dataset.hidx));
        });
    }
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
    const adCostPerUnit = parseFloat(document.getElementById('adCostPerUnit')?.value) || 0;
    const returnRate = parseFloat(document.getElementById('returnRate')?.value) || 0;

    if (targetMarginRate <= 0 || targetMarginRate >= 100) { alert('목표 마진율을 1~99% 사이로 입력해주세요.'); return; }
    if (purchasePrice <= 0) { alert('매입가를 먼저 입력해주세요.'); return; }
    if (currentExchangeRate <= 0) { alert('환율 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return; }

    const vatRefund = applyVatRefund ? purchasePrice * 0.10 : 0;
    const r = returnRate / 100;
    // 반품 손실은 매출 무관 부분(매입·배송)과 매출 비례 부분(플랫폼 수수료)으로 분해된다
    const baseFixed = purchasePrice + domesticShipping + intlShipping;
    const fixedCost = baseFixed + adCostPerUnit - vatRefund + r * baseFixed;
    const totalFeeRate = platformFeeRate + fxSpreadRate + targetMarginRate + r * platformFeeRate;

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
    // 상한을 넘으면 가장 오래된 항목이 밀려난다. 예전에는 말없이 사라져
    // 사용자가 잃어버린 사실조차 몰랐으므로, 무엇이 지워지는지 알린다.
    const MAX_PROJECTS = 20;
    const dropped = projects.length > MAX_PROJECTS ? projects.slice(MAX_PROJECTS) : [];
    localStorage.setItem('marginProjects', JSON.stringify(projects.slice(0, MAX_PROJECTS)));
    document.getElementById('projectNameInput').value = '';
    renderProjects();
    if (dropped.length) {
        showToast(`"${name}" 저장 — 한도(${MAX_PROJECTS}개) 초과로 "${dropped[0].name}" 삭제됨`);
    } else {
        showToast(`"${name}" 저장 완료!`);
    }
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
        document.getElementById('alertStatusText').textContent =
            `✅ ₩${target.toLocaleString('ko-KR')} 알림 등록 — 확인 중...`;
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

/**
 * 목표 환율 도달 확인.
 *
 * 이 검사는 페이지가 열려 있는 동안에만 동작한다. 브라우저는 닫힌 탭에서
 * 임의의 주기 작업을 돌려주지 않기 때문이다(Periodic Background Sync 는
 * 설치형 PWA에 한정되고 발화 시점도 보장되지 않는다).
 *
 * 그래서 두 가지로 보완한다.
 *  1) 다시 방문했을 때 즉시 한 번 검사한다. 자리를 비운 사이 목표에
 *     도달했더라도 돌아오는 즉시 알 수 있다.
 *  2) UI에 "탭이 열려 있는 동안 확인" 이라고 명시한다.
 *     예전에는 이 사실을 알리지 않아, 알림을 걸어두고 탭을 닫은 사용자가
 *     오지 않을 알림을 기다리게 됐다.
 */
async function checkRateAlertOnce(target) {
    try {
        const d = await fetchRatesPayload();
        if (!d.rates?.USD) return false;
        const current = Math.round(1 / d.rates.USD);
        const statusEl = document.getElementById('alertStatusText');
        if (current >= target) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('환율 알림 — 유어팀 마진 계산기', {
                    body: `현재 환율 ₩${current.toLocaleString('ko-KR')}이 목표(₩${target.toLocaleString('ko-KR')})에 도달했습니다.`,
                    icon: '/apple-touch-icon.png'
                });
            }
            showToast(`🔔 목표 환율 도달 — 현재 ₩${current.toLocaleString('ko-KR')}`);
            cancelRateAlert();
            if (statusEl) statusEl.textContent = `🔔 목표 도달! 현재 ₩${current.toLocaleString('ko-KR')} (알림 해제됨)`;
            return true;
        }
        if (statusEl) {
            statusEl.textContent =
                `⏰ 대기 중 — 현재 ₩${current.toLocaleString('ko-KR')} / 목표 ₩${target.toLocaleString('ko-KR')}`;
        }
    } catch (e) { /* 다음 주기에 재시도 */ }
    return false;
}

function startRateAlertCheck(target) {
    if (rateAlertInterval) clearInterval(rateAlertInterval);
    checkRateAlertOnce(target); // 방문 즉시 1회
    rateAlertInterval = setInterval(() => {
        if (!rateAlertActive) { clearInterval(rateAlertInterval); rateAlertInterval = null; return; }
        if (document.hidden) return; // 백그라운드 탭에서는 외부 호출을 아낀다
        checkRateAlertOnce(target);
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
