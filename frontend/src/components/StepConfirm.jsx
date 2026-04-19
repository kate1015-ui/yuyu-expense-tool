import { useState } from "react";
import { api } from "../api/client";
import { useReportTemplates } from "../hooks/useReportTemplates";

const MEAL_PER_PERSON = 700;

export default function StepConfirm({ basicData, transportData, onBack, onDone }) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saved, setSaved]           = useState(false);
  const { addTemplate }             = useReportTemplates();

  const legs       = Array.isArray(transportData?.legs) ? transportData.legs : [];
  const isDrive    = transportData?.transport_mode === "drive";
  const etagAmt    = Number(transportData?.etag_amt || 0);
  const transportAmt = Number(transportData?.transport_amt || 0);
  const people     = Number(basicData?.people || 1);
  const mealTotal  = MEAL_PER_PERSON * people;

  // 同行人從 transportData 讀取
  const companionList = (transportData?.companions || "")
    .split(/[,、]/).map(s => s.trim()).filter(Boolean);

  // 顯示用路段（排除複製代墊段）
  const displayLegs = legs.filter(l => !l.isCompanionCopy);
  const copyCount   = legs.filter(l => l.isCompanionCopy).length;

  function buildPayload() {
    const date = basicData?.date || new Date().toISOString().slice(0, 10);
    return {
      ...basicData,
      ...transportData,
      date,
      date_from: basicData?.date_from || date,
      date_to:   basicData?.date_to   || date,
      people,
      transport_amt: transportAmt,
    };
  }

  async function submit() {
    setError(""); setLoading(true);
    try {
      const res = await api.submitExpense(buildPayload());
      onDone?.(res, buildPayload());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    setError(""); setLoading(true);
    try {
      await api.downloadExpense(buildPayload());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function saveTemplate() {
    if (!templateName.trim()) return;
    // 儲存時只存原始路段（不含複製代墊段）
    addTemplate({
      name:           templateName.trim(),
      reason:         basicData?.reason  || "",
      title:          basicData?.title   || "",
      companions:     transportData?.companions || "",
      transport_mode: transportData?.transport_mode,
      legs:           displayLegs,
      etag_amt:       etagAmt,
    });
    setTemplateName(""); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600">← 返回</button>
        <h2 className="text-xl font-bold text-slate-800">確認報帳資料</h2>
      </div>

      {/* 出差資訊 */}
      <div className="card space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-slate-700">👤 出差人</h3>
          <button onClick={onBack} className="text-xs text-slate-400 underline">修改</button>
        </div>
        <div className="text-sm space-y-1 text-slate-600">
          <div className="flex gap-3"><span className="text-slate-400 w-12">姓名</span><span className="font-medium text-slate-800">{basicData?.name}</span></div>
          <div className="flex gap-3"><span className="text-slate-400 w-12">職稱</span><span>{basicData?.title}</span></div>
          <div className="flex gap-3"><span className="text-slate-400 w-12">事由</span><span>{basicData?.reason}</span></div>
          <div className="flex gap-3"><span className="text-slate-400 w-12">日期</span><span>{basicData?.date}</span></div>
          <div className="flex gap-3"><span className="text-slate-400 w-12">人數</span><span>{people} 人（膳雜費）</span></div>
          {companionList.length > 0 && (
            <div className="flex gap-3"><span className="text-slate-400 w-12">同行人</span><span>{companionList.join("、")}</span></div>
          )}
        </div>
      </div>

      {/* 交通費 */}
      <div className="card space-y-2">
        <h3 className="font-semibold text-slate-700">🚘 交通費</h3>
        <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">交通方式</span>
            <span>{isDrive ? "自行開車" : "大眾交通"}・{displayLegs.length} 段{copyCount > 0 ? `＋${copyCount} 段代墊` : ""}</span>
          </div>
          {displayLegs.map((leg, i) => (
            <div key={i} className="flex justify-between items-start gap-3">
              <span className="text-slate-500 flex-shrink-0">路段 {i + 1}</span>
              <span className="text-right text-xs leading-5 flex-1">
                {isDrive ? (
                  <>
                    {leg.description || `${leg.origin}→${leg.destination}`}
                    {leg.distance_km != null && <> ({leg.distance_km} KM)</>}
                    {leg.hasCompanion && companionList.length > 0 && (
                      <span className="ml-1 text-blue-600">・與{companionList.join("、")}共乘</span>
                    )}
                    <br />
                    <span className="text-slate-500">里程費・NT$ {Number(leg.cost || 0).toLocaleString()}</span>
                    {Number(leg.parking) > 0 && (
                      <><br /><span className="text-slate-500">停車費・NT$ {Number(leg.parking).toLocaleString()}</span></>
                    )}
                  </>
                ) : (
                  <>
                    {leg.origin}→{leg.destination}
                    {leg.hasCompanion && companionList.length > 0 && (
                      <span className="ml-1 text-blue-600">
                        {leg.tool === "計程車" ? `・與${companionList.join("、")}共乘` : "・含同行人"}
                      </span>
                    )}
                    <br />
                    <span className="text-slate-500">{leg.tool}・NT$ {Number(leg.amount || 0).toLocaleString()}</span>
                  </>
                )}
              </span>
            </div>
          ))}
          {etagAmt > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">ETag/過路費</span>
              <span>NT$ {etagAmt.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold">
            <span className="text-slate-500">交通費合計</span>
            <span className="text-brand">NT$ {transportAmt.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 請款合計 */}
      <div className="card bg-slate-900 text-white">
        <div className="text-sm text-slate-400 mb-2">本次請款金額</div>
        <div className="flex justify-between text-sm mb-1">
          <span>交通費</span><span>NT$ {transportAmt.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span>膳雜費（{people} 人 × 700）</span>
          <span>NT$ {mealTotal.toLocaleString()}</span>
        </div>
        <div className="border-t border-slate-700 pt-2 flex justify-between text-lg font-bold">
          <span>合計</span>
          <span className="text-green-400">NT$ {(transportAmt + mealTotal).toLocaleString()}</span>
        </div>
      </div>

      {/* 儲存常用報帳單 */}
      <div className="card">
        {saved ? (
          <p className="text-sm text-green-600 text-center py-1">✅ 已儲存為常用報帳單</p>
        ) : saving ? (
          <div className="flex gap-2">
            <input className="field flex-1 text-sm" value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveTemplate()}
              placeholder="例：淨淨拍攝" autoFocus />
            <button onClick={saveTemplate}
              className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium">儲存</button>
            <button onClick={() => { setSaving(false); setTemplateName(""); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-400">取消</button>
          </div>
        ) : (
          <button onClick={() => setSaving(true)}
            className="w-full text-center text-sm text-slate-400 hover:text-amber-600 transition flex items-center justify-center gap-1 py-1">
            ⭐ 儲存為常用報帳單（下次一鍵報帳）
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <button className="btn-primary w-full py-4 text-base" onClick={submit} disabled={loading}>
        {loading ? "送出中…" : "✅ 送出報帳"}
      </button>

      <button className="btn-ghost w-full py-3 text-sm" onClick={download} disabled={loading}>
        📥 只下載 Excel（不送出）
      </button>

      <p className="text-center text-xs text-slate-400">
        送出後資料會存入你的 Google Sheet，再提供 Excel 供印出交會計
      </p>
    </div>
  );
}
