import { useState } from "react";
import { api } from "../api/client";

const MEAL_PER_PERSON = 700;
const TITLES = ["攝影師", "創意總監", "企劃", "業務", "行政"];
const MEMBERS = ["黃柏堯", "黃聖婷", "黃荷舒", "黃郁清", "許泳玲", "林琮堯", "陳瑋帆", "鄭雅欣", "測試帳號"];

/** 名字快選晶片 — 點選高亮，再點取消 */
function NameChips({ selected, onSelect, multi = false, excludes = [] }) {
  const [showInput, setShowInput] = useState(false);
  const [customVal, setCustomVal] = useState("");

  function toggle(name) {
    if (!multi) {
      onSelect(name === selected ? "" : name);
      return;
    }
    // 去重後再切換
    const arr = selected ? [...new Set(selected.split(/[,、]/).map(s => s.trim()).filter(Boolean))] : [];
    const idx = arr.indexOf(name);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(name);
    onSelect(arr.join("、"));
  }

  function isOn(name) {
    if (!multi) return selected === name;
    return selected?.split(/[,、]/).map(s => s.trim()).includes(name);
  }

  function addCustom() {
    if (!customVal.trim()) return;
    if (!multi) { onSelect(customVal.trim()); setCustomVal(""); setShowInput(false); return; }
    const arr = selected ? selected.split(/[,、]/).map(s => s.trim()).filter(Boolean) : [];
    if (!arr.includes(customVal.trim())) arr.push(customVal.trim());
    onSelect(arr.join("、"));
    setCustomVal(""); setShowInput(false);
  }

  const available = MEMBERS.filter(m => !excludes.includes(m));

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {available.map(name => {
        const on = isOn(name);
        return (
          <button key={name} type="button"
            onClick={() => toggle(name)}
            title={on ? "再點一次取消" : ""}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition flex items-center gap-1
              ${on
                ? "bg-brand text-white border-brand"
                : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"}`}>
            {name}{on && <span className="text-xs opacity-80">✕</span>}
          </button>
        );
      })}
      {/* 其他：手填 */}
      {showInput ? (
        <div className="flex gap-1">
          <input
            className="field py-1 px-3 text-sm w-28"
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustom()}
            placeholder="輸入姓名"
            autoFocus
          />
          <button type="button" onClick={addCustom}
            className="px-3 py-1 rounded-full bg-brand text-white text-sm">✓</button>
          <button type="button" onClick={() => setShowInput(false)}
            className="px-2 py-1 rounded-full border border-slate-200 text-slate-400 text-sm">✕</button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowInput(true)}
          className="px-3 py-1.5 rounded-full text-sm border border-dashed border-slate-300 text-slate-400 hover:border-brand hover:text-brand transition">
          + 其他
        </button>
      )}
    </div>
  );
}

