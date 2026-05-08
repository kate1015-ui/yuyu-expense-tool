"""Google Maps Directions API — 里程計算。

刻意改用 Directions API（不用 Distance Matrix），因為這正是 Google Maps 網站
顯示路線時用的同一支 API，距離結果會跟使用者點按鈕跳轉到 Maps 看到的數字一致，
方便會計對帳。
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

    使用 Directions API + departure_time=now，這跟 Google Maps 網站當下顯示
    的「最佳路線」邏輯一致（包含即時路況）。距離數字解析自 distance.text，
    所以跟使用者在 Maps 看到的顯示完全一致（≥100km 取整數，否則 1 位小數）。

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
        departure_time=datetime.now(),  # 啟用即時車流，跟 Maps 網站行為一致
    )

    if not routes:
        raise RuntimeError("找不到可行駛路徑，請確認地址或重新搜尋")

    leg = routes[0]["legs"][0]   # 推薦路線的唯一一段（無 waypoints）
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
        "duration_text": leg["duration"]["text"],
        "cost": cost,
        "cost_per_km": config.COST_PER_KM,
    }
