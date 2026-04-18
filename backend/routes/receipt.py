"""POST /api/receipt/recognize — 上傳收據照片並辨識。"""
from flask import Blueprint, jsonify, request

from config import config
from services.gemini_service import recognize_receipt

receipt_bp = Blueprint("receipt", __name__)


def _allowed(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in config.ALLOWED_EXT


def _mime_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""
    return "application/pdf" if ext == "pdf" else f"image/{ext or 'jpeg'}"


@receipt_bp.post("/recognize")
def recognize():
    if "file" not in request.files:
        return jsonify(error="請上傳檔案 (欄位名: file)"), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify(error="檔名為空"), 400
    if not _allowed(file.filename):
        return jsonify(error=f"不支援的副檔名, 允許: {sorted(config.ALLOWED_EXT)}"), 400

    image_bytes = file.read()
    if not image_bytes:
        return jsonify(error="檔案內容為空"), 400

    mime = _mime_type(file.filename)
    try:
        result = recognize_receipt(image_bytes, mime_type=mime)
    except Exception as e:
        return jsonify(error="辨識失敗", detail=str(e)), 500

    # 前端預填表單用的建議值
    suggested = {
        "date": result["date"],
        "item": result["merchant"] or result["category"],
        "amount": result["amount"],
        "category": result["category"],
        "department": "",
        "project": "",
        "source": "receipt",
        "raw_ocr": result["raw_text"],
    }

    return jsonify(
        ok=True,
        recognition=result,
        suggested=suggested,
    )
