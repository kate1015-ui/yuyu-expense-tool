import { useState } from "react";
import StepStart         from "./components/StepStart";
import StepTransportMode from "./components/StepTransportMode";
import StepTransit       from "./components/StepTransit";
import StepDrive         from "./components/StepDrive";
import StepConfirm       from "./components/StepConfirm";
import { api }           from "./api/client";

function SuccessScreen({ result, onReset }) {
  const [dlLoading, setDlLoading] = useState(false);
  const [dlError, setDlError]     = useState("");

  async function downloadExcel() {
    setDlError(""); setDlLoading(true);
    try {
      await api.downloadExpense({
        ...result,
        transport_amt: Number(result?.transport_amt || 0),
        people:        Number(result?.people        || 1),
      });
    } catch (e) {
      setDlError(e.message);
    } finally {
      setDlLoading(false);
    }
  }

  return (
    <div className="card text-center py-10 space-y-5">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-800">報帳已送出！</h2>
        <p className="text-sm text-slate-500 mt-2">
          已新增分頁 <b className="text-slate-800">「{result?.tab_name}」</b><br />
          到 <b>{result?.name}</b> 的 Google Sheet
        </p>
        <div className="mt-3 bg-slate-50 rounded-xl px-5 py-3 inline-block text-sm">
          合計 <span className="text-brand font-bold text-base">NT$ {Number(result?.grand_total || 0).toLocaleString()}</span>
        </div>
      </div>
      <div className="space-y-3 pt-2">
        {result?.sheet_url && (
          <a href={result.sheet_url} target="_blank" rel="noreferrer"
            className="btn-primary w-full max-w-xs mx-auto flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            開啟 Google Sheet 列印
          </a>
        )}
        <button className="btn-ghost w-full max-w-xs mx-auto block" onClick={downloadExcel} disabled={dlLoading}>
          {dlLoading ? "產生中…" : "📥 下載 Excel（備用）"}
        </button>
        {dlError && <p className="text-xs text-red-500">{dlError}</p>}
        <button className="btn-ghost w-full max-w-xs mx-auto block" onClick={onReset}>
          繼續新增報帳
        </button>
      </div>
    </div>
  );
}

// step: 0=填資料, 1=選交通, 2=路程詳細, 3=確認送出, 4=完成
const STEP_LABELS = ["填寫資料", "選擇交通", "路程詳細", "確認送出"];

export default function App() {
  const [step, setStep]               = useState(0);
  const [mode, setMode]               = useState(null);
  const [basicData, setBasicData]     = useState(null);   // 第一頁資料（記憶用）
  const [transportData, setTransportData] = useState(null);
  const [initialLegs, setInitialLegs] = useState(null);   // 交通路段草稿（返回時記憶）
  const [initialEtag, setInitialEtag] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  function reset() {
    setStep(0); setMode(null); setBasicData(null);
    setTransportData(null); setInitialLegs(null);
    setInitialEtag(""); setSubmitResult(null);
  }

  // ── 步驟 0 → 1：下一步 ───────────────────────────────
  function handleNext(formData) {
    setBasicData(formData);        // 記憶第一頁資料
    setMode(null);
    setInitialLegs(null);
    setInitialEtag("");
    setStep(1);
  }

  // ── 步驟 0：模板「帶入資料」→ 直接到步驟 2 ──────────
  function handleSelectMode(m, formData, templateLegs, templateEtag) {
    setMode(m);
    setBasicData(formData);
    setInitialLegs(templateLegs || null);
    setInitialEtag(String(templateEtag || ""));
    setStep(2);
  }

  // ── 步驟 0：模板「⚡ 一鍵報帳」→ 直接完成 ────────────
  function handleQuickSubmit(res, payload) {
    setSubmitResult({ ...res, ...payload });
    setStep(4);
  }

  // ── 步驟 1：選擇交通方式 → 步驟 2 ───────────────────
  function handleModeSelect(m) {
    setMode(m);
    setInitialLegs(null);
    setInitialEtag("");
    setStep(2);
  }

  // ── 步驟 2：路程完成 → 步驟 3 ───────────────────────
  function handleTransportDone(data) {
    setTransportData(data);
    setStep(3);
  }

  // ── 步驟 2：返回（記憶路程草稿） ──────────────────────
  // StepTransit 傳回 legs，StepDrive 傳回 (legs, etag)
  function handleTransportBack(legs, etag) {
    setInitialLegs(legs?.length > 0 ? legs : null);
    if (etag !== undefined) setInitialEtag(String(etag || ""));
    setStep(1);
  }

  // ── 步驟 3：確認送出成功 ───────────────────────────────
  function handleConfirmDone(res, payload) {
    setSubmitResult({ ...res, ...payload });
    setStep(4);
  }

  const barStep = Math.min(step, 3);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-800">嶼嶼行銷・出差報帳</h1>
            <p className="text-xs text-slate-400">自動填寫出差旅費報告表</p>
          </div>
          {step > 0 && step < 4 && (
            <button onClick={reset} className="text-xs text-slate-400 underline">重新開始</button>
          )}
        </div>

        {/* 進度條 */}
        {step < 4 && (
          <div className="max-w-lg mx-auto px-4 pb-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= barStep ? "bg-brand" : "bg-slate-200"}`} />
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-1">{STEP_LABELS[barStep]}</div>
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-24">
        {/* 步驟 0：填寫基本資料（帶入 basicData 記憶） */}
        {step === 0 && (
          <StepStart
            initialData={basicData}
            onNext={handleNext}
            onSelectMode={handleSelectMode}
            onQuickSubmit={handleQuickSubmit}
          />
        )}

        {/* 步驟 1：選擇交通方式 */}
        {step === 1 && (
          <StepTransportMode
            onSelect={handleModeSelect}
            onBack={() => setStep(0)}
          />
        )}

        {/* 步驟 2：路程詳細（大眾交通） */}
        {step === 2 && mode === "transit" && (
          <StepTransit
            initialLegs={initialLegs}
            onDone={handleTransportDone}
            onBack={handleTransportBack}
          />
        )}

        {/* 步驟 2：路程詳細（自行開車） */}
        {step === 2 && mode === "drive" && (
          <StepDrive
            initialLegs={initialLegs}
            initialEtag={initialEtag}
            onDone={handleTransportDone}
            onBack={handleTransportBack}
          />
        )}

        {/* 步驟 3：確認送出 */}
        {step === 3 && (
          <StepConfirm
            basicData={basicData}
            transportData={transportData}
            onBack={() => setStep(2)}
            onDone={handleConfirmDone}
          />
        )}

        {/* 完成畫面 */}
        {step === 4 && (
          <SuccessScreen result={submitResult} onReset={reset} />
        )}

        <p className="text-center text-xs text-slate-300 pt-8">Powered by Kate Zhang</p>
      </main>
    </div>
  );
}
