import { api } from "../api/client";

export default function SuccessModal({ data, onClose }) {
  if (!data) return null;

  const reportUrl = api.reportUrl({
    expense_id: data.expense_id,
    submitted_at: data.submitted_at,
    date: data.date,
    item: data.item,
    amount: data.amount,
    department: data.department,
    project: data.project,
    category: data.category || "",
    source: data.source || "manual",
    raw_ocr: data.raw_ocr || "",
    note: data.note || "",
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-[slideUp_.2s_ease]">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800">報帳已儲存</h3>
          <p className="text-sm text-slate-500 mt-1">
            單號 <code className="bg-slate-100 px-1 rounded">{data.expense_id}</code> 已寫入 Google Sheets。
          </p>
        </div>

        <div className="mt-5 bg-slate-50 rounded-xl p-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">日期</span><span>{data.date}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">項目</span><span className="truncate ml-3 max-w-[60%]">{data.item}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">金額</span><span className="text-brand font-bold">NT$ {Number(data.amount).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">部門 / 專案</span><span>{data.department} / {data.project}</span></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn-ghost" onClick={onClose}>繼續報帳</button>
          <a className="btn-primary" href={reportUrl} target="_blank" rel="noreferrer">
            🖨️ 產出報帳單
          </a>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
