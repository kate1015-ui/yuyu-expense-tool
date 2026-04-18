"""集中管理環境變數與常數。"""
import json
import os
import tempfile
from dotenv import load_dotenv

load_dotenv()


def _resolve_service_account_file() -> str:
    """決定 service account JSON 檔案位置。
    優先順序：
      1. 環境變數 GOOGLE_SERVICE_ACCOUNT_JSON（整個 JSON 字串，部署用）
         → 寫成臨時檔並回傳路徑
      2. 環境變數 GOOGLE_SERVICE_ACCOUNT_FILE 指定的檔案（本地開發用）
      3. 預設 "service_account.json"
    """
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if raw:
        try:
            json.loads(raw)  # 確認格式正確
        except Exception as e:
            raise RuntimeError(f"GOOGLE_SERVICE_ACCOUNT_JSON 格式錯誤：{e}")
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        )
        tmp.write(raw)
        tmp.close()
        return tmp.name
    return os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")


def _parse_origins(raw: str) -> list[str]:
    """支援逗號分隔的多個 origin，例：
    'http://localhost:5173,https://yuyu-expense.vercel.app'"""
    return [o.strip() for o in (raw or "").split(",") if o.strip()]


class Config:
    # Flask
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    PORT = int(os.getenv("PORT") or os.getenv("FLASK_PORT", 5000))

    # CORS：支援多個 origin（逗號分隔）
    FRONTEND_ORIGINS = _parse_origins(
        os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    )
    FRONTEND_ORIGIN = FRONTEND_ORIGINS[0] if FRONTEND_ORIGINS else "http://localhost:5173"

    # Gemini
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Google Maps
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
    COST_PER_KM = float(os.getenv("COST_PER_KM", 8))

    # Google Sheets — 共用服務帳號（支援檔案 or 環境變數 JSON）
    GOOGLE_SERVICE_ACCOUNT_FILE = _resolve_service_account_file()

    # -------------------------------------------------------
    # 每位成員的個人 Google Sheet ID
    # 格式: JSON 字串，key = 姓名, value = spreadsheet_id
    # 設定方式: 在 .env 填入 MEMBER_SHEETS={"黃聖婷":"1abc...","黃荷舒":"1def..."}
    # 也可直接在此 dict 硬寫（不想用環境變數時）
    # -------------------------------------------------------
    _member_sheets_raw = os.getenv("MEMBER_SHEETS", "{}")
    try:
        MEMBER_SHEETS: dict = json.loads(_member_sheets_raw)
    except Exception:
        MEMBER_SHEETS: dict = {}

    # 每個人的工作表 tab 名稱（全部共用同一個名稱）
    MEMBER_SHEET_TAB = os.getenv("MEMBER_SHEET_TAB", "報帳紀錄")

    # 上傳限制
    MAX_UPLOAD_MB = 10
    ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp", "heic"}
    ALLOWED_EXT = {"png", "jpg", "jpeg", "webp", "heic", "pdf"}


config = Config()
