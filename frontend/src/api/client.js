// API Base URL
//   - 本地開發：空字串 → 走 Vite proxy 轉到 localhost:5000
//   - 部署（Vercel）：空字串 → 同 origin，vercel.json rewrites 會把 /api/* 導到 Python serverless
//   - 若後端另外部署（Render 等）：設定 VITE_API_BASE=https://your-backend.example.com
const BASE = `${import.meta.env.VITE_API_BASE || ""}/api`;

async function handle(res) {
  if (res.headers.get("content-type")?.includes("application/json")) {
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
    return json;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export const api = {
  async getConfig() {
    return handle(await fetch(`${BASE}/config`));
  },

  async calculateMileage(origin, destination) {
    return handle(await fetch(`${BASE}/mileage/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination }),
    }));
  },

  /** 寫入個人 Google Sheet，回傳確認資料 */
  async submitExpense(payload) {
    return handle(await fetch(`${BASE}/expense/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
  },
};
