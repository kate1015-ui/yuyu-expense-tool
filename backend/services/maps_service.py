"""Google Maps Directions API — 里程計算。

關鍵：傳 departure_time=now → API 的 routes[0] 才會跟 Maps 網站顯示的
「目前最佳路線」一致（不傳的話 API 會選不同路徑）。

代價：提交時間不同，路況不同，數字會浮動 1-2 KM。
但因為 Sheet 已經把當下值固定下來，之後查 Maps 看到的數字「應該」最接近這個。
"""
from __future__ import annotations

import re
from datetime import datetime

import googlemaps

from config import config


def _client() -> googlemaps.Client:
    if not config.GOOGLE_MAPS_API_KEY:
        raise RuntimeError("GOOGLE_MAPS_API_KEY 尚未設定, 請編輯 backend/.env")
    return googlemaps.Client(key=config.GOOGLE_MAPS_API_KEY)


def _sum_highway_km(steps: list) -> float:
    """從路線 steps 抓「國道 / 高速 / 快速公路」段，加總 km，
    用來算 ETag（只有高速段才會被收費）。"""
    HIGHWAY_KEYWORDS = ("國道", "高速", "快速公路", "快速道路")
    total_m = 0
    for step in steps or []:
        instr = step.get("html_instructions", "") or ""
        if any(kw in instr for kw in HIGHWAY_KEYWORDS):
            total_m += step.get("distance", {}).get("value", 0)
    return round(total_m / 1000, 1)


def _parse_km_from_display(text: str, fallback_m: int):
    """從 Google 回傳的 distance.text（如「164 公里」「61.4 公里」「950 公尺」）
    抽出公里數，與 Maps 網站顯示完全一致。

    Google Maps 的顯示規則：
      ≥100 km → 整數（"164 公里"）→ 回傳 int 164
      <100 km → 一位小數（"61.4 公里"）→ 回傳 float 61.4
      <1 km   → 公尺（"950 公尺"）→ fallback 取一位小數 km
    回傳 int 或 float，這樣 f-string 與 JSON 序列化都不會出現多餘的 .0。
    """
    if text and "公里" in text:
        clean = text.replace(",", "").replace("，", "").strip()
        m = re.search(r"\d+(?:\.\d+)?", clean)
        if m:
            num_str = m.group()
            return float(num_str) if "." in num_str else int(num_str)
    # fallback：sub-km 或 text 解析失敗
    return round(fallback_m / 1000, 1)


def calculate_distance(origin: str, destination: str) -> dict:
    """回傳距離 (公里) + 油資 (NTD)。

    使用 Directions API（不抓即時車流），這樣同一段路永遠回相同數字，
    不會因為提交時間不同而有 1-3 KM 跳動。距離數字解析自 distance.text，
    顯示規則跟 Maps 一致（≥100km 取整數，否則 1 位小數）。

    Args:
      origin: 起點地址或地標 (中文可)
      destination: 終點地址或地標

    Returns:
      {
        "origin": 原輸入,
        "destination": 原輸入,
        "origin_resolved": Google 解析後的正式地址,
        "destination_resolved": 同上,
        "distance_km": 浮點，跟 Maps 顯示一致,
        "duration_text": "約 25 分鐘",
        "cost": 整數 (NTD),
        "cost_per_km": config.COST_PER_KM,
      }
    """
    gmaps = _client()
    routes = gmaps.directions(
        origin=origin,
        destination=destination,
        mode="driving",
        language="zh-TW",
        region="tw",
        units="metric",
        departure_time=datetime.now(),  # 必要，否則 routes[0] 不會匹配 Maps 顯示的「最佳路線」
    )

    if not routes:
        raise RuntimeError("找不到可行駛路徑，請確認地址或重新搜尋")

    # routes[0] = Google Maps 顯示的「目前最佳路線」
    leg = routes[0]["legs"][0]
    distance_km = _parse_km_from_display(
        leg["distance"].get("text", ""),
        leg["distance"]["value"],
    )
    cost = round(distance_km * config.COST_PER_KM)

    return {
        "origin": origin,
        "destination": destination,
        "origin_resolved": leg["start_address"],
        "destination_resolved": leg["end_address"],
        "distance_km": distance_km,
        "highway_km": _sum_highway_km(leg.get("steps", [])),
        "duration_text": leg["duration"]["text"],
        "cost": cost,
        "cost_per_km": config.COST_PER_KM,
    }
