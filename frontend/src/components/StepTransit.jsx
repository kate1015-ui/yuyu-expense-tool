import { useRef, useState } from "react";
import { useTransitPresets } from "../hooks/useRoutePresets";
import { lookupFare } from "../utils/fareData";
import NameChips from "./NameChips";

const TOOLS = [
  { key: "計程車", icon: "🚕" },
  { key: "高鐵",   icon: "🚄" },
  { key: "台鐵",   icon: "🚂" },
  { key: "捷運",   icon: "🚇" },
];

const COPY_TOOLS = new Set(["高鐵", "台鐵"]); // 有同行人時自動複製一段代墊票

let _nextId = 1;
const newLeg = () => ({
  id: _nextId++,
  tool: "",
  origin: "",
  destination: "",
  amount: "",
  hasCompanion: false,
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
              {p.tool} {p.origin}→{p.destination}
              {p.amount ? ` (${p.amount})` : ""}
            </button>
            <button type="button" onClick={() => onRemove(p.id)}
              className="pr-2 text-amber-400 hover:text-red-500 transition text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const OCR_TOOLS = new Set(["高鐵", "台鐵"]);

function LegCard({ leg, index, total, hasAnyCompanion, onUpdate, onRemove, onMove, onSave }) {
  const cameraRef = useRef(null);
  const fileRef   = useRef(null);
  const [ocrStatus, setOcrStatus] = useState("");
  const canSave = leg.tool && leg.origin.trim() && leg.destination.trim();
  const showCamera = OCR_TOOLS.has(leg.tool);

  async function handlePhoto(file) {
    if (!file) return;
    setOcrStatus("辨識中…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mileage/recognize-ticket", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { setOcrStatus(`⚠️ ${json.error || "無法辨識，請手動輸入"}`); return; }
      onUpdate("origin", json.origin);
      onUpdate("destination", json.destination);
      if (json.amount) onUpdate("amount", String(json.amount));
      setOcrStatus(`✅ ${json.origin} → ${json.destination}${json.amount ? `・NT$${json.amount}` : ""}`);
    } catch (e) {
      setOcrStatus(`⚠️ 辨識失敗：${e.message}`);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">路段 {index + 1}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:border-brand hover:text-brand disabled:opacity-30 transition text-sm">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:border-brand hover:text-brand disabled:opacity-30 transition text-sm">↓</button>
          {total > 1 && (
            <button type="button" onClick={onRemove}
              className="ml-1 text-sm text-slate-400 hover:text-red-500 transition">✕ 移除</button>
          )}
        </div>
      </div>

      {/* 交通工具 */}
      <div>
        <label className="label">交通工具</label>
        <div className="grid grid-cols-4 gap-2">
          {TOOLS.map(t => (
            <button key={t.key} type="button" onClick={() => onUpdate("tool", t.key)}
              className={`py-2.5 rounded-xl border text-sm font-medium transition
                ${leg.tool === t.key
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand"}`}>
              <div className="text-lg">{t.icon}</div>{t.key}
            </button>
          ))}
        </div>
      </div>

      {showCamera && (
        <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={e => handlePhoto(e.target.files?.[0])} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf"
            className="hidden" onChange={e => handlePhoto(e.target.files?.[0])} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()}
              className="py-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 text-blue-600 text-sm hover:bg-blue-100 transition flex items-center justify-center gap-1">
              📷 拍攝車票
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="py-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 text-blue-600 text-sm hover:bg-blue-100 transition flex items-center justify-center gap-1">
              🖼️ 上傳截圖
            </button>
          </div>
          {ocrStatus && (
            <div className={`text-xs px-3 py-2 rounded-lg ${ocrStatus.startsWith("⚠️") ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
              {ocrStatus}
            </div>
          )}
        </>
      )}

      <div>
        <label className="label">出發地</label>
        <input className="field" value={leg.origin}
          onChange={e => onUpdate("origin", e.target.value)}
          placeholder="例：住家 / 台北" />
      </div>
      <div>
        <label className="label">抵達地</label>
        <input className="field" value={leg.destination}
          onChange={e => onUpdate("destination", e.target.value)}
          placeholder="例：客戶公司 / 左營" />
      </div>
      <div>
        <label className="label">車資 (NTD)</label>
        <input type="number" className="field" value={leg.amount}
          onChange={e => onUpdate("amount", e.target.value)}
          placeholder="例：150" />
      </div>

      {/* 此路段有同行人（有選同行人才顯示） */}
      {hasAnyCompanion && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none bg-blue-50 rounded-xl px-3 py-2.5">
          <input type="checkbox" className="w-4 h-4 rounded accent-brand"
            checked={!!leg.hasCompanion}
            onChange={e => onUpdate("hasCompanion", e.target.checked)} />
          <span className="text-sm text-slate-700">
            🧑‍🤝‍🧑 此路段有同行人
            {leg.hasCompanion && COPY_TOOLS.has(leg.tool) && (
              <span className="ml-1 text-xs text-blue-600">（將自動新增代墊票）</span>
            )}
          </span>
        </label>
      )}

      {canSave && (
        <button type="button" onClick={onSave}
          className="text-xs text-slate-400 hover:text-amber-600 transition flex items-center gap-1">
          ⭐ 儲存為常用路線
        </button>
      )}
    </div>
  );
}

export default function StepTransit({ onDone, onBack, initialLegs, initialCompanions, userName }) {
  const [companions, setCompanions] = useState(initialCompanions || "");
  const [legs, setLegs] = useState(() => {
    if (initialLegs?.length > 0) {
      return initialLegs
        .filter(l => !l.isCompanionCopy)   // 還原時濾掉複製段，按鈕 confirm 再重新產生
        .map(l => ({
          id: _nextId++,
          tool: l.tool || "",
          origin: l.origin || "",
          destination: l.destination || "",
          amount: String(l.amount || ""),
          hasCompanion: !!l.hasCompanion,
        }));
    }
    return [newLeg()];
  });
  const { presets, addPreset, removePreset } = useTransitPresets();

  const companionExcludes = userName ? [userName] : [];
  const hasAnyCompanion = companions.trim().length > 0;

  function updateLeg(id, key, val) {
    setLegs(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [key]: val };
      if (key === "origin" || key === "destination" || key === "tool") {
        const tool = updated.tool;
        if (tool === "高鐵" || tool === "台鐵") {
          const fare = lookupFare(tool, updated.origin.trim(), updated.destination.trim());
          if (fare) updated.amount = String(fare);
        }
      }
      return updated;
    }));
  }
  function removeLeg(id) { setLegs(prev => prev.filter(l => l.id !== id)); }
  function addLeg() {
    if (legs.length >= 10) return;
    setLegs(prev => [...prev, newLeg()]);
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
  function applyPreset(p) {
    setLegs(prev => {
      const firstEmpty = prev.length === 1 && !prev[0].tool && !prev[0].origin && !prev[0].destination;
      const fare = lookupFare(p.tool, p.origin, p.destination);
      const amount = String(p.amount || fare || "");
      if (firstEmpty) {
        return [{ ...prev[0], tool: p.tool, origin: p.origin, destination: p.destination, amount }];
      }
      return [...prev, { id: _nextId++, tool: p.tool, origin: p.origin, destination: p.destination, amount }];
    });
  }
  function saveLegAsPreset(leg) {
    addPreset({ tool: leg.tool, origin: leg.origin.trim(), destination: leg.destination.trim(), amount: Number(leg.amount) || 0 });
  }

  const total = legs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const allValid = legs.length > 0 && legs.every(l =>
    l.origin.trim() && l.destination.trim() && l.tool && Number(l.amount) > 0
  );

  function confirm() {
    if (!allValid) return;
    // 展開：高鐵/台鐵 勾選同行人 → 自動複製一段代墊票
    const expandedLegs = [];
    for (const leg of legs) {
      const base = {
        origin: leg.origin.trim(),
        destination: leg.destination.trim(),
        tool: leg.tool,
        amount: Number(leg.amount),
        hasCompanion: leg.hasCompanion || false,
        isCompanionCopy: false,
      };
      expandedLegs.push(base);
      if (leg.hasCompanion && COPY_TOOLS.has(leg.tool) && companions) {
        expandedLegs.push({
          ...base,
          hasCompanion: false,
          isCompanionCopy: true,
        });
      }
    }
    const expandedTotal = expandedLegs.reduce((s, l) => s + l.amount, 0);
    onDone({
      transport_mode: "transit",
      companions,
      date: new Date().toISOString().slice(0, 10),
      legs: expandedLegs,
      transport_amt: expandedTotal,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => onBack?.(legs, undefined, companions)} className="text-slate-400 hover:text-slate-600">← 返回</button>
        <h2 className="text-xl font-bold text-slate-800">大眾交通路段</h2>
      </div>

      {/* 同行人 */}
      <div className="card space-y-2">
        <h3 className="font-semibold text-slate-700">👥 同行人 <span className="text-xs font-normal text-slate-400">（選填）</span></h3>
        <NameChips selected={companions} onSelect={setCompanions}
          multi excludes={companionExcludes} />
        {hasAnyCompanion && (
          <p className="text-xs text-slate-400">勾選各路段「此路段有同行人」；高鐵/台鐵會自動新增代墊票路段</p>
        )}
      </div>

      <PresetBar presets={presets} onSelect={applyPreset} onRemove={removePreset} />

      {legs.map((leg, idx) => (
        <LegCard key={leg.id} leg={leg} index={idx} total={legs.length}
          hasAnyCompanion={hasAnyCompanion}
          onUpdate={(key, val) => updateLeg(leg.id, key, val)}
          onRemove={() => removeLeg(leg.id)}
          onMove={(delta) => moveLeg(leg.id, delta)}
          onSave={() => saveLegAsPreset(leg)} />
      ))}

      {legs.length < 10 && (
        <button type="button" onClick={addLeg}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand hover:text-brand transition text-sm font-medium">
          + 新增路段（最多 10 段）
        </button>
      )}

      <div className="card bg-slate-900 text-white">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-300">交通費合計</span>
          <span className="text-green-400 text-lg font-bold">NT$ {total.toLocaleString()}</span>
        </div>
        {hasAnyCompanion && legs.some(l => l.hasCompanion && COPY_TOOLS.has(l.tool)) && (
          <p className="text-xs text-slate-400 mt-1">
            ＊ 高鐵/台鐵代墊票將自動新增（金額相同），合計送出時計入
          </p>
        )}
      </div>

      <button className="btn-primary w-full py-4 text-base" onClick={confirm} disabled={!allValid}>
        下一步 →
      </button>
    </div>
  );
}
