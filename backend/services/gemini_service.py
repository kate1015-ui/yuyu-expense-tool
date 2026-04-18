"""Gemini — 收據 / 電子發票辨識（使用新版 google-genai SDK）。

回傳欄位:
  date        ISO 格式 YYYY-MM-DD
  merchant    商店名稱
  amount      整數 (NTD)
  category    "計程車" | "電子發票" | "其他"
  raw_text    模型原始輸出 (留痕用)
"""
from __future__ import annotations

import base64
import io
import json
import re

from google import genai
from google.genai import types

from config import config


_PROMPT = """你是一位台灣公司的報帳助理。請從這張收據/發票影像中抽取以下欄位,
並只回傳一段 JSON (不要加任何 Markdown 語法、不要加說明文字):

{
  "date": "YYYY-MM-DD",
  "merchant": "商店或司機/車行名稱",
  "amount": 整數,
  "category": "計程車" 或 "電子發票" 或 "其他",
  "confidence": 0~1 的小數
}

規則:
- 日期若為民國年 (例如 114/03/15) 請轉成 2025-03-15。
- 金額只取「總計 / 應付 / 合計」欄位的數字, 不要含 $、NT$、逗號。
- 若影像模糊或非收據, confidence 給 0。
"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        text = m.group(0)
    return json.loads(text)


_TICKET_PROMPT = """這是一張台灣高鐵或台鐵的車票照片。
請只回傳一段 JSON（不要加 Markdown、不要加說明文字）：

{
  "origin": "出發站中文名稱（例：台北）",
  "destination": "到達站中文名稱（例：左營）",
  "amount": 票價整數（無法辨識填 0）,
  "type": "高鐵" 或 "台鐵"
}

規則：
- 站名只取繁體中文站名（例：台北、板橋、台中、左營），不要加「站」字。
- 金額取票面上的「票價」或「NT$」後面的數字。
- 若圖片不是車票，amount 填 0，origin 和 destination 填 ""。
"""


def recognize_ticket(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """辨識高鐵/台鐵車票，回傳站名與票價。"""
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY 尚未設定，請編輯 backend/.env")

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=[_TICKET_PROMPT, part],
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )

    raw = response.text or ""
    try:
        data = _extract_json(raw)
    except Exception as e:
        raise RuntimeError(f"Gemini 回傳無法解析: {raw[:200]}") from e

    return {
        "origin":      str(data.get("origin", "")).strip(),
        "destination": str(data.get("destination", "")).strip(),
        "amount":      int(data.get("amount", 0) or 0),
        "type":        str(data.get("type", "")).strip(),
    }


def recognize_receipt(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """辨識單張收據或 PDF。失敗時 raise RuntimeError。"""
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY 尚未設定，請編輯 backend/.env")

    client = genai.Client(api_key=config.GEMINI_API_KEY)

    part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=[_PROMPT, part],
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )

    raw = response.text or ""

    try:
        data = _extract_json(raw)
    except Exception as e:
        raise RuntimeError(f"Gemini 回傳內容無法解析為 JSON: {raw[:200]}") from e

    return {
        "date":       str(data.get("date", "")).strip(),
        "merchant":   str(data.get("merchant", "")).strip(),
        "amount":     int(data.get("amount", 0) or 0),
        "category":   str(data.get("category", "其他")).strip() or "其他",
        "confidence": float(data.get("confidence", 0) or 0),
        "raw_text":   raw,
    }
