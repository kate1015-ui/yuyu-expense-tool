"""Google Maps Distance Matrix — 里程計算 + Static Maps 路線圖。"""
from __future__ import annotations

from urllib.parse import urlencode

import googlemaps
import requests

from config import config


def _client() -> googlemaps.Client:
    if not config.GOOGLE_MAPS_API_KEY:
        raise RuntimeError("GOOGLE_MAPS_API_KEY 尚未設定, 請編輯 backend/.env")
    return googlemaps.Client(key=config.GOOGLE_MAPS_API_KEY)


def calculate_distance(origin: str, destination: str) -> dict:
    """回傳距離 (公里) + 油資 (NTD)。

    Args:
      origin: 起點地址或地標 (中文可)
      destination: 終點地址或地標

    Returns:
      {
        "origin": 原輸入,
        "destination": 原輸入,
        "origin_resolved": Google 解析後的正式地址,
        "destination_resolved": 同上,
        "distance_km": 浮點 (四捨五入到小數 1 位),
        "duration_text": "約 25 分鐘",
        "cost": 整數 (NTD),
        "cost_per_km": config.COST_PER_KM,
      }
    """
    gmaps = _client()
    result = gmaps.distance_matrix(
        origins=[origin],
        destinations=[destination],
        mode="driving",
        language="zh-TW",
        region="tw",
        units="metric",
    )

    if result.get("status") != "OK":
        raise RuntimeError(f"Google Maps API 回應異常: {result.get('status')}")

    row = result["rows"][0]["elements"][0]
    if row.get("status") != "OK":
        raise RuntimeError(f"找不到可行駛路徑 ({row.get('status')}), 請確認地址")

    distance_m = row["distance"]["value"]
    distance_km = round(distance_m / 1000, 1)
    cost = round(distance_km * config.COST_PER_KM)

    return {
        "origin": origin,
        "destination": destination,
        "origin_resolved": result["origin_addresses"][0],
        "destination_resolved": result["destination_addresses"][0],
        "distance_km": distance_km,
        "duration_text": row["duration"]["text"],
        "cost": cost,
        "cost_per_km": config.COST_PER_KM,
    }


def get_route_static_map(waypoints: list[str], size: str = "640x480") -> bytes:
    """回傳 Google Static Maps 路線圖 PNG bytes。

    waypoints: 按順序的地點清單（至少 2 個），例如 ["公司", "拍攝地1", "拍攝地2"]
    會在 path 上依序連線並標上 A/B/C... 數字標記。
    """
    if not config.GOOGLE_MAPS_API_KEY:
        raise RuntimeError("GOOGLE_MAPS_API_KEY 尚未設定")
    if len(waypoints) < 2:
        raise ValueError("至少需要 2 個地點")

    params = [
        ("size", size),
        ("maptype", "roadmap"),
        ("language", "zh-TW"),
        ("region", "tw"),
        ("path", "color:0x2563ebFF|weight:5|" + "|".join(waypoints)),
        ("key", config.GOOGLE_MAPS_API_KEY),
    ]
    # 標記 1, 2, 3...
    for i, pt in enumerate(waypoints, 1):
        params.append(("markers", f"color:red|label:{i}|{pt}"))

    url = "https://maps.googleapis.com/maps/api/staticmap?" + urlencode(params)
    resp = requests.get(url, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Static Maps 回應 {resp.status_code}: {resp.text[:200]}")
    return resp.content
