"""Google Sheets — 為每位成員新增報帳分頁。

流程:
  1. 開啟該成員的試算表
  2. 複製「空白表單」分頁 → 新分頁 (命名: 月日+客戶名, 例: 42彩賢禮)
  3. 在新分頁填入本次出差資料
  4. 回傳試算表連結供前端展示
"""
from __future__ import annotations

import os
import re
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

from config import config

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
TEMPLATE_TAB = "空白表單"


# ── 工具函式 ────────────────────────────────────────────────

def _client() -> gspread.Client:
    path = config.GOOGLE_SERVICE_ACCOUNT_FILE
    if not os.path.exists(path):
        raise RuntimeError(
            f"找不到服務帳號 JSON：{path}\n"
            "請到 Google Cloud Console 建立 Service Account 並下載金鑰。"
        )
    creds = Credentials.from_service_account_file(path, scopes=SCOPES)
    return gspread.authorize(creds)


def _tab_name(reason: str, date_str: str) -> str:
    """格式: MMDD + 事由, 例: 0402拍攝彩賢禮"""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        prefix = f"{d.month:02d}{d.day:02d}"
    except Exception:
        prefix = ""
    return f"{prefix}{reason.strip()}"[:31]


def _unique_tab(sh: gspread.Spreadsheet, name: str) -> str:
    """同名分頁已存在時自動加後綴 _2 _3 …"""
    existing = {ws.title for ws in sh.worksheets()}
    if name not in existing:
        return name
    for i in range(2, 99):
        candidate = f"{name}_{i}"
        if candidate not in existing:
            return candidate
    return f"{name}_{datetime.now().strftime('%H%M%S')}"


def _tw_date(date_str: str) -> str:
    """YYYY-MM-DD → YYYY/M/D（配合原本試算表格式）"""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{d.year}/{d.month}/{d.day}"
    except Exception:
        return date_str


# ── 主函式 ──────────────────────────────────────────────────

def append_expense(payload: dict) -> dict:
    """複製空白表單 → 填入資料 → 回傳結果。

    payload 必填: name, title, reason, date, date_from, date_to,
                  transport_mode, people, meal_total, rows
    """
    name = payload.get("name", "").strip()
    if not name:
        raise ValueError("缺少出差人姓名")

    sheet_id = config.MEMBER_SHEETS.get(name)
    if not sheet_id or sheet_id.startswith("試算表ID"):
        raise RuntimeError(
            f"找不到「{name}」的 Google Sheet ID。\n"
            "請在 .env 的 MEMBER_SHEETS 設定對應的 spreadsheet_id，\n"
            "並確認試算表已分享給 Service Account（Editor 權限）。"
        )

    gc  = _client()
    sh  = gc.open_by_key(sheet_id)

    # 確認空白表單存在
    try:
        template_ws = sh.worksheet(TEMPLATE_TAB)
    except gspread.WorksheetNotFound:
        raise RuntimeError(
            f"在「{name}」的試算表中找不到「{TEMPLATE_TAB}」分頁。\n"
            "請將出差旅費報告表原始檔的「空白表單」分頁複製進去。"
        )

    # 產生唯一分頁名稱
    date_str = payload.get("date") or payload.get("date_from", "")
    raw_name = _tab_name(payload.get("reason", ""), date_str)
    tab_name = _unique_tab(sh, raw_name)

    # 複製空白表單（保留所有格式、合併儲存格、Logo）
    sh.batch_update({
        "requests": [{
            "duplicateSheet": {
                "sourceSheetId": template_ws.id,
                "insertSheetIndex": 0,   # 最新的放最前面
                "newSheetName": tab_name,
            }
        }]
    })

    new_ws = sh.worksheet(tab_name)
    _fill(new_ws, payload, date_str)

    submitted_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}"

    return {
        "submitted_at": submitted_at,
        "tab_name":     tab_name,
        "sheet_url":    sheet_url,
    }


def _detect_layout(ws: gspread.Worksheet) -> dict:
    """掃描模板找出「人數列」位置，動態決定資料列範圍。

    找法：J 欄含「人(膳雜費)」字樣的那一列就是人數列；
    資料列範圍 = R9 到 R{people_row - 1}。

    支援多種模板版本（舊版人數在 I15、新版在 I18 等）。
    找不到則 fallback 到舊版預設（I15 / R9-R14）。
    """
    try:
        # 抓 J1:J30 整欄文字找標記
        col_j = ws.col_values(10)  # J 欄 = 第 10 欄
        for i, val in enumerate(col_j, start=1):
            if val and "人(膳雜費)" in str(val):
                return {
                    "people_row": i,
                    "data_row_start": 9,
                    "data_row_end": i - 1,
                }
    except Exception:
        pass
    # fallback：舊版排版
    return {"people_row": 15, "data_row_start": 9, "data_row_end": 14}


