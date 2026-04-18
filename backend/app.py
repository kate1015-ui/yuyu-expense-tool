"""AI 自動報帳工具 — Flask 入口。

設計精神:
  - 極簡操作: 每個端點只負責一件事
  - 自動填表: 後端回傳「建議值」, 前端可編輯
  - 責任留痕: 所有寫入 Sheets 的資料都附時間戳與原始辨識來源
"""
from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from routes.mileage import mileage_bp
from routes.expense import expense_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(config)
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_MB * 1024 * 1024

    # 允許的 CORS origins：
    #   - 本地開發：http://localhost:5173
    #   - 部署：Vercel URL（透過環境變數 FRONTEND_ORIGIN 設定，支援多個，逗號分隔）
    allowed_origins = config.FRONTEND_ORIGINS or ["http://localhost:5173"]
    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    # 註冊 blueprint
    app.register_blueprint(mileage_bp, url_prefix="/api/mileage")
    app.register_blueprint(expense_bp, url_prefix="/api/expense")

    @app.get("/api/health")
    def health():
        return jsonify(
            status="ok",
            service="ai-expense-tool",
            gemini_configured=bool(config.GEMINI_API_KEY),
            maps_configured=bool(config.GOOGLE_MAPS_API_KEY),
            sheets_configured=bool(config.MEMBER_SHEETS),
        )

    @app.get("/api/config")
    def frontend_config():
        """回傳前端需要的公開設定（Maps API Key 供 Places Autocomplete 使用）。"""
        # 回傳每位成員的 Google Sheet 連結（供前端「列印報帳單」快捷鍵使用）
        member_sheets = {
            name: f"https://docs.google.com/spreadsheets/d/{sid}"
            for name, sid in config.MEMBER_SHEETS.items()
            if sid and not sid.startswith("試算表")
        }
        return jsonify(
            google_maps_api_key=config.GOOGLE_MAPS_API_KEY or "",
            member_sheets=member_sheets,
        )

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(error=f"檔案超過 {config.MAX_UPLOAD_MB}MB 上限"), 413

    @app.errorhandler(500)
    def server_error(e):
        return jsonify(error="伺服器錯誤", detail=str(e)), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=config.PORT, debug=config.DEBUG)
