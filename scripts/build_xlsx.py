#!/usr/bin/env python3
"""
다운로드용 엑셀 마진 계산기 생성기.

두 개의 .xlsx 를 만든다. 값이 아니라 수식을 넣기 때문에,
받는 사람이 노란 입력칸만 고치면 순이익·마진율이 즉시 다시 계산된다.

  downloads/shopee-margin-calculator.xlsx  — 쇼피 8개국 동시 비교
  downloads/qoo10-japan-margin-calculator.xlsx — 큐텐 재팬(엔화) 단품 + 다중 상품

  $ python3 scripts/build_xlsx.py

수수료율과 환율은 '기본값'이다. 플랫폼 정책·카테고리·프로모션에 따라
실제 요율이 다르므로 시트 안에서 직접 수정하도록 입력칸으로 열어 둔다.
"""

import os

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "downloads")

# ── 디자인 토큰 (웹사이트와 같은 색을 쓴다) ──────────────────────────
ACCENT = "2570E8"
INK = "14161A"
INPUT_BG = "FFF8E1"   # 노란색 = 직접 입력
CALC_BG = "F4F5F7"    # 회색  = 자동 계산
HEAD_BG = "1B58BF"
POS = "0B7A5C"
NEG = "C42A44"

THIN = Side(style="thin", color="D0D5DD")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

F_TITLE = Font(name="맑은 고딕", size=15, bold=True, color=INK)
F_HEAD = Font(name="맑은 고딕", size=10, bold=True, color="FFFFFF")
F_LABEL = Font(name="맑은 고딕", size=10, bold=True, color=INK)
F_BODY = Font(name="맑은 고딕", size=10, color=INK)
F_NOTE = Font(name="맑은 고딕", size=9, color="5C636E")

FILL_HEAD = PatternFill("solid", fgColor=HEAD_BG)
FILL_INPUT = PatternFill("solid", fgColor=INPUT_BG)
FILL_CALC = PatternFill("solid", fgColor=CALC_BG)

KRW = '#,##0"원"'
NUM2 = "#,##0.00"
PCT = "0.0%"

CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")


def put(ws, coord, value, *, font=F_BODY, fill=None, fmt=None,
        align=None, border=True):
    c = ws[coord]
    c.value = value
    c.font = font
    if fill:
        c.fill = fill
    if fmt:
        c.number_format = fmt
    if align:
        c.alignment = align
    if border:
        c.border = BOX
    return c


def widths(ws, mapping):
    for col, w in mapping.items():
        ws.column_dimensions[col].width = w


# ══════════════════════════════════════════════════════════════════
# 1. 쇼피 — 국가별 마진 비교
# ══════════════════════════════════════════════════════════════════

# (국가, 통화, 1통화당 원화 기본값, 판매수수료, 결제수수료, 환율 표시서식,
#  현지통화 판매가 기본값 — 전부 약 33,000원 수준으로 맞춰 비교가 되게 한다)
SHOPEE_COUNTRIES = [
    ("싱가포르",  "SGD", 1070,   0.06, 0.020, NUM2,     31),
    ("말레이시아", "MYR", 330,    0.08, 0.020, NUM2,     100),
    ("태국",      "THB", 42,     0.09, 0.030, NUM2,     790),
    ("필리핀",    "PHP", 24,     0.08, 0.020, NUM2,     1380),
    ("베트남",    "VND", 0.055,  0.10, 0.025, "#,##0",  600000),
    ("대만",      "TWD", 44,     0.08, 0.020, NUM2,     750),
    ("브라질",    "BRL", 250,    0.20, 0.020, NUM2,     132),
    ("멕시코",    "MXN", 72,     0.16, 0.020, NUM2,     460),
]

