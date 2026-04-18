import { useState } from "react";
import { api } from "../api/client";

export default function MileageCalculator({ onCalculated }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.calculateMileage(origin, destination);
      setResult(res.mileage);
      onCalculated?.(res.suggested, res.mileage);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">🚗 里程 / 油資計算</h2>
        <p className="text-sm text-slate-500 mt-1">每公里 8 元自動換算。</p>
      </div>

      <div>
        <label className="label">起點</label>
        <input
          className="field"
          placeholder="例: 台北市信義區市府路1號"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label">終點</label>
        <input
          className="field"
          placeholder="例: 桃園機場第二航廈"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />
      </div>

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "計算中…" : "計算里程與油資"}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-700 space-y-1">
          <div>🛣️ 距離: <b>{result.distance_km} 公里</b></div>
          <div>⏱️ 預估車程: {result.duration_text}</div>
          <div>💰 油資: <b className="text-brand">NT$ {result.cost.toLocaleString()}</b>
            <span className="text-slate-500"> ({result.cost_per_km} 元/公里)</span>
          </div>
        </div>
      )}
    </form>
  );
}
