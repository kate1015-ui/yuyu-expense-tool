"""Vercel Serverless entrypoint — 把 backend/app.py 的 Flask app 包成 WSGI handler。"""
import os
import sys
import traceback

# 將 repo 根目錄下的 backend/ 加入 import 路徑
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.abspath(os.path.join(_HERE, "..", "backend"))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

_init_error = None
try:
    from app import create_app
    app = create_app()
except Exception:
    _init_error = traceback.format_exc()
    # 建立最小 app 回傳初始化錯誤（方便除錯）
    from flask import Flask, jsonify
    app = Flask(__name__)

    @app.route("/api/health")
    def _health_err():
        return jsonify(status="error", detail=_init_error), 500

    @app.route("/api/<path:p>", methods=["GET", "POST", "PUT", "DELETE"])
    def _catch_all(p):
        return jsonify(status="error", detail=_init_error), 500
