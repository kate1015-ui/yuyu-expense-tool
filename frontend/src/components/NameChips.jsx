import { useState } from "react";
import { MEMBERS } from "../constants";

/**
 * 姓名 chip 多選 / 單選元件。
 * Props:
 *   selected    string  已選姓名（單選）或逗號/頓號分隔字串（多選）
 *   onSelect    fn      回傳新的選取值
 *   multi       bool    是否多選（預設 false）
 *   excludes    string[]  不顯示的姓名（例：已選的出差人）
 *   noCustom    bool    隱藏「+ 其他」自訂輸入（預設 false）
 */
export default function NameChips({
  selected, onSelect, multi = false, excludes = [], noCustom = false,
}) {
  const [showInput, setShowInput] = useState(false);
  const [customVal, setCustomVal] = useState("");

  function toggle(name) {
    if (!multi) { onSelect(name === selected ? "" : name); return; }
    const arr = selected
      ? [...new Set(selected.split(/[,、]/).map(s => s.trim()).filter(Boolean))]
      : [];
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
              ${on
                ? "bg-brand text-white border-brand"
                : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"}`}>
            {name}{on && <span className="text-xs opacity-80">✕</span>}
          </button>
        );
      })}
      {!noCustom && (showInput ? (
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
      ))}
    </div>
  );
}
