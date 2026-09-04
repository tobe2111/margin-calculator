#!/usr/bin/env python3
"""
다운로드용 통합 엑셀 마진 계산기 생성기.

  downloads/margin-calculator.xlsx

쇼피 8개국 비교와 큐텐 재팬 계산을 한 파일에 담는다. 두 계산기를 시트만
나란히 붙인 게 아니라, 상품원가·배송비·환율 같은 공통값을 '설정' 시트
한 곳에 두고 나머지 시트가 그걸 참조하게 했다. 원가가 바뀌면 설정에서
한 번만 고치면 쇼피 8개국과 큐텐이 동시에 다시 계산된다.

  $ python3 scripts/build_xlsx.py

칸 색이 곧 사용법이다.
  노랑 — 직접 입력
  파랑 — 설정 시트에서 가져온 값 (덮어써도 된다)
  회색 — 자동 계산 (건드리지 말 것)

수수료율과 환율은 '기본값'이다. 플랫폼 정책·카테고리·프로모션에 따라
실제 요율이 다르므로 시트 안에서 직접 수정하도록 입력칸으로 열어 둔다.
"""

import os

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "downloads")
FILENAME = "margin-calculator.xlsx"

# ── 디자인 토큰 (웹사이트와 같은 색을 쓴다) ──────────────────────────
INK = "14161A"
INPUT_BG = "FFF8E1"   # 노랑 — 직접 입력
LINK_BG = "E8F1FE"    # 파랑 — 설정에서 가져옴
CALC_BG = "F4F5F7"    # 회색 — 자동 계산
HEAD_BG = "1B58BF"
POS = "0B7A5C"
NEG = "C42A44"

THIN = Side(style="thin", color="D0D5DD")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

FONT = "맑은 고딕"
F_TITLE = Font(name=FONT, size=15, bold=True, color=INK)
F_SUB = Font(name=FONT, size=11, bold=True, color=INK)
F_HEAD = Font(name=FONT, size=10, bold=True, color="FFFFFF")
F_LABEL = Font(name=FONT, size=10, bold=True, color=INK)
F_BODY = Font(name=FONT, size=10, color=INK)
F_NOTE = Font(name=FONT, size=9, color="5C636E")
F_BIG = Font(name=FONT, size=13, bold=True, color=INK)

FILL_HEAD = PatternFill("solid", fgColor=HEAD_BG)
FILL_INPUT = PatternFill("solid", fgColor=INPUT_BG)
FILL_LINK = PatternFill("solid", fgColor=LINK_BG)
FILL_CALC = PatternFill("solid", fgColor=CALC_BG)

KRW = '#,##0"원"'
NUM2 = "#,##0.00"
INT = "#,##0"
PCT = "0.0%"

CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")
TOPLEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)

# 시트 이름 — 수식에서 참조할 때는 항상 따옴표로 감싼다
S_CFG = "설정"
S_SHOPEE = "쇼피 국가별"
S_QOO = "큐텐 재팬"
S_BATCH = "상품 일괄계산"
S_SUM = "요약"
S_HELP = "사용법"

CFG = f"'{S_CFG}'"
SHOPEE = f"'{S_SHOPEE}'"
QOO = f"'{S_QOO}'"

# 설정 시트의 고정 위치 (다른 시트가 참조한다)
C_COST = f"{CFG}!$C$5"      # 상품원가
C_DOM = f"{CFG}!$C$6"       # 국내배송비
C_PACK = f"{CFG}!$C$7"      # 포장비
C_AD = f"{CFG}!$C$8"        # 개당 광고비
C_RET = f"{CFG}!$C$9"       # 반품률
C_TARGET = f"{CFG}!$C$10"   # 목표 마진율
FX_TABLE = f"{CFG}!$A$15:$B$24"
FX_LIST = f"{CFG}!$A$15:$A$24"
C_JPY = f"{CFG}!$B$23"      # 엔 환율

# (통화, 1통화당 원화 기본값, 표시서식, 메모)
CURRENCIES = [
    ("SGD", 1070,  NUM2, "싱가포르 달러"),
    ("MYR", 330,   NUM2, "말레이시아 링깃"),
    ("THB", 42,    NUM2, "태국 바트"),
    ("PHP", 24,    NUM2, "필리핀 페소"),
    ("VND", 0.055, "#,##0.00000", "베트남 동"),
    ("TWD", 44,    NUM2, "대만 달러"),
    ("BRL", 250,   NUM2, "브라질 헤알"),
    ("MXN", 72,    NUM2, "멕시코 페소"),
    ("JPY", 9.30,  NUM2, "일본 엔 — 큐텐 재팬이 참조"),
    ("USD", 1380,  NUM2, "미국 달러"),
]

