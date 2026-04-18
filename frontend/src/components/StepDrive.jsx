import { useState } from "react";
import { api } from "../api/client";
import PlacesInput from "./PlacesInput";
import { useMapsLoader } from "../hooks/useMapsLoader";
import { useDrivePresets } from "../hooks/useRoutePresets";

let _nextId = 1;
const ETAG_PER_KM = 1.3;   // 小客車每公里 ETag 費率（NT$）

const newLeg = () => ({
  id: _nextId++,
  description: "",
  origin: "",
  destination: "",
  parking: "",       // 停車費 (NTD)
  useHighway: false, // 是否途經高速公路（用於自動估算 ETag）
  loading: false,
  result: null,      // { distance_km, cost, origin_resolved, destination_resolved, duration_text, cost_per_km }
  error: "",
});

function PresetBar({ presets, onSelect, onRemove }) {
  if (presets.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-500 font-medium">⭐ 常用路線</div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <div key={p.id} className="flex items-center bg-amber-50 border border-amber-200 rounded-full overflow-hidden">
            <button type="button" onClick={() => onSelect(p)}
              className="px-3 py-1 text-sm text-amber-800 hover:bg-amber-100 transition">
              {p.description || `${p.origin}→${p.destination}`}
            </button>
            <button type="button" onClick={() => onRemove(p.id)}
              className="pr-2 text-amber-400 hover:text-red-500 transition text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegCard({ leg, index, total, mapsReady, onUpdate, onRemove, onCalculate, onMove, onSave }) {
  const canCalc = leg.origin.trim() && leg.destination.trim() && !leg.loading;
  const canSave = leg.origin.trim() && leg.destination.trim();
  const parkingAmt = Number(leg.parking) || 0;

  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">路段 {index + 1}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500 transition text-sm">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:border-brand hover:text-brand disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500 transition text-sm">↓</button>
          {total > 1 && (
            <button type="button" onClick={onRemove}
              className="ml-1 text-sm text-slate-400 hover:text-red-500 transition">✕ 移除</button>
          )}
        </div>
      </div>

      <div>
        <label className="label">路程說明</label>
        <input className="field" value={leg.description}
          onChange={e => onUpdate("description", e.target.value)}
          placeholder="例：公司到拍攝地1" />
      </div>

      <div>
        <label className="label">出發地</label>
        {mapsReady
          ? <PlacesInput value={leg.origin} onChange={v => onUpdate("origin", v)} placeholder="搜尋地點" />
          : <input className="field" value={leg.origin} onChange={e => onUpdate("origin", e.target.value)} placeholder="例：台北市信義區市府路 1 號" />
        }
      </div>

      <div>
        <label className="label">目的地</label>
        {mapsReady
          ? <PlacesInput value={leg.destination} onChange={v => onUpdate("destination", v)} placeholder="搜尋地點" />
          : <input className="field" value={leg.destination} onChange={e => onUpdate("destination", e.target.value)} placeholder="例：桃園市中壢區中山路" />
        }
      </div>

      <button type="button" className="btn-primary w-full" onClick={onCalculate} disabled={!canCalc}>
        {leg.loading ? "計算中…" : "計算距離"}
      </button>

      {leg.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{leg.error}</div>
      )}

      {leg.result && (
        <>
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">距離</span>
              <span className="font-semibold">{leg.result.distance_km} 公里</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">預估車程</span>
              <span>{leg.result.duration_text}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">里程費（{leg.result.distance_km} × {leg.result.cost_per_km}）</span>
              <span className="text-brand font-bold">NT$ {leg.result.cost.toLocaleString()}</span>
            </div>
            {parkingAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">停車費</span>
                <span className="text-brand font-bold">NT$ {parkingAmt.toLocaleString()}</span>
              </div>
            )}
          </div>
          {/* 高速公路勾選 → 自動估算 ETag */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-brand"
              checked={!!leg.useHighway}
              onChange={e => onUpdate("useHighway", e.target.checked)}
            />
            <span className="text-sm text-slate-600">🛣️ 途經高速公路</span>
            {leg.useHighway && (
              <span className="ml-auto text-xs text-slate-400">
                ETag 估算 NT$ {Math.round(leg.result.distance_km * ETAG_PER_KM)}
              </span>
            )}
          </label>
        </>
      )}

      {/* 停車費 */}
      <div>
        <label className="label">停車費 (NTD) <span className="text-slate-400 font-normal">（選填）</span></label>
        <input type="number" className="field" value={leg.parking}
          onChange={e => onUpdate("parking", e.target.value)}
          placeholder="例：50" min="0" />
      </div>

      {canSave && (
        <button type="button" onClick={onSave}
          className="text-xs text-slate-400 hover:text-amber-600 transition flex items-center gap-1">
          ⭐ 儲存為常用路線
        </button>
      )}
    </div>
  );
}

