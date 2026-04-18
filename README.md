# AI 自動報帳工具

參考「AI 過戶填表工具」設計精神打造 —— **極簡操作、自動填表、責任留痕**。

| 輸入方式 | 做什麼 |
|---|---|
| 📸 拍收據 / 電子發票 | Gemini 1.5 Flash 辨識「日期 / 商店 / 金額」 |
| 🚗 填起點終點 | Google Maps 計算距離, 以每公里 8 元換算油資 |
| 📝 確認表單 | 預填結果可直接修改, 部門下拉(業務/研發/行政) + 手填專案 |
| 💾 一鍵儲存 | 寫入 Google Sheets 的 `Expense_Log` 工作表 |
| 🖨️ 產出報帳單 | A4 HTML 預覽 + 瀏覽器列印 / 存 PDF |

---

## 專案結構

```
ai-expense-tool/
├── backend/                  Flask API
│   ├── app.py               入口 + 健康檢查
│   ├── config.py            環境變數集中管理
│   ├── .env.example         → 複製成 .env 後填入 API Key
│   ├── requirements.txt
│   ├── services/
│   │   ├── gemini_service.py    收據辨識
│   │   ├── maps_service.py      里程計算
│   │   └── sheets_service.py    Google Sheets 寫入
│   └── routes/
│       ├── receipt.py           POST /api/receipt/recognize
│       ├── mileage.py           POST /api/mileage/calculate
│       └── expense.py           POST /api/expense/submit
│                                GET  /api/expense/report/preview
└── frontend/                 React + Vite + Tailwind (Mobile First)
    ├── index.html
    ├── vite.config.js       已設好 /api → localhost:5000 proxy
    └── src/
        ├── App.jsx          Tab 切換 + 表單 + 成功彈窗
        ├── api/client.js    統一 API 呼叫
        └── components/
            ├── UploadReceipt.jsx     拍照 / 檔案上傳
            ├── MileageCalculator.jsx 里程計算
            ├── ExpenseForm.jsx       可修改的預覽表單
            └── SuccessModal.jsx      綠色勾勾 + 產出報帳單
```

---

## 環境準備

### 1. 後端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

cp .env.example .env             # 或手動複製
# 編輯 .env, 填入:
#   GEMINI_API_KEY
#   GOOGLE_MAPS_API_KEY
#   GOOGLE_SHEET_ID
# 並把 Service Account 的 JSON 放到 backend/service_account.json
```

所需 API:

| Key | 取得 |
|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| `GOOGLE_MAPS_API_KEY` | GCP Console → 啟用 **Distance Matrix API** |
| `service_account.json` | GCP Console → IAM → 服務帳號 → 建立金鑰 (JSON) |
| `GOOGLE_SHEET_ID` | 試算表網址 `/d/{這段}/edit` — 記得把試算表「分享」給服務帳號的 email |

啟動:

```bash
python app.py
# → http://localhost:5000/api/health
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

手機測試: Vite 已開 `host: true`, 手機連同一 Wi-Fi 後開 `http://<電腦 IP>:5173`。

---

## API 規格

### `POST /api/receipt/recognize`  (multipart/form-data, 欄位 `file`)
```json
{
  "ok": true,
  "recognition": { "date":"2025-03-14", "merchant":"台灣大車隊", "amount":320, "category":"計程車", "confidence":0.92, "raw_text":"..." },
  "suggested":   { "date":"2025-03-14", "item":"台灣大車隊", "amount":320, "category":"計程車", "department":"", "project":"", "source":"receipt", "raw_ocr":"..." }
}
```

### `POST /api/mileage/calculate`  `{ "origin": "...", "destination": "..." }`
```json
{
  "ok": true,
  "mileage":  { "distance_km": 32.4, "duration_text":"約 45 分鐘", "cost": 259, "cost_per_km": 8, "origin_resolved":"...", "destination_resolved":"..." },
  "suggested": { "date":"2026-04-17", "item":"油資 (A→B)", "amount":259, "source":"mileage", "raw_ocr":"32.4 km × 8 元 = 259 元" }
}
```

### `POST /api/expense/submit`
必填: `date, item, amount, department, project`; `department` 需為 `業務|研發|行政`.
```json
{ "ok": true, "expense_id":"EXP-20260417-A1B2C3", "submitted_at":"2026-04-17 10:22:05", "saved": true, "data": {...} }
```

### `GET /api/expense/report/preview?...` — 回傳 A4 HTML, 按「列印」可存 PDF。

---

## 設計精神對照

| 過戶填表工具 | 本工具的實現 |
|---|---|
| 極簡操作 | 首頁只有「拍照 / 填地址」兩個 Tab, 一步到表單 |
| 自動填表 | Gemini / Maps 回傳 `suggested` 欄位, 前端自動預填 |
| 責任留痕 | Sheets 多記一欄「原始辨識」與單號, 報帳單也會印出 |

---

## API Key 放哪裡

**絕對不要把 `.env` 或 `service_account.json` 提交到 git** (`.gitignore` 已排除)。
程式內所有金鑰讀取點都集中在 [backend/config.py](backend/config.py),日後要切換到 Secret Manager 也只要改這一個檔。
