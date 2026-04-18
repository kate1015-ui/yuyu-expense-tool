"""Vercel Serverless entrypoint — 把 backend/app.py 的 Flask app 包成 WSGI handler。"""
import os
import sys
import traceback
from flask import Flask, jsonify

# 將 backend/ 加入 import 路徑
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.abspath(os.path.join(_HERE, "..", "backend"))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Vercel 需要 top-level 的 `app` 變數 — 先建一個佔位，成功就替換
app = Flask(__name__)
_init_error = None

try:
    from app import create_app as _create_app  # noqa: E402
    app = _create_app()
except Exception:
    _init_error = traceback.format_exc()

    @app.route("/api/health")
    def _health_err():
        return jsonify(status="error", detail=_init_error), 500

    @app.route("/api/<path:p>", methods=["GET", "POST", "PUT", "DELETE"])
    def _catch_all(p):
        return jsonify(status="error", detail=_init_error), 500