# (국가, 통화, 판매수수료, 결제수수료, 현지통화 판매가 기본값, 판매가 표시서식)
#  판매가는 전부 약 33,000원 수준으로 맞춰 국가 간 비교가 되게 한다.
SHOPEE_MARKETS = [
    ("싱가포르",   "SGD", 0.06, 0.020, 31,     NUM2),
    ("말레이시아", "MYR", 0.08, 0.020, 100,    NUM2),
    ("태국",       "THB", 0.09, 0.030, 790,    NUM2),
    ("필리핀",     "PHP", 0.08, 0.020, 1380,   NUM2),
    ("베트남",     "VND", 0.10, 0.025, 600000, INT),
    ("대만",       "TWD", 0.08, 0.020, 750,    NUM2),
    ("브라질",     "BRL", 0.20, 0.020, 132,    NUM2),
    ("멕시코",     "MXN", 0.16, 0.020, 460,    NUM2),
]


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


def label_row(ws, row, text, *, span_to="B"):
    """A열에 라벨을 쓰고 B열까지 병합한다 (값은 C열에 온다)."""
    put(ws, f"A{row}", text, font=F_BODY, fill=FILL_CALC, align=LEFT)
    ws.merge_cells(f"A{row}:{span_to}{row}")
    ws[f"{span_to}{row}"].border = BOX


def section(ws, coord, text, span):
    put(ws, coord, text, font=F_SUB, fill=FILL_CALC, align=LEFT)
    ws.merge_cells(f"{coord}:{span}")


def widths(ws, mapping):
    for col, w in mapping.items():
        ws.column_dimensions[col].width = w


def legend(ws, coord):
    put(ws, coord,
        "노랑 = 직접 입력    ·    파랑 = 설정 시트에서 가져옴(덮어써도 됨)"
        "    ·    회색 = 자동 계산",
        font=F_NOTE, align=LEFT, border=False)


def red_when_negative(ws, rng):
    ws.conditional_formatting.add(
        rng, CellIsRule(operator="lessThan", formula=["0"],
                        font=Font(name=FONT, size=10, bold=True, color=NEG)))


def green_when_good(ws, rng, threshold="0.15"):
    ws.conditional_formatting.add(
        rng, CellIsRule(operator="greaterThanOrEqual", formula=[threshold],
                        font=Font(name=FONT, size=10, bold=True, color=POS)))


# ══════════════════════════════════════════════════════════════════
# 1. 설정 — 공통 비용과 환율. 나머지 시트가 전부 여기를 본다.
# ══════════════════════════════════════════════════════════════════

