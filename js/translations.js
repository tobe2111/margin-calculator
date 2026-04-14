const languageNames = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語', vi: 'Tiếng Việt' };

const translations = {
    ko: {
        'h.title': '유어팀 글로벌 무료 마진 계산기',
        'header.platforms': '쇼피 · 이베이 · 아마존 · 라자다 · 큐텐 · 틱톡샵 · 라쿠텐',
        'h.sub': '해외판매 마진계산 - 수수료를 정확하게 계산하고 최적의 가격 전략을 수립하세요',
        'f.product': '상품명', 'f.product.ph': '상품명을 입력하세요',
        'f.purchase': '매입가', 'f.currency': '판매 타겟 통화 선택',
        'f.selling': '해외 판매가 (*환율 자동 반영)',
        'f.domestic': '국내배송비 (사업장 → 국내집하지)',
        'f.intl': '해외배송비 (국내집하지 → 해외 고객)',
        'b.calc': '마진 계산하기', 'r.title': '계산 결과', 'r.profit': '순이익 (마진)',
        'p.title': '플랫폼별 수수료 정보', 'faq.title': '자주 묻는 질문 (FAQ)',
        'ft.note': '본 계산기는 참고용이며, 실제 수수료는 플랫폼 정책에 따라 달라질 수 있습니다.',
        'ft.contact': '협업 및 제휴 문의 :'
    },
    en: {
        'h.title': 'YourTeam Global Free Margin Calculator',
        'header.platforms': 'Shopee · eBay · Amazon · Lazada · Qoo10 · TikTok Shop · Rakuten',
        'h.sub': 'Overseas Sales Margin Calculator - Accurately calculate fees and build optimal pricing strategies',
        'f.product': 'Product Name', 'f.product.ph': 'Enter product name',
        'f.purchase': 'Purchase Price', 'f.currency': 'Select Target Currency',
        'f.selling': 'Overseas Selling Price (*Exchange rate auto-applied)',
        'f.domestic': 'Domestic Shipping (Warehouse → Local Hub)',
        'f.intl': 'International Shipping (Local Hub → Overseas Customer)',
        'b.calc': 'Calculate Margin', 'r.title': 'Calculation Result', 'r.profit': 'Net Profit (Margin)',
        'p.title': 'Platform Fee Information', 'faq.title': 'Frequently Asked Questions (FAQ)',
        'ft.note': 'This calculator is for reference only. Actual fees may vary depending on platform policies.',
        'ft.contact': 'Business & Partnership Inquiries:'
    },
    zh: {
        'h.title': '您的团队全球免费利润计算器',
        'header.platforms': 'Shopee · eBay · Amazon · Lazada · Qoo10 · TikTok Shop · Rakuten',
        'h.sub': '海外销售利润计算 - 精准计算手续费，制定最优定价策略',
        'f.product': '商品名称', 'f.product.ph': '请输入商品名称',
        'f.purchase': '采购价格', 'f.currency': '选择目标货币',
        'f.selling': '海外售价（*自动适用汇率）',
        'f.domestic': '国内运费（仓库 → 国内集货地）',
        'f.intl': '国际运费（国内集货地 → 海外客户）',
        'b.calc': '计算利润', 'r.title': '计算结果', 'r.profit': '净利润（利润率）',
        'p.title': '各平台手续费信息', 'faq.title': '常见问题（FAQ）',
        'ft.note': '本计算器仅供参考，实际手续费可能因平台政策而有所不同。',
        'ft.contact': '合作与业务咨询：'
    },
    ja: {
        'h.title': 'ユアチームグローバル無料マージン計算機',
        'header.platforms': 'Shopee · eBay · Amazon · Lazada · Qoo10 · TikTok Shop · Rakuten',
        'h.sub': '海外販売マージン計算 - 手数料を正確に計算し、最適な価格戦略を立てましょう',
        'f.product': '商品名', 'f.product.ph': '商品名を入力してください',
        'f.purchase': '仕入れ価格', 'f.currency': '販売ターゲット通貨を選択',
        'f.selling': '海外販売価格（*為替レート自動反映）',
        'f.domestic': '国内送料（倉庫 → 国内集荷地）',
        'f.intl': '国際送料（国内集荷地 → 海外顧客）',
        'b.calc': 'マージンを計算する', 'r.title': '計算結果', 'r.profit': '純利益（マージン）',
        'p.title': 'プラットフォーム別手数料情報', 'faq.title': 'よくある質問（FAQ）',
        'ft.note': '本計算機は参考用であり、実際の手数料はプラットフォームのポリシーによって異なる場合があります。',
        'ft.contact': '提携・ビジネスお問い合わせ：'
    },
    vi: {
        'h.title': 'Máy Tính Lợi Nhuận Toàn Cầu YourTeam',
        'header.platforms': 'Shopee · eBay · Amazon · Lazada · Qoo10 · TikTok Shop · Rakuten',
        'h.sub': 'Tính lợi nhuận bán hàng quốc tế - Tính phí chính xác và xây dựng chiến lược giá tối ưu',
        'f.product': 'Tên sản phẩm', 'f.product.ph': 'Nhập tên sản phẩm',
        'f.purchase': 'Giá nhập', 'f.currency': 'Chọn đơn vị tiền tệ mục tiêu',
        'f.selling': 'Giá bán quốc tế (*Tỷ giá tự động áp dụng)',
        'f.domestic': 'Phí vận chuyển nội địa (Kho → Điểm gom hàng)',
        'f.intl': 'Phí vận chuyển quốc tế (Điểm gom hàng → Khách hàng quốc tế)',
        'b.calc': 'Tính lợi nhuận', 'r.title': 'Kết quả tính toán', 'r.profit': 'Lợi nhuận ròng',
        'p.title': 'Thông tin phí theo nền tảng', 'faq.title': 'Câu hỏi thường gặp (FAQ)',
        'ft.note': 'Máy tính này chỉ mang tính chất tham khảo. Phí thực tế có thể khác nhau tùy theo chính sách nền tảng.',
        'ft.contact': 'Liên hệ hợp tác & kinh doanh:'
    }
};
