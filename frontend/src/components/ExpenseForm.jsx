import { useEffect, useState } from "react";
import { api } from "../api/client";

const DEPARTMENTS = ["業務", "研發", "行政"];

/** 「辨識/計算結果 → 可直接修改的預覽表單」. */
export default function ExpenseForm({ prefill, onSaved, onReset }) {
  const [form, setForm] = useState({
    date: "", item: "", amount: "", department: "",
    project: "", category: "", source: "manual", raw_ocr: "", note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (prefill) setForm((f) => ({ ...f, ...prefill }));
  }, [prefill]);

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await api.submitExpense({ ...form, amount: Number(form.amount) });
      onSaved?.({ ...form, ...res });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">📝 確認報帳明細</h2>
        {onReset && (
          <button type="button" onClick={onReset} className="text-sm text-slate-500 underline">
            重新開始
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">日期</label>
          <input type="date" className="field" value={form.date} onChange={update("date")} required />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">金額 (NTD)</label>
          <input type="number" min="1" className="field" value={form.amount} onChange={update("amount")} required />
        </div>

        <div className="col-span-2">
          <label className="label">項目</label>
          <input className="field" value={form.item} onChange={update("item")} required />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="label">部門</label>
          <select className="field" value={form.department} onChange={update("department")} required>
            <option value="">請選擇…</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">專案名稱</label>
          <input className="field" value={form.project} onChange={update("project")} required placeholder="手填" />
        </div>

        <div className="col-span-2">
          <label className="label">備註 (選填)</label>
          <input className="field" value={form.note} onChange={update("note")} />
        </div>
      </div>

      {form.raw_ocr && (
        <details className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          <summary className="cursor-pointer">查看原始辨識 / 計算內容 (留痕)</summary>
          <pre className="whitespace-pre-wrap mt-2">{form.raw_ocr}</pre>
        </details>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <button className="btn-primary w-full" disabled={submitting}>
        {submitting ? "儲存中…" : "✅ 確認並送出報帳"}
      </button>
    </form>
  );
}
