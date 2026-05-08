"""POST /api/expense/submit — 寫入個人 Google Sheet，回傳確認。"""
from flask import Blueprint, jsonify, request

from services.expense_rows import build_rows_from_form, MEAL_PER_PERSON
from services.sheets_service import append_expense

expense_bp = Blueprint("expense", __name__)

REQUIRED = ["name", "title", "reason", "date", "transport_mode"]


def _validate(data: dict):
    missing = [f for f in REQUIRED if not str(data.get(f, "")).strip()]
    if missing:
        return f"缺少必填欄位: {', '.join(missing)}"
    if data.get("transport_mode") not in ("drive", "transit"):
        return "transport_mode 必須為 drive 或 transit"
    legs = data.get("legs") or []
    if not legs:
        return "請至少填寫一段路線"
    return None


def _build_payload(data: dict) -> dict:
    """統一整理前端送來的資料。"""
    # date_from / date_to 若未提供，以 date 補齊（單日出差）
    date = str(data.get("date", "")).strip()
    if not str(data.get("date_from", "")).strip():
        data = {**data, "date_from": date}
    if not str(data.get("date_to", "")).strip():
        data = {**data, "date_to": date}
    people = int(data.get("people", 1))
    rows = build_rows_from_form(data)
    total_transport = sum(float(r.get("transport_amt") or 0) for r in rows)
    meal_total = MEAL_PER_PERSON * people
    grand_total = round(total_transport + meal_total, 1)
    return {
        **data,
        "people": people,
        "transport_total": round(total_transport, 1),
        "meal_total": meal_total,
        "grand_total": grand_total,
        "rows": rows,
    }


@expense_bp.post("/submit")
def submit():
    """寫入個人 Google Sheet。"""
    data = request.get_json(silent=True) or {}
    err = _validate(data)
    if err:
        return jsonify(error=err), 400

    payload = _build_payload(data)

    try:
        result = append_expense(payload)
    except RuntimeError as e:
        return jsonify(error=str(e)), 400
    except Exception as e:
        return jsonify(error="寫入 Google Sheet 失敗", detail=str(e)), 500

    return jsonify(
        ok=True,
        submitted_at=result["submitted_at"],
        tab_name=result["tab_name"],
        sheet_url=result["sheet_url"],
        name=payload["name"],
        grand_total=payload["grand_total"],
        meal_total=payload["meal_total"],
        transport_total=payload["transport_total"],
    )