def build_config(wb):
    ws = wb.active
    ws.title = S_CFG

    put(ws, "A1", "유어팀 마진 계산기 — 설정", font=F_TITLE, border=False)
    ws.merge_cells("A1:D1")
    ws.row_dimensions[1].height = 26
    put(ws, "F1", "여기 값을 바꾸면 쇼피·큐텐·일괄계산 시트가 한꺼번에 다시 계산됩니다.",
        font=F_NOTE, align=LEFT, border=False)

    section(ws, "A3", "공통 비용", "C3")
    common = [
        (4,  "상품명",           "샘플 상품", None, LEFT,  ""),
        (5,  "상품원가 (원)",    12000,  KRW, RIGHT, "매입가. 부가세 환급을 반영하려면 공급가액으로"),
        (6,  "국내배송비 (원)",  3000,   KRW, RIGHT, "국내 집하까지"),
        (7,  "포장비 (원)",      800,    KRW, RIGHT, "박스·완충재·라벨"),
        (8,  "개당 광고비 (원)", 1500,   KRW, RIGHT, "광고비 ÷ 예상 판매수량"),
        (9,  "반품률",           0.03,   PCT, RIGHT, "반품 시 원가·배송비를 회수 못 한다고 봄"),
        (10, "목표 마진율",      0.20,   PCT, RIGHT, "판매가 역산에 사용"),
    ]
    for row, name, val, fmt, align, hint in common:
        label_row(ws, row, name)
        put(ws, f"C{row}", val, fill=FILL_INPUT, fmt=fmt, align=align)
        if hint:
            put(ws, f"D{row}", hint, font=F_NOTE, align=LEFT, border=False)

    section(ws, "A13", "환율 (1통화 = ? 원)", "C13")
    put(ws, "A14", "통화", font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    put(ws, "B14", "원화", font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    put(ws, "C14", "메모", font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    ws.merge_cells("C14:D14")
    ws["D14"].fill = FILL_HEAD
    ws["D14"].border = BOX

    for i, (cur, rate, fmt, memo) in enumerate(CURRENCIES):
        r = 15 + i
        put(ws, f"A{r}", cur, font=F_LABEL, align=CENTER)
        put(ws, f"B{r}", rate, fill=FILL_INPUT, fmt=fmt, align=RIGHT)
        put(ws, f"C{r}", memo, font=F_NOTE, align=LEFT)
        ws.merge_cells(f"C{r}:D{r}")
        ws[f"D{r}"].border = BOX

    put(ws, "F14",
        "환율은 매일 바뀝니다.\n"
        "https://margin.ur-team.com 왼쪽 사이드바에 실시간 환율이 떠 있으니\n"
        "그 값을 여기에 옮겨 적으면 가장 정확합니다.\n\n"
        "쇼피 시트의 환율 칸은 이 표를 자동으로 찾아옵니다.\n"
        "큐텐 시트는 JPY 행을 봅니다.",
        font=F_NOTE, align=TOPLEFT, border=False)
    ws.merge_cells("F14:J22")

    legend(ws, "A26")

    widths(ws, {"A": 16, "B": 12, "C": 14, "D": 34, "E": 2,
                "F": 12, "G": 12, "H": 12, "I": 12, "J": 12})
    ws.sheet_view.showGridLines = False
    return ws


# ══════════════════════════════════════════════════════════════════
# 2. 쇼피 국가별 비교
# ══════════════════════════════════════════════════════════════════

SHOPEE_HEADERS = [
    ("A", "국가"),
    ("B", "통화"),
    ("C", "환율\n(자동)"),
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

SHOPEE_HEAD_ROW = 6
SHOPEE_FIRST = SHOPEE_HEAD_ROW + 1
SHOPEE_LAST = SHOPEE_FIRST + len(SHOPEE_MARKETS) - 1


def build_shopee(wb):
    ws = wb.create_sheet(S_SHOPEE)

    put(ws, "A1", "쇼피(Shopee) 국가별 마진 비교", font=F_TITLE, border=False)
    ws.merge_cells("A1:F1")
    ws.row_dimensions[1].height = 26
    put(ws, "H1",
        "상품원가·국내배송비·포장비·광고비·반품률은 [설정] 시트에서 가져옵니다.",
        font=F_NOTE, align=LEFT, border=False)

    # 설정에서 가져온 공통값을 눈으로 확인할 수 있게 띄워 둔다
    section(ws, "A3", "설정에서 가져온 공통값", "D3")
    linked = [
        ("A4", "상품원가", C_COST, KRW), ("C4", "국내배송비", C_DOM, KRW),
        ("E4", "포장비", C_PACK, KRW), ("G4", "광고비", C_AD, KRW),
        ("I4", "반품률", C_RET, PCT), ("K4", "목표마진", C_TARGET, PCT),
    ]
    for coord, name, ref, fmt in linked:
        col = coord[0]
        nxt = chr(ord(col) + 1)
        put(ws, coord, name, font=F_NOTE, fill=FILL_CALC, align=LEFT)
        put(ws, f"{nxt}4", f"={ref}", font=F_LABEL, fill=FILL_LINK, fmt=fmt, align=RIGHT)

    for col, text in SHOPEE_HEADERS:
        put(ws, f"{col}{SHOPEE_HEAD_ROW}", text, font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    ws.row_dimensions[SHOPEE_HEAD_ROW].height = 34

    for i, (name, cur, sell, pay, price, price_fmt) in enumerate(SHOPEE_MARKETS):
        r = SHOPEE_FIRST + i
        fx_fmt = next(c[2] for c in CURRENCIES if c[0] == cur)

        put(ws, f"A{r}", name, font=F_LABEL, align=LEFT)
        put(ws, f"B{r}", cur, fill=FILL_INPUT, align=CENTER)
        # 환율은 설정 시트의 표에서 통화로 찾아온다
        put(ws, f"C{r}", f"=IFERROR(VLOOKUP(B{r},{FX_TABLE},2,FALSE),0)",
            fill=FILL_LINK, fmt=fx_fmt, align=RIGHT)
        put(ws, f"D{r}", price, fill=FILL_INPUT, fmt=price_fmt, align=RIGHT)
        put(ws, f"E{r}", 6000, fill=FILL_INPUT, fmt=KRW, align=RIGHT)
        put(ws, f"F{r}", sell, fill=FILL_INPUT, fmt=PCT, align=RIGHT)
        put(ws, f"G{r}", pay, fill=FILL_INPUT, fmt=PCT, align=RIGHT)
        put(ws, f"H{r}", 0, fill=FILL_INPUT, fmt=KRW, align=RIGHT)

        # 판매가(원) = 현지 판매가 × 환율
        put(ws, f"I{r}", f"=D{r}*C{r}", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        # 쇼피 수수료 = 판매가(원) × (판매수수료율 + 결제수수료율)
        put(ws, f"J{r}", f"=I{r}*(F{r}+G{r})", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        # 총비용 = 원가+국내배송+포장+광고+국제배송+수수료+기타 + 반품손실
        put(ws, f"K{r}",
            f"={C_COST}+{C_DOM}+{C_PACK}+{C_AD}+E{r}+J{r}+H{r}"
            f"+{C_RET}*({C_COST}+{C_DOM}+{C_PACK}+E{r}+J{r})",
            fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws, f"L{r}", f"=I{r}-K{r}", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws, f"M{r}", f'=IF(I{r}=0,"",L{r}/I{r})', fill=FILL_CALC, fmt=PCT, align=RIGHT)
        put(ws, f"N{r}",
            f'=IF(({C_COST}+{C_DOM}+{C_PACK}+{C_AD}+E{r})=0,"",'
            f"L{r}/({C_COST}+{C_DOM}+{C_PACK}+{C_AD}+E{r}))",
            fill=FILL_CALC, fmt=PCT, align=RIGHT)

        # 손익분기 판매가 — 순이익이 0이 되는 현지통화 가격
        #   P × (1 − 수수료율 × (1+반품률)) = 고정비 + 반품률 × 고정비'
        fixed = (f"({C_COST}+{C_DOM}+{C_PACK}+{C_AD}+E{r}+H{r})"
                 f"+{C_RET}*({C_COST}+{C_DOM}+{C_PACK}+E{r})")
        put(ws, f"O{r}",
            f'=IFERROR({fixed}/(1-(F{r}+G{r})*(1+{C_RET}))/C{r},"")',
            fill=FILL_CALC, fmt=NUM2, align=RIGHT)
        put(ws, f"P{r}",
            f'=IFERROR({fixed}/(1-(F{r}+G{r})*(1+{C_RET})-{C_TARGET})/C{r},"")',
            fill=FILL_CALC, fmt=NUM2, align=RIGHT)

    dv = DataValidation(type="list", formula1=f"={FX_LIST}", allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"B{SHOPEE_FIRST}:B{SHOPEE_LAST}")

    red_when_negative(ws, f"L{SHOPEE_FIRST}:M{SHOPEE_LAST}")
    green_when_good(ws, f"M{SHOPEE_FIRST}:M{SHOPEE_LAST}")

    legend(ws, f"A{SHOPEE_LAST + 2}")
    put(ws, f"A{SHOPEE_LAST + 3}",
        "수수료율은 기본값입니다. 카테고리·프로모션·셀러 등급에 따라 달라지므로 "
        "쇼피 셀러센터의 실제 요율로 바꿔서 쓰세요.",
        font=F_NOTE, align=LEFT, border=False)

    widths(ws, {"A": 13, "B": 8, "C": 11, "D": 13, "E": 12, "F": 10, "G": 10,
                "H": 11, "I": 14, "J": 13, "K": 13, "L": 14, "M": 9, "N": 9,
                "O": 14, "P": 16})
    ws.freeze_panes = f"C{SHOPEE_FIRST}"
    ws.sheet_view.showGridLines = False
    return ws


# ══════════════════════════════════════════════════════════════════
# 3. 큐텐 재팬
# ══════════════════════════════════════════════════════════════════

def build_qoo10(wb):
    ws = wb.create_sheet(S_QOO)

    put(ws, "A1", "큐텐(Qoo10) 재팬 마진 계산", font=F_TITLE, border=False)
    ws.merge_cells("A1:D1")
    ws.row_dimensions[1].height = 26
    put(ws, "F1",
        "순이익 = 판매가격 − 상품원가 − 국제배송비 − 포장비 − 큐텐수수료 − 기타비용",
        font=F_NOTE, align=LEFT, border=False)

    section(ws, "A3", "입력", "C3")
    rows = [
        (4,  "환율 (1엔 = ? 원)", f"={C_JPY}",   NUM2, FILL_LINK,  "설정 시트 JPY 행"),
        (5,  "판매가격 (엔)",     3980,          INT,  FILL_INPUT, "큐텐 등록가"),
        (6,  "상품원가 (원)",     f"={C_COST}",  KRW,  FILL_LINK,  "설정에서 가져옴"),
        (7,  "국제배송비 (원)",   6000,          KRW,  FILL_INPUT, "개당 일본 배송비"),
        (8,  "포장비 (원)",       f"={C_PACK}",  KRW,  FILL_LINK,  "설정에서 가져옴"),
        (9,  "큐텐 수수료율",     0.10,          PCT,  FILL_INPUT, "판매수수료 + 결제수수료"),
        (10, "기타비용 (원)",     0,             KRW,  FILL_INPUT, "광고·쿠폰 부담금 등"),
        (11, "목표 마진율",       f"={C_TARGET}", PCT, FILL_LINK,  "설정에서 가져옴"),
    ]
    for r, name, val, fmt, fill, hint in rows:
        label_row(ws, r, name)
        put(ws, f"C{r}", val, fill=fill, fmt=fmt, align=RIGHT)
        put(ws, f"D{r}", hint, font=F_NOTE, align=LEFT, border=False)

    section(ws, "A14", "결과", "C14")
    results = [
        (15, "판매가격 (원)",   "=C5*C4",                                 KRW),
        (16, "큐텐 수수료 (원)", "=C15*C9",                               KRW),
        (17, "총비용 (원)",      "=C6+C7+C8+C16+C10",                     KRW),
        (18, "순이익 (원)",      "=C15-C17",                              KRW),
        (19, "마진율",           '=IF(C15=0,"",C18/C15)',                 PCT),
        (20, "ROI",              '=IF((C6+C7+C8+C10)=0,"",C18/(C6+C7+C8+C10))', PCT),
        (21, "순이익 (엔)",      '=IF(C4=0,"",C18/C4)',                   INT),
    ]
    for r, name, formula, fmt in results:
        put(ws, f"A{r}", name, font=F_LABEL, fill=FILL_CALC, align=LEFT)
        ws.merge_cells(f"A{r}:B{r}")
        ws[f"B{r}"].border = BOX
        put(ws, f"C{r}", formula, font=F_LABEL, fill=FILL_CALC, fmt=fmt, align=RIGHT)

    section(ws, "A23", "판매가 역산", "C23")
    back = [
        (24, "손익분기 판매가 (엔)",
         '=IFERROR((C6+C7+C8+C10)/(1-C9)/C4,"")', INT,
         "이 값보다 낮게 팔면 적자"),
        (25, "목표마진 달성 판매가 (엔)",
         '=IFERROR((C6+C7+C8+C10)/(1-C9-C11)/C4,"")', INT,
         "설정의 목표 마진율을 맞추는 가격"),
        (26, "손익분기 환율 (1엔=?원)",
         '=IFERROR((C6+C7+C8+C10)/(1-C9)/C5,"")', NUM2,
         "환율이 이 아래로 떨어지면 지금 판매가로는 적자 — 엔저 방어선"),
    ]
    for r, name, formula, fmt, hint in back:
        label_row(ws, r, name)
        put(ws, f"C{r}", formula, fill=FILL_CALC, fmt=fmt, align=RIGHT)
        put(ws, f"D{r}", hint, font=F_NOTE, align=LEFT, border=False)

    red_when_negative(ws, "C18:C19")
    green_when_good(ws, "C19")

    legend(ws, "A28")
    put(ws, "A29",
        "수수료율 10%는 예시입니다. 큐텐 판매수수료는 카테고리마다 다르고 결제수수료가 "
        "따로 붙을 수 있으니 셀러오피스의 실제 요율을 넣어 주세요.",
        font=F_NOTE, align=LEFT, border=False)

    widths(ws, {"A": 20, "B": 10, "C": 16, "D": 44, "E": 2, "F": 14})
    ws.sheet_view.showGridLines = False
    return ws


# ══════════════════════════════════════════════════════════════════
# 4. 상품 일괄계산 — 플랫폼·통화 섞어서 30개까지
# ══════════════════════════════════════════════════════════════════

BATCH_HEADERS = [
    ("A", "상품명"),
    ("B", "플랫폼"),
    ("C", "통화"),
    ("D", "판매가격\n(현지통화)"),
    ("E", "환율\n(자동)"),
    ("F", "상품원가\n(원)"),
    ("G", "국제배송비\n(원)"),
    ("H", "포장비\n(원)"),
    ("I", "수수료율"),
    ("J", "기타비용\n(원)"),
    ("K", "판매가격\n(원)"),
    ("L", "수수료\n(원)"),
    ("M", "총비용\n(원)"),
    ("N", "순이익\n(원)"),
    ("O", "마진율"),
    ("P", "ROI"),
]

BATCH_HEAD = 4
BATCH_ROWS = 30
BATCH_FIRST = BATCH_HEAD + 1
BATCH_LAST = BATCH_HEAD + BATCH_ROWS
BATCH_TOTAL = BATCH_LAST + 1

BATCH_SAMPLES = [
    ("샘플 A — 쇼피 싱가포르", "쇼피",  "SGD", 31,   12000, 6000, 800, 0.08, 0),
    ("샘플 B — 큐텐 재팬",     "큐텐",  "JPY", 3980, 12000, 6000, 800, 0.10, 0),
    ("샘플 C — 쇼피 태국",     "쇼피",  "THB", 790,  7000,  4500, 500, 0.12, 0),
]


def build_batch(wb):
    ws = wb.create_sheet(S_BATCH)

    put(ws, "A1", "상품 일괄계산", font=F_TITLE, border=False)
    ws.merge_cells("A1:D1")
    ws.row_dimensions[1].height = 26
    put(ws, "F1",
        "플랫폼과 통화를 섞어서 한 번에 비교할 수 있습니다. "
        "환율은 통화만 고르면 [설정] 시트에서 자동으로 찾아옵니다.",
        font=F_NOTE, align=LEFT, border=False)

    for col, text in BATCH_HEADERS:
        put(ws, f"{col}{BATCH_HEAD}", text, font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    ws.row_dimensions[BATCH_HEAD].height = 34

    for i in range(BATCH_ROWS):
        r = BATCH_FIRST + i
        s = BATCH_SAMPLES[i] if i < len(BATCH_SAMPLES) else None

        put(ws, f"A{r}", s[0] if s else None, fill=FILL_INPUT, align=LEFT)
        put(ws, f"B{r}", s[1] if s else None, fill=FILL_INPUT, align=CENTER)
        put(ws, f"C{r}", s[2] if s else None, fill=FILL_INPUT, align=CENTER)
        put(ws, f"D{r}", s[3] if s else None, fill=FILL_INPUT, fmt=NUM2, align=RIGHT)
        put(ws, f"E{r}", f'=IF(C{r}="","",IFERROR(VLOOKUP(C{r},{FX_TABLE},2,FALSE),0))',
            fill=FILL_LINK, fmt=NUM2, align=RIGHT)
        put(ws, f"F{r}", s[4] if s else f"={C_COST}", fill=FILL_INPUT, fmt=KRW, align=RIGHT)
        put(ws, f"G{r}", s[5] if s else 6000, fill=FILL_INPUT, fmt=KRW, align=RIGHT)
        put(ws, f"H{r}", s[6] if s else f"={C_PACK}", fill=FILL_INPUT, fmt=KRW, align=RIGHT)
        put(ws, f"I{r}", s[7] if s else 0.10, fill=FILL_INPUT, fmt=PCT, align=RIGHT)
        put(ws, f"J{r}", s[8] if s else 0, fill=FILL_INPUT, fmt=KRW, align=RIGHT)

        blank = f'IF(OR(A{r}="",D{r}=""),"",'
        put(ws, f"K{r}", f"={blank}D{r}*E{r})", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws, f"L{r}", f"={blank}K{r}*I{r})", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws, f"M{r}", f"={blank}F{r}+G{r}+H{r}+L{r}+J{r})",
            fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws, f"N{r}", f"={blank}K{r}-M{r})", fill=FILL_CALC, fmt=KRW, align=RIGHT)
        put(ws, f"O{r}", f'=IF(OR(A{r}="",K{r}=0,K{r}=""),"",N{r}/K{r})',
            fill=FILL_CALC, fmt=PCT, align=RIGHT)
        put(ws, f"P{r}",
            f'=IF(OR(A{r}="",(F{r}+G{r}+H{r}+J{r})=0),"",N{r}/(F{r}+G{r}+H{r}+J{r}))',
            fill=FILL_CALC, fmt=PCT, align=RIGHT)

    put(ws, f"A{BATCH_TOTAL}", "합계", font=F_LABEL, fill=FILL_CALC, align=LEFT)
    for col in ("B", "C", "D", "E", "F", "G", "H", "I", "J"):
        put(ws, f"{col}{BATCH_TOTAL}", None, fill=FILL_CALC)
    for col in ("K", "L", "M", "N"):
        put(ws, f"{col}{BATCH_TOTAL}", f"=SUM({col}{BATCH_FIRST}:{col}{BATCH_LAST})",
            font=F_LABEL, fill=FILL_CALC, fmt=KRW, align=RIGHT)
    put(ws, f"O{BATCH_TOTAL}", f'=IF(K{BATCH_TOTAL}=0,"",N{BATCH_TOTAL}/K{BATCH_TOTAL})',
        font=F_LABEL, fill=FILL_CALC, fmt=PCT, align=RIGHT)
    put(ws, f"P{BATCH_TOTAL}", None, fill=FILL_CALC)

    dv_cur = DataValidation(type="list", formula1=f"={FX_LIST}", allow_blank=True)
    ws.add_data_validation(dv_cur)
    dv_cur.add(f"C{BATCH_FIRST}:C{BATCH_LAST}")

    dv_plat = DataValidation(type="list", formula1='"쇼피,큐텐,라자다,이베이,아마존,틱톡샵,라쿠텐,기타"',
                             allow_blank=True)
    ws.add_data_validation(dv_plat)
    dv_plat.add(f"B{BATCH_FIRST}:B{BATCH_LAST}")

    red_when_negative(ws, f"N{BATCH_FIRST}:O{BATCH_TOTAL}")
    green_when_good(ws, f"O{BATCH_FIRST}:O{BATCH_LAST}")

    legend(ws, f"A{BATCH_TOTAL + 2}")

    widths(ws, {"A": 24, "B": 10, "C": 8, "D": 13, "E": 10, "F": 12, "G": 12,
                "H": 11, "I": 10, "J": 11, "K": 14, "L": 13, "M": 13, "N": 14,
                "O": 9, "P": 9})
    ws.freeze_panes = f"D{BATCH_FIRST}"
    ws.sheet_view.showGridLines = False
    return ws


# ══════════════════════════════════════════════════════════════════
# 5. 요약 — 쇼피와 큐텐을 한 화면에서 비교
# ══════════════════════════════════════════════════════════════════

def build_summary(wb):
    ws = wb.create_sheet(S_SUM)

    put(ws, "A1", "요약", font=F_TITLE, border=False)
    ws.merge_cells("A1:C1")
    ws.row_dimensions[1].height = 26
    put(ws, "E1", "다른 시트의 결과를 모아 보여줍니다. 여기서 고칠 값은 없습니다.",
        font=F_NOTE, align=LEFT, border=False)

    L = f"{SHOPEE}!$L${SHOPEE_FIRST}:$L${SHOPEE_LAST}"
    A = f"{SHOPEE}!$A${SHOPEE_FIRST}:$A${SHOPEE_LAST}"
    M = f"{SHOPEE}!$M${SHOPEE_FIRST}:$M${SHOPEE_LAST}"
    best_idx = f"MATCH(MAX({L}),{L},0)"

    section(ws, "A3", "쇼피 — 8개국 중 최적", "C3")
    shopee_rows = [
        (4, "가장 남는 국가", f'=IFERROR(INDEX({A},{best_idx}),"")', None),
        (5, "순이익", f"=MAX({L})", KRW),
        (6, "마진율", f'=IFERROR(INDEX({M},{best_idx}),"")', PCT),
        (7, "적자 국가 수", f'=COUNTIF({L},"<0")&"개국"', None),
    ]
    for r, name, formula, fmt in shopee_rows:
        label_row(ws, r, name)
        put(ws, f"C{r}", formula, font=F_BIG if r in (4, 5) else F_LABEL,
            fill=FILL_CALC, fmt=fmt, align=RIGHT if fmt else CENTER)

    section(ws, "A9", "큐텐 재팬", "C9")
    qoo_rows = [
        (10, "판매가격 (엔)", f"={QOO}!$C$5", INT),
        (11, "순이익", f"={QOO}!$C$18", KRW),
        (12, "마진율", f"={QOO}!$C$19", PCT),
        (13, "손익분기 환율", f"={QOO}!$C$26", NUM2),
    ]
    for r, name, formula, fmt in qoo_rows:
        label_row(ws, r, name)
        put(ws, f"C{r}", formula, font=F_BIG if r == 11 else F_LABEL,
            fill=FILL_CALC, fmt=fmt, align=RIGHT)

    section(ws, "A15", "어디에 파는 게 나은가", "C15")
    label_row(ws, 16, "더 남는 쪽")
    put(ws, "C16",
        f'=IF(MAX({L})>{QOO}!$C$18,'
        f'"쇼피 "&IFERROR(INDEX({A},{best_idx}),""),"큐텐 재팬")',
        font=F_BIG, fill=FILL_CALC, align=CENTER)
    label_row(ws, 17, "순이익 차이")
    put(ws, "C17", f"=ABS(MAX({L})-{QOO}!$C$18)", font=F_LABEL,
        fill=FILL_CALC, fmt=KRW, align=RIGHT)

    put(ws, "E4",
        "읽는 법\n\n"
        "· 마진율이 0 미만이면 빨강, 15% 이상이면 초록으로 표시됩니다.\n"
        "· '더 남는 쪽'은 개당 순이익만 비교한 결과입니다. 실제 선택은\n"
        "  시장 규모, 경쟁 강도, 정산 주기, 반품률까지 함께 봐야 합니다.\n"
        "· 값을 바꾸려면 [설정]·[쇼피 국가별]·[큐텐 재팬] 시트에서 고치세요.",
        font=F_NOTE, align=TOPLEFT, border=False)
    ws.merge_cells("E4:J13")

    red_when_negative(ws, "C5:C6")
    red_when_negative(ws, "C11:C12")

    widths(ws, {"A": 16, "B": 10, "C": 20, "D": 2,
                "E": 12, "F": 12, "G": 12, "H": 12, "I": 12, "J": 12})
    ws.sheet_view.showGridLines = False
    return ws


# ══════════════════════════════════════════════════════════════════
# 6. 사용법 · 계산식
# ══════════════════════════════════════════════════════════════════

HELP_ROWS = [
    ("시작하기",
     "[설정] 시트에서 상품원가·배송비·포장비·광고비·반품률·목표마진율과 환율을 "
     "먼저 채우세요. 이 값들이 쇼피·큐텐·일괄계산 시트에 모두 적용됩니다."),
    ("칸 색깔",
     "노랑 = 직접 입력 / 파랑 = 설정 시트에서 가져온 값(그 시트만 다르게 하려면 "
     "그냥 덮어쓰면 됩니다) / 회색 = 자동 계산이니 건드리지 마세요."),
    ("[설정] 환율표",
     "통화별 '1통화 = ?원'을 적는 곳입니다. 쇼피 시트의 환율 칸은 통화 코드로 "
     "이 표를 찾아오고, 큐텐 시트는 JPY 행을 봅니다. 환율은 매일 바뀌니 "
     "margin.ur-team.com 사이드바의 실시간 값을 옮겨 적으면 정확합니다."),
    ("[쇼피 국가별]",
     "싱가포르·말레이시아·태국·필리핀·베트남·대만·브라질·멕시코 8개국을 한 표에서 "
     "비교합니다. 국가마다 판매가·국제배송비·수수료율을 따로 넣으세요. "
     "통화 칸은 목록에서 고를 수 있고, 환율은 자동으로 따라옵니다."),
    ("[큐텐 재팬]",
     "엔화 판매가 기준입니다. 손익분기 환율은 지금 판매가로 버틸 수 있는 최저 "
     "환율이라, 엔저가 진행될 때 판매가를 올릴 시점을 잡는 기준이 됩니다."),
    ("[상품 일괄계산]",
     "플랫폼과 통화를 섞어 상품 30개까지 한 번에 계산합니다. 통화만 고르면 환율은 "
     "자동입니다. 맨 아래에 합계와 전체 마진율이 나옵니다. 이 시트는 상품마다 조건이 "
     "다른 경우를 위해 비용을 행별로 직접 받으며, 국내배송비·광고비·반품손실 칸은 "
     "따로 두지 않았으니 '기타비용'에 합산해서 넣으세요. (그래서 같은 상품이라도 "
     "쇼피 시트보다 마진이 높게 나올 수 있습니다)"),
    ("[요약]",
     "쇼피 8개국 중 가장 남는 곳과 큐텐 재팬을 나란히 비교합니다."),
    ("계산식 — 판매가(원)", "현지통화 판매가 × 환율"),
    ("계산식 — 수수료", "판매가(원) × 수수료율 (판매수수료 + 결제수수료)"),
    ("계산식 — 쇼피 총비용",
     "상품원가 + 국내배송비 + 포장비 + 광고비 + 국제배송비 + 수수료 + 기타비용 "
     "+ 반품손실"),
    ("계산식 — 반품손실",
     "반품률 × (상품원가 + 국내배송비 + 포장비 + 국제배송비 + 수수료). "
     "해외 판매는 반품 시 상품을 회수하기 어려워 원가와 이미 나간 비용을 그대로 "
     "잃는 경우가 많아 비용에 더합니다. 회수·재판매가 된다면 반품률을 0으로 두세요."),
    ("계산식 — 큐텐 순이익",
     "판매가격 − 상품원가 − 국제배송비 − 포장비 − 큐텐수수료 − 기타비용"),
    ("계산식 — 마진율", "순이익 ÷ 판매가(원)"),
    ("계산식 — ROI", "순이익 ÷ 투입원가. 자금 회전율을 볼 때 씁니다."),
    ("계산식 — 손익분기가",
     "순이익이 정확히 0이 되는 판매가입니다. 이 값보다 낮게 팔면 적자입니다."),
    ("수수료율 주의",
     "파일에 들어 있는 수수료율은 전부 기본값입니다. 카테고리·프로모션·셀러 등급·"
     "크로스보더 여부에 따라 달라지므로, 각 셀러센터에서 내 계정에 적용되는 요율을 "
     "확인한 뒤 바꿔서 쓰세요."),
    ("부가세",
     "한국에서 해외로 파는 수출은 영세율(0%)이라 매출 부가세를 계산에 넣지 "
     "않았습니다. 매입 부가세 환급을 반영하려면 상품원가를 부가세 뺀 공급가액으로 "
     "넣으세요. 현지 수입관세나 VAT를 셀러가 부담한다면 '기타비용'에 더하면 됩니다."),
    ("열리는 프로그램",
     "엑셀, 구글 스프레드시트, 한셀, 넘버스, LibreOffice Calc 모두에서 수식이 "
     "그대로 동작합니다."),
]


def build_help(wb):
    ws = wb.create_sheet(S_HELP)

    put(ws, "A1", "유어팀 마진 계산기 — 사용법 · 계산식", font=F_TITLE, border=False)
    ws.merge_cells("A1:B1")
    ws.row_dimensions[1].height = 28

    put(ws, "A3", "항목", font=F_HEAD, fill=FILL_HEAD, align=CENTER)
    put(ws, "B3", "설명", font=F_HEAD, fill=FILL_HEAD, align=CENTER)

    r = 4
    for name, desc in HELP_ROWS:
        put(ws, f"A{r}", name, font=F_LABEL, fill=FILL_CALC, align=LEFT)
        put(ws, f"B{r}", desc, font=F_BODY, align=TOPLEFT)
        ws.row_dimensions[r] = ws.row_dimensions[r]
        ws.row_dimensions[r].height = 30 if len(desc) < 46 else (46 if len(desc) < 100 else 62)
        r += 1

    put(ws, f"A{r + 1}",
        "※ 이 파일의 계산 결과는 참고용 추정치입니다. 수수료율·환율·관세는 "
        "실제 정산 시점의 값과 다를 수 있습니다.",
        font=F_NOTE, align=LEFT, border=False)
    put(ws, f"A{r + 2}",
        "만든 곳 · 유어팀 글로벌 마진 계산기  https://margin.ur-team.com",
        font=F_NOTE, align=LEFT, border=False)

    widths(ws, {"A": 24, "B": 88})
    ws.sheet_view.showGridLines = False
    return ws


# ══════════════════════════════════════════════════════════════════

def main():
    os.makedirs(OUT, exist_ok=True)
    wb = Workbook()
    build_config(wb)
    build_shopee(wb)
    build_qoo10(wb)
    build_batch(wb)
    build_summary(wb)
    build_help(wb)
    wb.active = 0  # 설정 시트부터 보이게

    path = os.path.join(OUT, FILENAME)
    wb.save(path)
    print(f"  {FILENAME}  ({os.path.getsize(path):,} bytes)  시트 {len(wb.sheetnames)}개")
    for name in wb.sheetnames:
        print(f"    · {name}")


if __name__ == "__main__":
    main()
