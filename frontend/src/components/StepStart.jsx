import { useState, useEffect } from "react";
import { useReportTemplates } from "../hooks/useReportTemplates";
import { api } from "../api/client";

const MEAL_PER_PERSON = 700;
const TITLES = ["攝影師", "創意總監", "企劃", "業務", "行政"];
const MEMBERS = ["黃柏堯", "黃聖婷", "黃荷舒", "黃郁清", "許泳玲", "林琮堯", "陳瑋帆", "鄭雅欣", "測試帳號"];

function NameChips({ selected, onSelect, multi = false, excludes = [] }) {
  const [showInput, setShowInput] = useState(false);
  const [customVal, setCustomVal] = useState("");

  function toggle(name) {
    if (!multi) { onSelect(name === selected ? "" : name); return; }
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
          <button key={name} type="button" onClick={() => toggle(name)}
            title={on ? "再點一次取消" : ""}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition flex items-center gap-1
              ${on ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"}`}>
            {name}{on && <span className="text-xs opacity-80">✕</span>}
          </button>
        );
      })}
      {showInput ? (
        <div className="flex gap-1">
          <input className="field py-1 px-3 text-sm w-28" value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustom()}
            placeholder="輸入姓名" autoFocus />
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

function TemplateCard({ tpl, onApply, onQuickSubmit, onRemove, disabled }) {
  const legs = tpl.legs || [];
  const modeLabel = tpl.transport_mode === "drive" ? "🚗 自行開車" : "🚇 大眾交通";

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-slate-800">📋 {tpl.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">{modeLabel}・{tpl.reason || "無事由"}</div>
        </div>
        <button onClick={onRemove} className="text-slate-300 hover:text-red-400 text-sm leading-none mt-0.5">✕</button>
      </div>

      <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 space-y-0.5">
        {legs.slice(0, 3).map((l, i) => (
          <div key={i}>
            {tpl.transport_mode === "transit"
              ? `${l.tool} ${l.origin} → ${l.destination}${l.amount ? `（NT$${l.amount}）` : ""}`
              : `${l.description || (l.origin + "→" + l.destination)}${l.cost ? `（NT$${l.cost}）` : ""}`
            }
          </div>
        ))}
        {legs.length > 3 && <div className="text-slate-400">… 共 {legs.length} 段</div>}
        {tpl.companions && <div className="text-slate-400 pt-0.5">同行：{tpl.companions}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onApply} disabled={disabled}
          className="py-2 text-sm border border-brand text-brand rounded-xl hover:bg-brand hover:text-white transition font-medium disabled:opacity-40">
          帶入資料
        </button>
        <button onClick={onQuickSubmit} disabled={disabled}
          className="py-2 text-sm bg-brand text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-40">
          ⚡ 一鍵報帳
        </button>
      </div>
    </div>
  );
}