export default function StepDrive({ onDone, onBack, initialLegs, initialEtag }) {
  const mapsReady = useMapsLoader();
  const [legs, setLegs] = useState(() => {
    if (initialLegs?.length > 0) {
      return initialLegs.map(l => ({
        id: _nextId++,
        description: l.description || "",
        origin: l.origin || "",
        destination: l.destination || "",
        parking: String(l.parking || ""),
        useHighway: !!l.useHighway,
        loading: false,
        result: l.result ?? (l.distance_km != null ? {
          distance_km: l.distance_km,
          cost: l.cost || 0,
          origin_resolved: l.origin || "",
          destination_resolved: l.destination || "",
          duration_text: "",
          cost_per_km: 8,
        } : null),
        error: "",
      }));
    }
    return [newLeg()];
  });
  const [etag, setEtag] = useState(String(initialEtag || ""));
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError]     = useState("");
  const { presets, addPreset, removePreset } = useDrivePresets();

  function updateLeg(id, key, val) {
    setLegs(prev => prev.map(l => l.id === id
      ? { ...l, [key]: val, ...(["origin", "destination"].includes(key) ? { result: null, error: "" } : {}) }
      : l
    ));
  }
  function removeLeg(id) {
    setLegs(prev => prev.filter(l => l.id !== id));
  }
  function addLeg() {
    if (legs.length >= 5) return;
    setLegs(prev => [...prev, newLeg()]);
  }
  function applyPreset(p) {
    setLegs(prev => {
      const firstEmpty = prev.length === 1 && !prev[0].origin && !prev[0].destination;
      const leg = { id: _nextId++, description: p.description || "", origin: p.origin, destination: p.destination, parking: "", loading: false, result: null, error: "" };
      if (firstEmpty) {
        return [{ ...prev[0], description: p.description || "", origin: p.origin, destination: p.destination, result: null, error: "" }];
      }
      return [...prev, leg];
    });
  }
  function saveLegAsPreset(leg) {
    addPreset({
      description: leg.description.trim(),
      origin: leg.origin.trim(),
      destination: leg.destination.trim(),
    });
  }

  function moveLeg(id, delta) {
    setLegs(prev => {
      const idx = prev.findIndex(l => l.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  }

  async function calculateLeg(id) {
    const leg = legs.find(l => l.id === id);
    if (!leg) return;
    setLegs(prev => prev.map(l => l.id === id ? { ...l, loading: true, error: "", result: null } : l));
    try {
      const res = await api.calculateMileage(leg.origin, leg.destination);
      setLegs(prev => prev.map(l => l.id === id ? { ...l, loading: false, result: res.mileage } : l));
    } catch (e) {
      setLegs(prev => prev.map(l => l.id === id ? { ...l, loading: false, error: e.message } : l));
    }
  }

  const allCalculated = legs.length > 0 && legs.every(l => l.result);
  const totalKm      = legs.reduce((s, l) => s + (l.result?.distance_km || 0), 0);
  const totalMileage = legs.reduce((s, l) => s + (l.result?.cost || 0), 0);
  const totalParking = legs.reduce((s, l) => s + (Number(l.parking) || 0), 0);
  // autoEtag: 勾選高速公路的路段各自估算後加總
  const autoEtag = legs.reduce((s, l) =>
    l.useHighway && l.result ? s + Math.round(l.result.distance_km * ETAG_PER_KM) : s, 0);
  // 若使用者有手動填寫則優先用手動值，否則用自動估算
  const etagAmt  = etag !== "" ? Number(etag) : autoEtag;
  const totalAmt = totalMileage + totalParking + etagAmt;

  async function downloadRouteImage() {
    setMapError(""); setMapLoading(true);
    try {
      const pts = [];
      legs.forEach((l, i) => {
        if (i === 0) pts.push(l.origin);
        pts.push(l.destination);
      });
      await api.downloadRouteImage(pts);
    } catch (e) {
      setMapError(e.message);
    } finally {
      setMapLoading(false);
    }
  }

  function confirm() {
    const legPayloads = legs.map(l => ({
      description:  l.description.trim(),
      origin:       l.result.origin_resolved,
      destination:  l.result.destination_resolved,
      distance_km:  l.result.distance_km,
      cost:         l.result.cost,
      parking:      Number(l.parking) || 0,
      useHighway:   !!l.useHighway,
    }));

    onDone({
      transport_mode: "drive",
      legs: legPayloads,
      etag_amt:      etagAmt,
      transport_amt: totalAmt,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => onBack?.(legs, etag)} className="text-slate-400 hover:text-slate-600">← 返回</button>
        <h2 className="text-xl font-bold text-slate-800">自行開車路段</h2>
      </div>

      {mapsReady && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600">
          ✅ Google Maps 已啟用，可直接搜尋地點
        </div>
      )}

      <PresetBar presets={presets} onSelect={applyPreset} onRemove={removePreset} />

      {legs.map((leg, idx) => (
        <LegCard
          key={leg.id}
          leg={leg}
          index={idx}
          total={legs.length}
          mapsReady={mapsReady}
          onUpdate={(key, val) => updateLeg(leg.id, key, val)}
          onRemove={() => removeLeg(leg.id)}
          onCalculate={() => calculateLeg(leg.id)}
          onMove={(delta) => moveLeg(leg.id, delta)}
          onSave={() => saveLegAsPreset(leg)}
        />
      ))}

      {legs.length < 5 && (
        <button type="button" onClick={addLeg}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand hover:text-brand transition text-sm font-medium">
          + 新增路段
        </button>
      )}

      {/* ETag / 過路費 */}
      <div className="card space-y-2">
        <div className="flex justify-between items-baseline">
          <label className="label mb-0">ETag / 過路費 (NTD)</label>
          {autoEtag > 0 && etag === "" && (
            <span className="text-xs text-green-600 font-medium">自動估算 NT$ {autoEtag}</span>
          )}
        </div>
        <input type="number" className="field" value={etag}
          onChange={e => setEtag(e.target.value)}
          placeholder={autoEtag > 0 ? `自動估算：${autoEtag}（可覆蓋）` : "未勾選高速公路則手動填寫"}
          min="0" />
        {etag !== "" && (
          <button type="button" onClick={() => setEtag("")}
            className="text-xs text-slate-400 hover:text-brand transition">
            ↩ 清除改用自動估算（NT$ {autoEtag}）
          </button>
        )}
        <p className="text-xs text-slate-400">勾選各路段「途經高速公路」可自動計算（{ETAG_PER_KM} 元/公里）</p>
      </div>

      {allCalculated && (
        <>
          <div className="card bg-slate-900 text-white">
            <div className="text-sm text-slate-400 mb-2">交通費明細</div>
            {legs.map((l, i) => (
              <div key={l.id} className="text-sm mb-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-300">
                    路段 {i + 1}：{l.description || `${l.origin}→${l.destination}`}（{l.result.distance_km}km）
                  </span>
                  <span>NT$ {l.result.cost.toLocaleString()}</span>
                </div>
                {Number(l.parking) > 0 && (
                  <div className="flex justify-between pl-3">
                    <span className="text-slate-400">└ 停車費</span>
                    <span className="text-slate-300">NT$ {Number(l.parking).toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 mt-1 space-y-0.5">
              <div className="flex justify-between text-sm text-slate-400">
                <span>里程費（{totalKm.toFixed(1)} km × 8）</span>
                <span>NT$ {totalMileage.toLocaleString()}</span>
              </div>
              {totalParking > 0 && (
                <div className="flex justify-between text-sm text-slate-400">
                  <span>停車費合計</span>
                  <span>NT$ {totalParking.toLocaleString()}</span>
                </div>
              )}
              {etagAmt > 0 && (
                <div className="flex justify-between text-sm text-slate-400">
                  <span>ETag/過路費{etag === "" ? "（估算）" : ""}</span>
                  <span>NT$ {etagAmt.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-slate-700 pt-1.5 mt-0.5">
                <span>合計</span>
                <span className="text-green-400">NT$ {totalAmt.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button type="button" className="btn-ghost w-full py-3" onClick={downloadRouteImage} disabled={mapLoading}>
            {mapLoading ? "產生路線圖…" : "🗺️ 下載路線圖"}
          </button>
          {mapError && <p className="text-xs text-red-500">{mapError}</p>}
        </>
      )}

      <button className="btn-primary w-full py-4 text-base" onClick={confirm} disabled={!allCalculated}>
        下一步 →
      </button>
    </div>
  );
}
