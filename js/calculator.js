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

async function fetchRealTimeExchangeRates() {
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

    addToHistory({ productName: productName || '상품명 없음', purchasePrice, currency: currentCurrency, sellingPrice, exchangeRate: currentExchangeRate, domesticShipping, intlShipping, platformFeeRate, fxSpreadRate, netProfit, marginRate, timestamp: new Date() });

    // 차트 업데이트
    if (typeof updateChart === 'function') {
        updateChart(revenue, purchasePrice, platformFee, fxSpread, domesticShipping, intlShipping, vatRefund, netProfit);
    }

    // 플랫폼 비교 업데이트
    if (typeof calculateComparison === 'function') calculateComparison();

    // 공유 버튼 노출
    const shareSection = document.getElementById('shareSection');
    if (shareSection) shareSection.style.display = 'flex';

    // 쿠팡 배너 노출
    const coupangBanner = document.getElementById('coupangBanner');
    if (coupangBanner) coupangBanner.style.display = 'block';

    // 입력값 자동 저장
    if (typeof saveInputsToLocalStorage === 'function') saveInputsToLocalStorage();

    if (typeof gtag !== 'undefined') { gtag('event', 'show_coupang_banner', { 'event_category': 'affiliate', 'event_label': 'coupang_partners' }); }

    setCalcBtnLoading(false);

    // 결과 섹션으로 부드럽게 스크롤
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
        setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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
});
