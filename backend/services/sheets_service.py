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


def _fill(ws: gspread.Worksheet, payload: dict, date_str: str):
    """批次填入所有欄位（減少 API 呼叫次數）。"""
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

    # ── 明細列 R9–R14 ──
    # 注意：不寫 H 欄（膳雜費）——模板已有公式 =(G6-C6+1)*700*I15
    rows          = payload.get("rows", [])
    transport_sum = 0.0

    for idx in range(6):
        r = 9 + idx
        if idx < len(rows):
            rd     = rows[idx]
            t_amt  = float(rd.get("transport_amt") or 0)
            transport_sum += t_amt

            transport = rd.get("transport", "")
            # 停車費 / ETag 不寫工具欄（欄位有下拉驗證，寫入非選項值會被覆蓋）
            SKIP_TOOL = {"停車費", "ETag/過路費"}
            updates += [
                (f"A{r}", _tw_date(rd.get("date") or date_str)),
                (f"C{r}", (rd.get("route") or "").replace("\n", " ")),
            ]
            if transport and transport not in SKIP_TOOL:
                updates.append((f"D{r}", transport))
            if t_amt:  updates.append((f"E{r}", t_amt))
            note = rd.get("note", "")
            if note:   updates.append((f"I{r}", note))

    # ── 人數 & 小計 ──
    # I15 寫入人數後，H 欄與 H16 的膳雜費公式會自動計算
    # I16 若模板已有合計公式也不需寫；保險起見仍寫 E16（交通費合計）
    people = int(payload.get("people", 1))
    updates += [
        ("I15", people),
        ("E16", round(transport_sum, 1)),
    ]

    # 一次批次寫入
    ws.batch_update([
        {"range": cell, "values": [[value]]}
        for cell, value in updates
    ])
