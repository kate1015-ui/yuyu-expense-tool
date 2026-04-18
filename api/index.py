"""Vercel Serverless entrypoint — 把 backend/app.py 的 Flask app 包成 WSGI handler。

架構：
  - Vercel 把整個 repo 打包進 Python function
  - 本檔案用 sys.path 把 backend/ 加入匯入路徑
  - Vercel 偵測到 `app` 變數是 WSGI callable（Flask）會自動接管
  - vercel.json 會把 /api/* 全部 rewrite 到 /api/index，由 Flask 做內部路由
"""
import os
import sys

# 將 repo 根目錄下的 backend/ 加入 import 路徑
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.abspath(os.path.join(_HERE, "..", "backend"))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from app import create_app  # noqa: E402

app = create_app()