# 국가 표 컬럼 배치
#  A 국가 / B 통화 / C 환율 / D 판매가(현지) / E 국제배송비 / F 판매수수료율
#  G 결제수수료율 / H 기타비용 / I 판매가(원) / J 수수료합(원) / K 총비용(원)
#  L 순이익(원) / M 마진율 / N ROI / O 손익분기 판매가(현지) / P 목표마진 판매가(현지)
SHOPEE_HEADERS = [
    ("A", "국가"),
    ("B", "통화"),
    ("C", "환율\n(1통화=원)"),
    ("D", "판매가격\n(현지통화)"),
    ("E", "국제배송비\n(원)"),
    ("F", "판매\n수수료율"),
    ("G", "결제\n수수료율"),
    ("H", "기타비용\n(원)"),
    ("I", "판매가격\n(원)"),
    ("J", "쇼피 수수료\n(원)"),
    ("K", "총비용\n(원)"),
    ("L", "순이익\n(원)"),
    ("M", "마진율"),
    ("N", "ROI"),
    ("O", "손익분기가\n(현지통화)"),
    ("P", "목표마진 판매가\n(현지통화)"),
]

INPUT_COLS = ("C", "D", "E", "F", "G", "H")


def build_shopee():
    wb = Workbook()
    ws = wb.active
    ws.title = "국가별 마진 비교"

    put(ws, "A1", "쇼피(Shopee) 국가별 마진 계산기", font=F_TITLE, border=False)
    ws.merge_cells("A1:F1")
    put(ws, "H1", "노란칸만 입력하면 나머지는 자동 계산됩니다",
        font=F_NOTE, border=False)
    ws.row_dimensions[1].height = 26

    # ── 공통 입력 (모든 국가에 똑같이 적용되는 값) ──────────────
    put(ws, "A3", "공통 입력", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells("A3:C3")

    common = [
        ("A4", "상품명", "샘플 상품", None, LEFT),
        ("A5", "상품원가 (원)", 12000, KRW, RIGHT),
        ("A6", "국내배송비 (원)", 3000, KRW, RIGHT),
        ("A7", "포장비 (원)", 800, KRW, RIGHT),
        ("A8", "개당 광고비 (원)", 1500, KRW, RIGHT),
        ("A9", "반품률", 0.03, PCT, RIGHT),
        ("A10", "목표 마진율", 0.20, PCT, RIGHT),
    ]
    for label_cell, label, val, fmt, align in common:
        row = int(label_cell[1:])
        put(ws, f"A{row}", label, font=F_BODY, fill=FILL_CALC, align=LEFT)
        ws.merge_cells(f"A{row}:B{row}")
        ws[f"B{row}"].border = BOX
        put(ws, f"C{row}", val, fill=FILL_INPUT, fmt=fmt, align=align)

    put(ws, "E4",
        "반품률은 '반품 시 상품원가·배송비를 전부 잃는다'고 보고 비용에 더합니다.\n"
        "수수료율은 기본값입니다. 실제 요율은 쇼피 셀러센터에서 확인 후 F·G열을 고쳐 쓰세요.\n"
        "환율은 https://margin.ur-team.com 에서 실시간 값을 확인할 수 있습니다.",
        font=F_NOTE, align=LEFT, border=False)
    ws.merge_cells("E4:P9")

    # ── 국가 표 ─────────────────────────────────────────────
    HEAD_ROW = 13
    put(ws, "A12", "국가별 비교", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells("A12:D12")

    for col, text in SHOPEE_HEADERS:
        put(ws, f"{col}{HEAD_ROW}", text, font=F_HEAD, fill=FILL_HEAD,
            align=CENTER)
    ws.row_dimensions[HEAD_ROW].height = 34

    first = HEAD_ROW + 1
    for i, (name, cur, fx, sell_fee, pay_fee, fx_fmt, price) in enumerate(SHOPEE_COUNTRIES):
        r = first + i
        put(ws, f"A{r}", name, font=F_LABEL, align=LEFT)
        put(ws, f"B{r}", cur, align=CENTER)
        put(ws, f"C{r}", fx, fill=FILL_INPUT, fmt=fx_fmt, align=RIGHT)
        put(ws, f"D{r}", price, fill=FILL_INPUT,
            fmt="#,##0" if cur == "VND" else NUM2, align=RIGHT)
        put(ws, f"E{r}", 6000, fill=FILL_INPUT, fmt=KRW, align=RIGHT)
        put(ws, f"F{r}", sell_fee, fill=FILL_INPUT, fmt=PCT, align=RIGHT)
        put(ws, f"G{r}", pay_fee, fill=FILL_INPUT, fmt=PCT, align=RIGHT)
        put(ws, f"H{r}", 0, fill=FILL_INPUT, fmt=KRW, align=RIGHT)

        # 판매가격(원) = 현지 판매가 × 환율
        put(ws, f"I{r}", f"=D{r}*C{r}", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        # 쇼피 수수료 = 판매가(원) × (판매수수료율 + 결제수수료율)
        put(ws, f"J{r}", f"=I{r}*(F{r}+G{r})", fill=FILL_CALC, fmt=KRW,
            align=RIGHT)
        # 총비용 = 원가+국내배송+포장+광고+국제배송+수수료+기타 + 반품손실
        put(ws, f"K{r}",
            f"=$C$5+$C$6+$C$7+$C$8+E{r}+J{r}+H{r}"
            f"+$C$9*($C$5+$C$6+$C$7+E{r}+J{r})",
            fill=FILL_CALC, fmt=KRW, align=RIGHT)
        # 순이익 = 판매가(원) − 총비용
        put(ws, f"L{r}", f"=I{r}-K{r}", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        # 마진율 = 순이익 / 판매가(원)
        put(ws, f"M{r}", f'=IF(I{r}=0,"",L{r}/I{r})', fill=FILL_CALC,
            fmt=PCT, align=RIGHT)
        # ROI = 순이익 / (원가+국내배송+포장+광고+국제배송)
        put(ws, f"N{r}",
            f'=IF(($C$5+$C$6+$C$7+$C$8+E{r})=0,"",'
            f"L{r}/($C$5+$C$6+$C$7+$C$8+E{r}))",
            fill=FILL_CALC, fmt=PCT, align=RIGHT)
        # 손익분기 판매가 — 순이익이 0이 되는 현지통화 판매가
        # 판매가(원) P 에 대해: P = 고정비 + P×수수료율 + 반품률×(고정비' + P×수수료율)
        #  → P × (1 − 수수료율 × (1+반품률)) = 고정비 + 반품률 × 고정비'
        put(ws, f"O{r}",
            f"=IFERROR((($C$5+$C$6+$C$7+$C$8+E{r}+H{r})"
            f"+$C$9*($C$5+$C$6+$C$7+E{r}))"
            f"/(1-(F{r}+G{r})*(1+$C$9))/C{r},\"\")",
            fill=FILL_CALC, fmt="#,##0.00", align=RIGHT)
        # 목표 마진율을 맞추는 판매가
        put(ws, f"P{r}",
            f"=IFERROR((($C$5+$C$6+$C$7+$C$8+E{r}+H{r})"
            f"+$C$9*($C$5+$C$6+$C$7+E{r}))"
            f"/(1-(F{r}+G{r})*(1+$C$9)-$C$10)/C{r},\"\")",
            fill=FILL_CALC, fmt="#,##0.00", align=RIGHT)

    last = first + len(SHOPEE_COUNTRIES) - 1

    # ── 요약 ───────────────────────────────────────────────
    s = last + 2
    put(ws, f"A{s}", "가장 남는 국가", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells(f"A{s}:B{s}")
    ws[f"B{s}"].border = BOX
    put(ws, f"C{s}",
        f'=IFERROR(INDEX($A${first}:$A${last},MATCH(MAX($L${first}:$L${last}),'
        f'$L${first}:$L${last},0)),"")',
        font=F_LABEL, fill=FILL_CALC, align=CENTER)
    put(ws, f"D{s}", f"=MAX($L${first}:$L${last})", font=F_LABEL,
        fill=FILL_CALC, fmt=KRW, align=RIGHT)
    put(ws, f"E{s}",
        f'=IFERROR(INDEX($M${first}:$M${last},MATCH(MAX($L${first}:$L${last}),'
        f'$L${first}:$L${last},0)),"")',
        font=F_LABEL, fill=FILL_CALC, fmt=PCT, align=RIGHT)
    put(ws, f"F{s}", "← 순이익 / 마진율", font=F_NOTE, align=LEFT, border=False)

    s2 = s + 1
    put(ws, f"A{s2}", "적자 국가 수", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells(f"A{s2}:B{s2}")
    ws[f"B{s2}"].border = BOX
    put(ws, f"C{s2}", f'=COUNTIF($L${first}:$L${last},"<0")&"개국"',
        font=F_LABEL, fill=FILL_CALC, align=CENTER)

    # 마진율·순이익 조건부 서식
    ws.conditional_formatting.add(
        f"L{first}:M{last}",
        CellIsRule(operator="lessThan", formula=["0"],
                   font=Font(name="맑은 고딕", size=10, bold=True, color=NEG)))
    ws.conditional_formatting.add(
        f"M{first}:M{last}",
        CellIsRule(operator="greaterThanOrEqual", formula=["0.15"],
                   font=Font(name="맑은 고딕", size=10, bold=True, color=POS)))

    widths(ws, {"A": 13, "B": 7, "C": 12, "D": 13, "E": 12, "F": 10, "G": 10,
                "H": 11, "I": 14, "J": 13, "K": 13, "L": 14, "M": 9, "N": 9,
                "O": 14, "P": 16})
    ws.freeze_panes = f"C{first}"
    ws.sheet_view.showGridLines = False

    build_guide_sheet(
        wb,
        title="쇼피 국가별 마진 계산기 — 사용법",
        rows=[
            ("① 공통 입력 (C5:C10)",
             "상품원가·국내배송비·포장비·광고비·반품률·목표마진율을 넣습니다. "
             "모든 국가에 동일하게 적용됩니다."),
            ("② 국가별 입력 (C14:H21)",
             "환율·현지통화 판매가·국제배송비·수수료율·기타비용을 국가별로 넣습니다. "
             "노란칸이 전부 입력칸입니다."),
            ("③ 결과 (I:N열)",
             "판매가(원)·수수료·총비용·순이익·마진율·ROI가 자동 계산됩니다. "
             "마진율이 0 미만이면 빨강, 15% 이상이면 초록으로 표시됩니다."),
            ("④ 가격 역산 (O:P열)",
             "O열은 본전이 되는 판매가, P열은 목표 마진율을 맞추는 판매가입니다. "
             "둘 다 현지통화 기준이라 그대로 상품 등록에 쓸 수 있습니다."),
            ("계산식 — 판매가(원)", "현지통화 판매가 × 환율"),
            ("계산식 — 쇼피 수수료", "판매가(원) × (판매수수료율 + 결제수수료율)"),
            ("계산식 — 총비용",
             "상품원가 + 국내배송비 + 포장비 + 광고비 + 국제배송비 + 쇼피수수료 "
             "+ 기타비용 + 반품손실"),
            ("계산식 — 반품손실",
             "반품률 × (상품원가 + 국내배송비 + 포장비 + 국제배송비 + 쇼피수수료)"),
            ("계산식 — 순이익", "판매가(원) − 총비용"),
            ("계산식 — 마진율", "순이익 ÷ 판매가(원)"),
            ("계산식 — ROI",
             "순이익 ÷ (상품원가 + 국내배송비 + 포장비 + 광고비 + 국제배송비)"),
            ("수수료율 주의",
             "표에 넣은 수수료율은 기본값입니다. 카테고리·프로모션·셀러 등급에 따라 "
             "달라지므로 쇼피 셀러센터의 실제 요율로 바꿔서 쓰세요."),
            ("환율 주의",
             "환율은 매일 바뀝니다. margin.ur-team.com 사이드바에서 실시간 환율을 "
             "확인하고 C열에 옮겨 적으면 정확합니다."),
            ("부가세·관세",
             "이 시트는 한국 수출 부가세 영세율(0%)과 현지 수입관세 면세 구간을 "
             "가정합니다. 해당되지 않으면 '기타비용(H열)'에 더해 주세요."),
        ])
    return wb


# ══════════════════════════════════════════════════════════════════
# 2. 큐텐 재팬 — 엔화 마진
# ══════════════════════════════════════════════════════════════════

def build_qoo10():
    wb = Workbook()
    ws = wb.active
    ws.title = "큐텐 일본 마진"

    put(ws, "A1", "큐텐(Qoo10) 재팬 마진 계산기", font=F_TITLE, border=False)
    ws.merge_cells("A1:D1")
    put(ws, "F1", "노란칸만 입력하면 나머지는 자동 계산됩니다",
        font=F_NOTE, border=False)
    ws.row_dimensions[1].height = 26

    put(ws, "A3", "입력", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells("A3:C3")

    # (행, 라벨, 기본값, 서식, 단위설명)
    inputs = [
        (4,  "상품명",              "샘플 상품", None,     ""),
        (5,  "환율 (1엔 = ? 원)",   9.30,        "#,##0.00", "100엔 기준 환율 ÷ 100"),
        (6,  "판매가격 (엔)",       3980,        "#,##0",  "큐텐 등록가"),
        (7,  "상품원가 (원)",       12000,       KRW,      "매입가"),
        (8,  "국제배송비 (원)",     6000,        KRW,      "개당 일본 배송비"),
        (9,  "포장비 (원)",         800,         KRW,      "박스·완충재·라벨"),
        (10, "큐텐 수수료율",       0.10,        PCT,      "판매수수료 + 결제수수료"),
        (11, "기타비용 (원)",       0,           KRW,      "광고·부자재 등"),
        (12, "목표 마진율",         0.20,        PCT,      "역산에 사용"),
    ]
    for r, label, val, fmt, hint in inputs:
        put(ws, f"A{r}", label, font=F_BODY, fill=FILL_CALC, align=LEFT)
        ws.merge_cells(f"A{r}:B{r}")
        ws[f"B{r}"].border = BOX
        put(ws, f"C{r}", val, fill=FILL_INPUT, fmt=fmt,
            align=LEFT if fmt is None else RIGHT)
        if hint:
            put(ws, f"D{r}", hint, font=F_NOTE, align=LEFT, border=False)

    # ── 결과 ───────────────────────────────────────────────
    put(ws, "A15", "결과", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells("A15:C15")

    results = [
        (16, "판매가격 (원)",   "=C6*C5",                     KRW),
        (17, "큐텐 수수료 (원)", "=C16*C10",                   KRW),
        (18, "총비용 (원)",      "=C7+C8+C9+C17+C11",          KRW),
        (19, "순이익 (원)",      "=C16-C18",                   KRW),
        (20, "마진율",           '=IF(C16=0,"",C19/C16)',      PCT),
        (21, "ROI",              '=IF((C7+C8+C9+C11)=0,"",C19/(C7+C8+C9+C11))', PCT),
        (22, "순이익 (엔)",      '=IF(C5=0,"",C19/C5)',        "#,##0"),
    ]
    for r, label, formula, fmt in results:
        put(ws, f"A{r}", label, font=F_LABEL, fill=FILL_CALC, align=LEFT)
        ws.merge_cells(f"A{r}:B{r}")
        ws[f"B{r}"].border = BOX
        put(ws, f"C{r}", formula, font=F_LABEL, fill=FILL_CALC, fmt=fmt,
            align=RIGHT)

    put(ws, "D19",
        "순이익 = 판매가격 − 상품원가 − 국제배송비 − 포장비 − 큐텐수수료 − 기타비용",
        font=F_NOTE, align=LEFT, border=False)

    # ── 가격 역산 ──────────────────────────────────────────
    put(ws, "A24", "판매가 역산", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    ws.merge_cells("A24:C24")

    backcalc = [
        (25, "손익분기 판매가 (엔)",
         '=IFERROR((C7+C8+C9+C11)/(1-C10)/C5,"")', "#,##0"),
        (26, "목표마진 달성 판매가 (엔)",
         '=IFERROR((C7+C8+C9+C11)/(1-C10-C12)/C5,"")', "#,##0"),
        (27, "손익분기 환율 (1엔=?원)",
         '=IFERROR((C7+C8+C9+C11)/(1-C10)/C6,"")', "#,##0.00"),
    ]
    for r, label, formula, fmt in backcalc:
        put(ws, f"A{r}", label, font=F_BODY, fill=FILL_CALC, align=LEFT)
        ws.merge_cells(f"A{r}:B{r}")
        ws[f"B{r}"].border = BOX
        put(ws, f"C{r}", formula, fill=FILL_CALC, fmt=fmt, align=RIGHT)

    put(ws, "D27",
        "환율이 이 값 아래로 떨어지면 지금 판매가로는 적자입니다.",
        font=F_NOTE, align=LEFT, border=False)

    ws.conditional_formatting.add(
        "C19:C20",
        CellIsRule(operator="lessThan", formula=["0"],
                   font=Font(name="맑은 고딕", size=10, bold=True, color=NEG)))
    ws.conditional_formatting.add(
        "C20",
        CellIsRule(operator="greaterThanOrEqual", formula=["0.15"],
                   font=Font(name="맑은 고딕", size=10, bold=True, color=POS)))

    widths(ws, {"A": 18, "B": 10, "C": 16, "D": 46, "E": 14, "F": 14})
    ws.sheet_view.showGridLines = False

    # ── 시트 2: 다중 상품 ──────────────────────────────────
    ws2 = wb.create_sheet("여러 상품 한번에")
    put(ws2, "A1", "큐텐 재팬 — 상품별 마진 일괄 계산", font=F_TITLE,
        border=False)
    ws2.merge_cells("A1:E1")
    ws2.row_dimensions[1].height = 26

    put(ws2, "A3", "환율 (1엔 = ? 원)", font=F_BODY, fill=FILL_CALC, align=LEFT)
    ws2.merge_cells("A3:B3")
    ws2["B3"].border = BOX
    put(ws2, "C3", 9.30, fill=FILL_INPUT, fmt="#,##0.00", align=RIGHT)
    put(ws2, "D3", "아래 표 전체에 적용됩니다", font=F_NOTE, align=LEFT,
        border=False)

    headers2 = [
        ("A", "상품명"),
        ("B", "판매가격\n(엔)"),
        ("C", "상품원가\n(원)"),
        ("D", "국제배송비\n(원)"),
        ("E", "포장비\n(원)"),
        ("F", "큐텐\n수수료율"),
        ("G", "기타비용\n(원)"),
        ("H", "판매가격\n(원)"),
        ("I", "큐텐수수료\n(원)"),
        ("J", "총비용\n(원)"),
        ("K", "순이익\n(원)"),
        ("L", "마진율"),
        ("M", "ROI"),
    ]
    HR = 5
    for col, text in headers2:
        put(ws2, f"{col}{HR}", text, font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    ws2.row_dimensions[HR].height = 34

    samples = [
        ("샘플 상품 A", 3980, 12000, 6000, 800, 0.10, 0),
        ("샘플 상품 B", 2480, 7000, 4500, 500, 0.10, 0),
    ]
    ROWS = 30
    for i in range(ROWS):
        r = HR + 1 + i
        s = samples[i] if i < len(samples) else None
        put(ws2, f"A{r}", s[0] if s else None, fill=FILL_INPUT, align=LEFT)
        put(ws2, f"B{r}", s[1] if s else None, fill=FILL_INPUT, fmt="#,##0",
            align=RIGHT)
        put(ws2, f"C{r}", s[2] if s else None, fill=FILL_INPUT, fmt=KRW,
            align=RIGHT)
        put(ws2, f"D{r}", s[3] if s else None, fill=FILL_INPUT, fmt=KRW,
            align=RIGHT)
        put(ws2, f"E{r}", s[4] if s else None, fill=FILL_INPUT, fmt=KRW,
            align=RIGHT)
        put(ws2, f"F{r}", s[5] if s else 0.10, fill=FILL_INPUT, fmt=PCT,
            align=RIGHT)
        put(ws2, f"G{r}", s[6] if s else 0, fill=FILL_INPUT, fmt=KRW,
            align=RIGHT)

        put(ws2, f"H{r}", f'=IF(B{r}="","",B{r}*$C$3)', fill=FILL_CALC,
            fmt=KRW, align=RIGHT)
        put(ws2, f"I{r}", f'=IF(B{r}="","",H{r}*F{r})', fill=FILL_CALC,
            fmt=KRW, align=RIGHT)
        put(ws2, f"J{r}", f'=IF(B{r}="","",C{r}+D{r}+E{r}+I{r}+G{r})',
            fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws2, f"K{r}", f'=IF(B{r}="","",H{r}-J{r})', fill=FILL_CALC,
            fmt=KRW, align=RIGHT)
        put(ws2, f"L{r}", f'=IF(OR(B{r}="",H{r}=0),"",K{r}/H{r})',
            fill=FILL_CALC, fmt=PCT, align=RIGHT)
        put(ws2, f"M{r}",
            f'=IF(OR(B{r}="",(C{r}+D{r}+E{r}+G{r})=0),"",'
            f"K{r}/(C{r}+D{r}+E{r}+G{r}))",
            fill=FILL_CALC, fmt=PCT, align=RIGHT)

    tot = HR + ROWS + 1
    put(ws, "A1", ws["A1"].value, font=F_TITLE, border=False)  # no-op 유지
    put(ws2, f"A{tot}", "합계", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    for col in ("H", "I", "J", "K"):
        put(ws2, f"{col}{tot}", f"=SUM({col}{HR+1}:{col}{tot-1})",
            font=F_LABEL, fill=FILL_CALC, fmt=KRW, align=RIGHT)
    put(ws2, f"L{tot}", f'=IF(H{tot}=0,"",K{tot}/H{tot})', font=F_LABEL,
        fill=FILL_CALC, fmt=PCT, align=RIGHT)

    ws2.conditional_formatting.add(
        f"K{HR+1}:L{tot}",
        CellIsRule(operator="lessThan", formula=["0"],
                   font=Font(name="맑은 고딕", size=10, bold=True, color=NEG)))
    ws2.conditional_formatting.add(
        f"L{HR+1}:L{tot-1}",
        CellIsRule(operator="greaterThanOrEqual", formula=["0.15"],
                   font=Font(name="맑은 고딕", size=10, bold=True, color=POS)))

    widths(ws2, {"A": 20, "B": 11, "C": 12, "D": 12, "E": 11, "F": 10,
                 "G": 11, "H": 14, "I": 13, "J": 13, "K": 14, "L": 9, "M": 9})
    ws2.freeze_panes = f"B{HR+1}"
    ws2.sheet_view.showGridLines = False

    build_guide_sheet(
        wb,
        title="큐텐 재팬 마진 계산기 — 사용법",
        rows=[
            ("계산식 (기본)",
             "순이익 = 판매가격 − 상품원가 − 국제배송비 − 포장비 − 큐텐수수료 "
             "− 기타비용"),
            ("① 환율 (C5)",
             "1엔당 원화입니다. 100엔 = 930원이면 9.30 을 넣습니다. "
             "'여러 상품 한번에' 시트는 C3에 따로 넣습니다."),
            ("② 판매가격 (C6)",
             "큐텐에 등록한 엔화 판매가입니다. 원화 환산은 자동입니다."),
            ("③ 큐텐 수수료율 (C10)",
             "판매수수료와 결제수수료를 합한 값입니다. 기본값 10%는 예시이며 "
             "카테고리에 따라 다르므로 큐텐 셀러오피스의 실제 요율로 바꿔 쓰세요."),
            ("④ 기타비용 (C11)",
             "광고비, 쿠폰 부담금, 부자재, 반품 손실 등 위 항목에 없는 비용을 "
             "여기에 합산합니다."),
            ("결과 — 마진율", "순이익 ÷ 판매가격(원). 0 미만은 빨강, 15% 이상은 초록."),
            ("결과 — ROI",
             "순이익 ÷ 투입원가(상품원가+국제배송비+포장비+기타비용). "
             "자금 회전율을 볼 때 씁니다."),
            ("판매가 역산 — 손익분기가",
             "순이익이 정확히 0이 되는 엔화 판매가입니다. 이 값보다 낮게 팔면 적자입니다."),
            ("판매가 역산 — 목표마진 달성가",
             "C12에 넣은 목표 마진율을 맞추려면 얼마에 팔아야 하는지 알려줍니다."),
            ("판매가 역산 — 손익분기 환율",
             "지금 판매가를 유지할 때 버틸 수 있는 최저 환율입니다. "
             "엔저가 진행되면 이 값을 먼저 확인하세요."),
            ("여러 상품 한번에",
             "두 번째 시트에 상품을 최대 30개까지 넣고 한눈에 비교할 수 있습니다. "
             "맨 아래에 합계와 전체 마진율이 나옵니다."),
            ("부가세",
             "한국 수출은 영세율(0%)이라 매출 부가세를 계산에 넣지 않았습니다. "
             "매입 부가세 환급을 반영하려면 상품원가를 공급가액(부가세 제외)으로 "
             "넣으세요."),
            ("환율 확인",
             "실시간 환율은 https://margin.ur-team.com 사이드바에서 볼 수 있습니다."),
        ])
    return wb


# ══════════════════════════════════════════════════════════════════

def build_guide_sheet(wb, title, rows):
    ws = wb.create_sheet("사용법 · 계산식")
    put(ws, "A1", title, font=F_TITLE, border=False)
    ws.merge_cells("A1:B1")
    ws.row_dimensions[1].height = 28

    put(ws, "A3", "항목", font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    put(ws, "B3", "설명", font=F_HEAD, fill=FILL_HEAD, align=CENTER)

    r = 4
    for label, desc in rows:
        put(ws, f"A{r}", label, font=F_LABEL, fill=FILL_CALC, align=LEFT)
        put(ws, f"B{r}", desc, font=F_BODY,
            align=Alignment(horizontal="left", vertical="top", wrap_text=True))
        ws.row_dimensions[r].height = 30 if len(desc) < 46 else 46
        r += 1

    put(ws, f"A{r+1}",
        "※ 이 파일의 계산 결과는 참고용 추정치입니다. 수수료율·환율·관세는 "
        "실제 정산 시점의 값과 다를 수 있습니다.",
        font=F_NOTE, align=LEFT, border=False)
    put(ws, f"A{r+2}",
        "만든 곳 · 유어팀 글로벌 마진 계산기 https://margin.ur-team.com",
        font=F_NOTE, align=LEFT, border=False)

    widths(ws, {"A": 26, "B": 78})
    ws.sheet_view.showGridLines = False
    return ws


def main():
    os.makedirs(OUT, exist_ok=True)
    targets = [
        (build_shopee(), "shopee-margin-calculator.xlsx"),
        (build_qoo10(), "qoo10-japan-margin-calculator.xlsx"),
    ]
    for wb, name in targets:
        path = os.path.join(OUT, name)
        wb.save(path)
        print(f"  {name}  ({os.path.getsize(path):,} bytes)")


if __name__ == "__main__":
    main()
