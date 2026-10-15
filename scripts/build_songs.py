"""把 Excel 歌單轉成網頁使用的 site/data/songs.json。

用法：python scripts/build_songs.py [Excel 檔路徑]

資料來源：
- 「資料庫」工作表中的「所有歌曲」表格：歌曲名稱 / 歌曲語言 / 歌曲類別
- 「歌回紀錄」工作表（可選）：日期 / 歌曲名稱，每唱一首一列，
  用來統計每首歌唱過幾次與上次唱的日期
"""

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "杏仁ミル_歌回歌單.xlsx"
OUTPUT = ROOT / "site" / "data" / "songs.json"

DB_SHEET = "資料庫"
DB_TABLE = "所有歌曲"
HISTORY_SHEET = "歌回紀錄"
UNKNOWN = "未分類"

_INVISIBLE = re.compile("[​‌‍﻿]")
_DATE_TEXT = re.compile(r"^(\d{4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})日?$")


def clean(value):
    """去掉不可見字元與多餘空白，空值回傳空字串。"""
    if value is None:
        return ""
    text = _INVISIBLE.sub("", str(value)).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def match_key(name):
    """比對歌名用的鍵：忽略空白與大小寫，讓「王心凌-  月光」對得上「王心凌- 月光」。"""
    return re.sub(r"\s+", "", clean(name)).lower()


def parse_date(value):
    """接受 Excel 日期或「2026/10/12」「2026-10-12」「2026年10月12日」，無法辨識回傳 None。"""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    match = _DATE_TEXT.match(clean(value))
    if not match:
        return None
    try:
        return date(*(int(part) for part in match.groups()))
    except ValueError:
        return None


def read_db_rows(wb):
    ws = wb[DB_SHEET]
    table = ws.tables.get(DB_TABLE)
    ref = table.ref if table else ws.dimensions
    rows = ws[ref]
    return [[cell.value for cell in row[:3]] for row in rows[1:]]


def read_history_rows(wb):
    if HISTORY_SHEET not in wb.sheetnames:
        return []
    ws = wb[HISTORY_SHEET]
    return [list(row) for row in ws.iter_rows(min_row=2, max_col=2, values_only=True)]


def build_songs(db_rows, history_rows=()):
    """回傳 (songs, warnings)。warnings 列出歌回紀錄中無法使用的列。"""
    songs = []
    by_key = {}
    seen = set()
    for row in db_rows:
        name, language, category = (clean(v) for v in (list(row) + [None] * 3)[:3])
        if not name:
            continue
        key = (match_key(name), language, category)
        if key in seen:
            continue
        seen.add(key)
        song = {
            "name": name,
            "language": language or UNKNOWN,
            "category": category or UNKNOWN,
            "count": 0,
            "lastSung": None,
        }
        songs.append(song)
        by_key.setdefault(match_key(name), []).append(song)

    warnings = []
    for row_number, row in enumerate(history_rows, start=2):
        raw_date, raw_name = (list(row) + [None, None])[:2]
        if raw_date is None and not clean(raw_name):
            continue
        sung_on = parse_date(raw_date)
        if sung_on is None:
            warnings.append(f"{HISTORY_SHEET} 第 {row_number} 列：看不懂日期「{clean(raw_date)}」")
            continue
        matches = by_key.get(match_key(raw_name))
        if not matches:
            warnings.append(f"{HISTORY_SHEET} 第 {row_number} 列：資料庫裡找不到「{clean(raw_name)}」")
            continue
        for song in matches:
            song["count"] += 1
            day = sung_on.isoformat()
            if song["lastSung"] is None or day > song["lastSung"]:
                song["lastSung"] = day
    return songs, warnings


def main(argv):
    xlsx = Path(argv[1]) if len(argv) > 1 else DEFAULT_XLSX
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    if HISTORY_SHEET not in wb.sheetnames:
        print(f"提醒：找不到「{HISTORY_SHEET}」工作表，所有歌曲的演唱次數都會是 0")
    songs, warnings = build_songs(read_db_rows(wb), read_history_rows(wb))
    for warning in warnings:
        print("警告：" + warning)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(songs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    sung = sum(1 for s in songs if s["count"])
    print(f"已輸出 {len(songs)} 首歌（{sung} 首有演唱紀錄）到 {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv)
