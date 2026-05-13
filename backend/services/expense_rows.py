"""把前端表單 payload 轉成「明細列 list」，給 Sheets 寫入用。

每一個 row 對應出差旅費報告表上的一列：
  date            日期
  route           起訖地點（自行開車會帶「\n(XX KM)」）
  route_url       Google Maps 路線連結（只有自行開車才有，會包成 HYPERLINK 公式）
  transport       交通工具（自行開車 / 高鐵 / 台鐵 / 捷運 / 計程車 / 停車費 / ETag）
  transport_amt   交通費金額
  meal_amt        膳雜費（只有第一列填，其餘 0）
  note            摘要（共乘 / 代墊）
"""
from __future__ import annotations

from urllib.parse import urlencode

MEAL_PER_PERSON = 700   # 每人膳雜費 (NTD)


def _build_maps_url(origin: str, destination: str) -> str:
    """產生 Google Maps Directions URL（手機點開會跳 Maps APP）。"""
    return "https://www.google.com/maps/dir/?" + urlencode({
        "api": "1",
        "origin": origin,
        "destination": destination,
        "travelmode": "driving",
    })


def build_rows_from_form(form: dict) -> list[dict]:
    """前端 payload → 明細列 list。

    form 欄位:
      transport_mode  'drive' | 'transit'
      date            str
      legs            list  (新版格式，見下)
      people          int
      companions      str

    transit legs 每項:
      {origin, destination, tool, amount}
      tool: "計程車" | "高鐵" | "台鐵" | "捷運"

    drive legs 每項:
      {description, origin, destination, distance_km, cost}
    """
    d = form.get("date", "")
    mode = form.get("transport_mode")
    companions = form.get("companions", "").strip()

    # 解析同行人名單
    companion_names = []
    if companions:
        companion_names = [n.strip() for n in companions.replace("、", ",").split(",") if n.strip()]
    companion_str = "、".join(companion_names)

    people = int(form.get("people", 1))
    meal_total = MEAL_PER_PERSON * people
    legs = form.get("legs", [])

    rows: list[dict] = []
    first = True

    if mode == "drive":
        for leg in legs:
            cost = float(leg.get("cost") or 0)
            parking = float(leg.get("parking") or 0)
            desc = leg.get("description", "").strip()
            distance = leg.get("distance_km")
            origin = (leg.get("origin") or "").strip()
            destination = (leg.get("destination") or "").strip()
            route_label = desc if desc else f"{origin}→{destination}"
            if distance is not None:
                route_label = f"{route_label}\n({distance} KM)"
            # 此路段有勾選共乘才顯示「與X共乘」
            has_companion = leg.get("hasCompanion", False) and bool(companion_names)
            note = ("與" + companion_str + "共乘") if has_companion else ""
            # 只要 origin / destination 都有就附上 Google Maps 路線連結
            route_url = _build_maps_url(origin, destination) if (origin and destination) else None
            rows.append({
                "date": d,
                "route": route_label,
                "route_url": route_url,
                "transport": "自行開車",
                "transport_amt": cost,
                "meal_amt": meal_total if first else 0,
                "note": note,
            })
            first = False
            # 該路段若有停車費，緊接著加一列「停車費」
            if parking > 0:
                rows.append({
                    "date": d, "route": "停車費", "transport": "停車費",
                    "transport_amt": parking, "meal_amt": 0, "note": "",
                })
        etag_total = float(form.get("etag_amt") or 0)
        if etag_total > 0:
            rows.append({
                "date": d, "route": "ETag/過路費", "transport": "ETag/過路費",
                "transport_amt": etag_total, "meal_amt": 0, "note": "",
            })
    elif mode == "transit":
        for leg in legs:
            amt = float(leg.get("amount") or 0)
            origin = leg.get("origin", "").strip()
            dest = leg.get("destination", "").strip()
            tool = (leg.get("tool") or "大眾交通").strip()
            is_copy = leg.get("isCompanionCopy", False)
            has_companion = leg.get("hasCompanion", False) and bool(companion_names)

            if is_copy:
                # 代墊票段（高鐵/台鐵複製出來的）
                note = "替" + companion_str + "代墊"
            elif has_companion and tool == "計程車":
                note = "與" + companion_str + "共乘"
            else:
                note = ""

            rows.append({
                "date": d,
                "route": f"{origin}→{dest}" if origin or dest else "",
                "transport": tool,
                "transport_amt": amt,
                "meal_amt": meal_total if first else 0,
                "note": note,
            })
            first = False

    return rows
