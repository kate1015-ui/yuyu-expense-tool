"""POST /api/mileage/calculate — 計算里程與油資。"""
from datetime import date

from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from services.maps_service import calculate_distance, get_route_static_map
from services.gemini_service import recognize_ticket

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


@mileage_bp.post("/static-map")
def static_map():
    """回傳路線靜態圖（PNG）。

    Body: { "waypoints": ["公司", "拍攝地1", ...] }
    """
    data = request.get_json(silent=True) or {}
    waypoints = [str(w).strip() for w in data.get("waypoints", []) if str(w).strip()]
    if len(waypoints) < 2:
        return jsonify(error="至少需要 2 個地點"), 400

    try:
        png = get_route_static_map(waypoints)
    except Exception as e:
        return jsonify(error="產生路線圖失敗", detail=str(e)), 500

    return send_file(BytesIO(png), mimetype="image/png", download_name="route.png")


@mileage_bp.post("/recognize-ticket")
def recognize_ticket_route():
    """POST multipart/form-data: file=車票圖片 → 回傳站名與票價。"""
    if "file" not in request.files:
        return jsonify(error="請上傳圖片"), 400
    file = request.files["file"]
    image_bytes = file.read()
    if not image_bytes:
        return jsonify(error="檔案為空"), 400

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    mime = "application/pdf" if ext == "pdf" else f"image/{ext or 'jpeg'}"

    try:
        result = recognize_ticket(image_bytes, mime)
    except Exception as e:
        return jsonify(error="辨識失敗", detail=str(e)), 500

    if not result["origin"] or not result["destination"]:
        return jsonify(ok=False, error="無法辨識站名，請手動輸入"), 200

    return jsonify(ok=True, **result)
