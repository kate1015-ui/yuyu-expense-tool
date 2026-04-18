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

  /** 下載路線靜態圖（PNG）— 自行開車用 */
  async downloadRouteImage(waypoints) {
    const res = await fetch(`${BASE}/mileage/static-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.detail || json.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `路線圖_${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** 寫入個人 Google Sheet，回傳確認資料 */
  async submitExpense(payload) {
    return handle(await fetch(`${BASE}/expense/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
  },

  /** 下載填好的 Excel（用於列印交會計） */
  async downloadExpense(payload) {
    const res = await fetch(`${BASE}/expense/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.detail || json.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
    a.download = match ? decodeURIComponent(match[1]) : "出差旅費報告表.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