export default function StepForm({ transportData, onBack, onDone }) {
  const [form, setForm] = useState({
    name: "",
    title: "",
    reason: "",
    date: transportData?.date || new Date().toISOString().slice(0, 10),
    date_from: transportData?.date || new Date().toISOString().slice(0, 10),
    date_to: transportData?.date || new Date().toISOString().slice(0, 10),
    people: 1,
    companions: "",
    pay_for_others: false,
    ...transportData,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const mealTotal = MEAL_PER_PERSON * form.people;

  // 同行人人數和 companions 欄同步
  function setCompanions(val) {
    const count = val ? val.split(/[,、]/).filter(s => s.trim()).length + 1 : 1;
    setForm(f => ({ ...f, companions: val, people: count }));
  }

  function set(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  function buildPayload() {
    return {
      ...form,
      transport_amt: Number(form.transport_amt || 0),
      people: Number(form.people),
    };
  }

  function validate() {
    if (!form.name)   return "請選擇或填寫出差人姓名";
    if (!form.title)  return "請選擇職稱";
    if (!form.reason) return "請填寫事由，例：拍攝 XXX";
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.submitExpense(buildPayload());
      onDone?.(res);          // 傳回確認資料給 App 顯示成功畫面
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      await api.downloadExpense(buildPayload());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const modeLabel = form.transport_mode === "drive" ? "自行開車" : "大眾交通";
  const legs = Array.isArray(form.legs) ? form.legs : [];
  const isDrive = form.transport_mode === "drive";
  const tripLabel = legs.length > 0 ? `${legs.length} 段路程` : "";
  const totalAmt = Number(form.transport_amt || 0);

  // 同行人清單（排除出差人自己）
  const companionList = form.companions
    ? form.companions.split(/[,、]/).map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600">← 返回</button>
        <h2 className="text-xl font-bold text-slate-800">確認報帳資料</h2>
      </div>

      {/* 基本資料 */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-700">👤 出差人</h3>

        <div>
          <label className="label">姓名</label>
          <NameChips
            selected={form.name}
            onSelect={name => setForm(f => ({ ...f, name }))}
            excludes={companionList}
          />
          {form.name && (
            <div className="mt-2 text-sm text-slate-600">
              已選：<b>{form.name}</b>
            </div>
          )}
        </div>

        <div>
          <label className="label">職稱</label>
          <select className="field" value={form.title} onChange={set("title")}>
            <option value="">請選擇…</option>
            {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="label">事由</label>
          <input className="field" value={form.reason} onChange={set("reason")}
            placeholder="拍攝 XXX（客戶名稱）" required />
        </div>

        <div>
          <label className="label">日期</label>
          <input type="date" className="field" value={form.date_from}
            onChange={e => setForm(f => ({
              ...f, date_from: e.target.value, date_to: e.target.value, date: e.target.value
            }))} />
        </div>

        <div className="text-xs text-slate-400">單位：嶼嶼行銷（固定）</div>
      </div>

      {/* 交通費唯讀摘要 */}
      <div className="card space-y-2">
        <h3 className="font-semibold text-slate-700">🚘 交通費</h3>
        <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">交通方式</span>
            <span>{modeLabel}・{tripLabel}</span>
          </div>
          {legs.map((leg, i) => (
            <div key={i} className="flex justify-between items-start gap-3">
              <span className="text-slate-500 flex-shrink-0">路段 {i + 1}</span>
              <span className="text-right text-xs leading-5 flex-1">
                {isDrive ? (
                  <>
                    {leg.description || `${leg.origin}→${leg.destination}`}
                    {leg.distance_km != null && <>（{leg.distance_km}km）</>}
                    <br />
                    <span className="text-slate-500">自行開車・NT$ {Number(leg.cost || 0).toLocaleString()}</span>
                  </>
                ) : (
                  <>
                    {leg.origin}→{leg.destination}
                    <br />
                    <span className="text-slate-500">{leg.tool}・NT$ {Number(leg.amount || 0).toLocaleString()}</span>
                  </>
                )}
              </span>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-slate-500">交通費合計</span>
            <span className="font-bold text-brand">NT$ {totalAmt.toLocaleString()}</span>
          </div>
        </div>
        <button onClick={onBack} className="text-xs text-slate-400 underline">重新計算</button>
      </div>

      {/* 同行人 */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-700">👥 同行人</h3>
        <p className="text-xs text-slate-400 -mt-2">有人一起去就點選，人數會自動更新影響膳雜費</p>

        <div>
          <label className="label">同行人（可多選）</label>
          <NameChips
            selected={form.companions}
            onSelect={setCompanions}
            multi={true}
            excludes={form.name ? [form.name] : []}
          />
          {companionList.length > 0 && (
            <>
              <div className="mt-2 text-sm text-slate-600">
                共 <b>{form.people} 人</b>出行・膳雜費 {form.people} × 700 = <b className="text-slate-800">NT$ {mealTotal.toLocaleString()}</b>
              </div>
              <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                摘要欄將自動填入「幫{companionList.join("、")}代墊」
              </div>
            </>
          )}
        </div>
      </div>

      {/* 合計 */}
      <div className="card bg-slate-900 text-white">
        <div className="text-sm text-slate-400 mb-2">本次請款金額</div>
        <div className="flex justify-between text-sm mb-1">
          <span>交通費</span><span>NT$ {totalAmt.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span>膳雜費 ({form.people}人)</span><span>NT$ {mealTotal.toLocaleString()}</span>
        </div>
        <div className="border-t border-slate-700 pt-2 flex justify-between text-lg font-bold">
          <span>合計</span>
          <span className="text-green-400">NT$ {(totalAmt + mealTotal).toLocaleString()}</span>
        </div>
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