export default function StepStart({ onNext, onSelectMode, onQuickSubmit, initialData }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name:       initialData?.name       || "",
    title:      initialData?.title      || "",
    reason:     initialData?.reason     || "",
    date:       initialData?.date       || today,
    companions: initialData?.companions || "",
    people:     initialData?.people     || 1,
  });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [memberSheets, setMemberSheets] = useState({});
  const [showPrint, setShowPrint]   = useState(false);
  const [printName, setPrintName]   = useState("");
  const { templates, removeTemplate } = useReportTemplates();

  // 載入各成員的 Google Sheet 連結
  useEffect(() => {
    import("../api/client").then(({ api }) => {
      api.getConfig().then(cfg => {
        if (cfg.member_sheets) setMemberSheets(cfg.member_sheets);
      }).catch(() => {});
    });
  }, []);

  const companionList = form.companions
    ? form.companions.split(/[,、]/).map(s => s.trim()).filter(Boolean)
    : [];
  const mealTotal = MEAL_PER_PERSON * form.people;

  function setCompanions(val) {
    const count = val ? val.split(/[,、]/).filter(s => s.trim()).length + 1 : 1;
    setForm(f => ({ ...f, companions: val, people: count }));
  }

  function validate(overrideReason) {
    if (!form.name)  return "請先選擇出差人姓名";
    if (!form.title) return "請選擇職稱";
    if (!form.date)  return "請選擇日期";
    if (!(overrideReason || form.reason)) return "請填寫事由，例：拍攝 XXX";
    return null;
  }

  function handleNext() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    onNext?.({ ...form });
  }

  function applyTemplate(tpl) {
    const updatedForm = { ...form };
    if (!updatedForm.reason && tpl.reason)     updatedForm.reason = tpl.reason;
    if (!updatedForm.title  && tpl.title)      updatedForm.title  = tpl.title;
    if (!updatedForm.companions && tpl.companions) {
      updatedForm.companions = tpl.companions;
      updatedForm.people = tpl.companions.split(/[,、]/).filter(Boolean).length + 1;
    }
    const err = validate(updatedForm.reason);
    if (err) { setError(err); return; }
    setError("");
    setForm(updatedForm);
    onSelectMode(tpl.transport_mode, updatedForm, tpl.legs || [], tpl.etag_amt || "");
  }

  async function quickSubmit(tpl) {
    const reason = tpl.reason || form.reason;
    const err = validate(reason);
    if (err) { setError(err); return; }
    setError(""); setLoading(true);

    const companions = form.companions || tpl.companions || "";
    const people = companions ? companions.split(/[,、]/).filter(Boolean).length + 1 : 1;
    const legs = tpl.legs || [];
    const etagAmt = Number(tpl.etag_amt) || 0;
    const transportAmt = legs.reduce((s, l) =>
      s + (Number(l.amount || l.cost) || 0) + (Number(l.parking) || 0), 0
    ) + etagAmt;

    const payload = {
      name:           form.name,
      title:          form.title || tpl.title || "",
      reason,
      date:           form.date,
      date_from:      form.date,
      date_to:        form.date,
      people,
      companions,
      transport_mode: tpl.transport_mode,
      legs,
      etag_amt:       etagAmt,
      transport_amt:  transportAmt,
    };

    try {
      const res = await api.submitExpense(payload);
      onQuickSubmit?.(res, payload);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const hasTemplates = templates.length > 0 && Boolean(form.name);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">辛苦了！今天去哪工作呀～</h2>
        <p className="text-sm text-slate-500 mt-1">（填寫基本資料後下一頁選擇交通方式）</p>
      </div>

      {/* 🖨️ 列印快捷 */}
      <div className={`card border transition-all ${showPrint ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
        <button
          type="button"
          onClick={() => setShowPrint(p => !p)}
          className="w-full flex items-center justify-between"
        >
          <span className="font-semibold text-slate-700">🖨️ 我想列印報帳單</span>
          <span className="text-xs text-slate-400">{showPrint ? "收起 ▲" : "展開 ▼"}</span>
        </button>

        {showPrint && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">選擇姓名後直接開啟 Google Sheet 列印</p>
            <select
              value={printName}
              onChange={e => setPrintName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">— 選擇姓名 —</option>
              {MEMBERS.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {printName && memberSheets[printName] ? (
              <a
                href={memberSheets[printName]}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex items-center justify-center gap-2 py-3"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                開啟 {printName} 的 Google Sheet
              </a>
            ) : printName && !memberSheets[printName] ? (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                連線中，請稍候…
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 個人資料 */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-700">👤 出差人</h3>

        <div>
          <label className="label">姓名</label>
          <NameChips
            selected={form.name}
            onSelect={name => setForm(f => ({ ...f, name }))}
            excludes={companionList}
          />
        </div>

        <div>
          <label className="label">職稱</label>
          <select className="field" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}>
            <option value="">請選擇…</option>
            {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="label">事由</label>
          <input className="field" value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="拍攝 XXX（客戶名稱）" />
        </div>

        <div>
          <label className="label">日期</label>
          <input type="date" className="field" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>

        <div className="text-xs text-slate-400">單位：嶼嶼行銷（固定）</div>
      </div>

      {/* 同行人 */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-slate-700">👥 同行人</h3>
        <p className="text-xs text-slate-400 -mt-1">有人一起去就點選，人數會自動更新影響膳雜費</p>
        <div>
          <label className="label">同行人（可多選）</label>
          <NameChips
            selected={form.companions}
            onSelect={setCompanions}
            multi={true}
            excludes={form.name ? [form.name] : []}
          />
          {companionList.length > 0 && (
            <div className="mt-2 text-sm text-slate-600">
              共 <b>{form.people} 人</b>出行・膳雜費 {form.people} × 700 = <b>NT$ {mealTotal.toLocaleString()}</b>
            </div>
          )}
        </div>
      </div>

      {/* 常用報帳單（名字選了之後才顯示） */}
      {hasTemplates && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-slate-700">⭐ 常用報帳單</h3>
            <p className="text-xs text-slate-400 mt-0.5">「帶入資料」可繼續修改；「⚡ 一鍵報帳」直接送出</p>
          </div>
          {templates.map(tpl => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              disabled={loading}
              onApply={() => applyTemplate(tpl)}
              onQuickSubmit={() => quickSubmit(tpl)}
              onRemove={() => removeTemplate(tpl.id)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {loading && (
        <div className="text-center py-4 text-slate-500 text-sm animate-pulse">一鍵報帳送出中…</div>
      )}

      {/* 下一步按鈕 */}
      <button className="btn-primary w-full py-4 text-base" onClick={handleNext} disabled={loading}>
        下一步 →
      </button>
    </div>
  );
}
