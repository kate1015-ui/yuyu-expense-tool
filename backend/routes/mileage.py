"""POST /api/mileage/calculate — 計算里程與油資。"""
from datetime import date

from flask import Blueprint, jsonify, request

from services.maps_service import calculate_distance

mileage_bp = Blueprint("mileage", __name__)


@mileage_bp.post("/calculate")
def calculate():
    data = request.get_json(silent=True) or {}
    origin = (data.get("origin") or "").strip()
    destination = (data.get("destination") or "").strip()

    if not origin or not destination:
        return jsonify(error="請同時填寫起點與終點"), 400

    try:
        result = calculate_distance(origin, destination)
    except Exception as e:
        return jsonify(error="里程計算失敗", detail=str(e)), 500

    suggested = {
        "date": date.today().isoformat(),
        "item": f"油資 ({result['origin_resolved']} → {result['destination_resolved']})",
        "amount": result["cost"],
        "category": "油資",
        "department": "",
        "project": "",
        "source": "mileage",
        "raw_ocr": (
            f"{result['distance_km']} km × {result['cost_per_km']} 元 "
            f"= {result['cost']} 元; 預估車程 {result['duration_text']}"
        ),
    }

    return jsonify(ok=True, mileage=result, suggested=suggested)