def _adjust_column_widths(ws: gspread.Worksheet) -> None:
    """為新建的報帳分頁固定欄寬：起訖地點(C)=252px、摘要(I)=155px。"""
    ws.spreadsheet.batch_update({
        "requests": [
            {"updateDimensionProperties": {
                "range": {
                    "sheetId": ws.id,
                    "dimension": "COLUMNS",
                    "startIndex": 2,   # C 欄（起訖地點）
                    "endIndex":   3,
                },
                "properties": {"pixelSize": 252},
                "fields": "pixelSize",
            }},
            {"updateDimensionProperties": {
                "range": {
                    "sheetId": ws.id,
                    "dimension": "COLUMNS",
                    "startIndex": 8,   # I 欄（摘要左半）
                    "endIndex":   9,
                },
                "properties": {"pixelSize": 155},
                "fields": "pixelSize",
            }},
        ]
    })


def _ensure_capacity(ws: gspread.Worksheet, needed_rows: int, layout: dict) -> dict:
    """資料列不夠時，在現有資料範圍尾端插入新列，並回傳更新後的 layout。

    插入位置選在「最後一列資料前」(1-indexed = data_row_end)，
    這樣插入屬於 SUM 範圍內，公式會自動延伸 → 合計依然正確。
    合併儲存格 (H 欄膳雜費) 也會自動跟著延伸。
    人數列 / 小計列 / I7 合計欄全部往下推 N 列。
    """
    available = layout["data_row_end"] - layout["data_row_start"] + 1
    if needed_rows <= available:
        return layout
    extra = needed_rows - available

    # insertDimension: startIndex 是 0-indexed，inclusive；endIndex 是 exclusive
    # 在 1-indexed data_row_end 那一列**之前**插入 extra 列 → 確保插入點落在現有 SUM 範圍中
    insert_at = layout["data_row_end"] - 1  # 0-indexed → 等於 1-indexed data_row_end 之前

    ws.spreadsheet.batch_update({
        "requests": [{
            "insertDimension": {
                "range": {
                    "sheetId": ws.id,
                    "dimension": "ROWS",
                    "startIndex": insert_at,
                    "endIndex":   insert_at + extra,
                },
                "inheritFromBefore": True,   # 沿用上一列的格式 / 邊框
            }
        }]
    })

    return {
        "people_row":     layout["people_row"]     + extra,
        "data_row_start": layout["data_row_start"],
        "data_row_end":   layout["data_row_end"]   + extra,
    }


def _fill(ws: gspread.Worksheet, payload: dict, date_str: str):
    """批次填入所有欄位（減少 API 呼叫次數）。

    重要：交通費合計 / 總計都不在這裡寫——讓試算表自身的 SUM 公式處理。
    這樣不論模板是舊版 R16 還是新版 R19，都能正確顯示，避免重複加總。

    若實際路段數量超過模板預設列數，會先呼叫 insertDimension 自動加列。
    """
    rows = payload.get("rows", [])

    # 1) 調整欄寬：起訖地點拓寬、摘要縮窄
    _adjust_column_widths(ws)
    # 2) 偵測模板排版
    layout = _detect_layout(ws)
    # 3) 路段數量超過預設容量 → 先插列，layout 會跟著更新
    layout = _ensure_capacity(ws, len(rows), layout)

    people_row     = layout["people_row"]
    data_row_start = layout["data_row_start"]
    data_row_end   = layout["data_row_end"]
    max_data_rows  = data_row_end - data_row_start + 1

    date_tw    = _tw_date(date_str)
    date_to_tw = _tw_date(payload.get("date_to") or date_str)

    # ── 標頭 ──
    updates = [
        ("C4", payload.get("name",   "")),
        ("E4", "嶼嶼行銷"),
        ("I4", payload.get("title",  "")),
        ("C5", payload.get("reason", "")),
        ("C6", date_tw),
        ("G6", date_to_tw),
    ]

    # ── 明細列 ──
    # 注意：不寫 H 欄（膳雜費）——模板已有公式 =(G6-C6+1)*700*I{people_row}
    #      不寫小計列——讓試算表的 SUM 公式自己算，避免雙重計算
    for idx in range(max_data_rows):
        r = data_row_start + idx
        if idx < len(rows):
            rd    = rows[idx]
            t_amt = float(rd.get("transport_amt") or 0)

            transport = rd.get("transport", "")
            # 停車費 / ETag 屬於開車衍生費用，工具欄一律標示為「自行開車」
            DRIVE_EXPENSES = {"停車費", "ETag/過路費"}
            display_transport = "自行開車" if transport in DRIVE_EXPENSES else transport
            updates += [
                (f"A{r}", _tw_date(rd.get("date") or date_str)),
                (f"C{r}", (rd.get("route") or "").replace("\n", " ")),
            ]
            if display_transport:
                updates.append((f"D{r}", display_transport))
            if t_amt:  updates.append((f"E{r}", t_amt))
            note = rd.get("note", "")
            if note:   updates.append((f"I{r}", note))

    # ── 人數 ──
    # 寫入人數後，模板裡 H{data_row_start} 的膳雜費公式 =(G6-C6+1)*700*I{people_row}
    # 與 E{people_row+1} 的 SUM 公式會自動算出正確總額
    people = int(payload.get("people", 1))
    updates.append((f"I{people_row}", people))

    # 一次批次寫入
    ws.batch_update([
        {"range": cell, "values": [[value]]}
        for cell, value in updates
    ])
