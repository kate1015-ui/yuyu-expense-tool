import { useState } from "react";
import StepStart         from "./components/StepStart";
import StepTransportMode from "./components/StepTransportMode";
import StepTransit       from "./components/StepTransit";
import StepDrive         from "./components/StepDrive";
import StepConfirm       from "./components/StepConfirm";

// 外部憑證/明細查詢頁
const HSR_ETICKET_URL = "https://ptis.thsrc.com.tw/ptis/#";
const ETAG_URL        = "https://www.fetc.net.tw/";

function buildMapsUrl(origin, destination) {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function SuccessScreen({ result, onReset }) {
  // 判斷需要顯示哪些憑證下載連結
  const needHsrEticket = !!result?.has_hsr_electronic
    || (Array.isArray(result?.legs) && result.legs.some(l => l?.tool === "高鐵" && l?.hsrTicketType === "electronic"));
  const needEtag = Number(result?.etag_amt || 0) > 0;

  // 自行開車模式：每段路線都需要 Google Maps 截圖佐證
  const driveLegs = (result?.transport_mode === "drive" && Array.isArray(result?.legs))
    ? result.legs.filter(l => l?.origin && l?.destination)
    : [];
  const needDriveMaps = driveLegs.length > 0;

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

      {/* 憑證提醒區塊（自行開車路線 / 高鐵電子票 / eTAG）*/}
      {(needDriveMaps || needHsrEticket || needEtag) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm space-y-3">
          <p className="font-medium text-amber-800">📎 別忘了補上憑證</p>

          {needDriveMaps && driveLegs.map((leg, i) => (
            <a key={`map-${i}`}
              href={buildMapsUrl(leg.origin, leg.destination)}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-amber-800 hover:bg-amber-100 transition">
              <span className="truncate pr-2">
                🗺️ 路段 {i + 1} 路線：{leg.description || `${leg.origin}→${leg.destination}`}
              </span>
              <span className="text-xs flex-shrink-0">↗</span>
            </a>
          ))}

          {needHsrEticket && (
            <a href={HSR_ETICKET_URL} target="_blank" rel="noreferrer"
              className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-amber-800 hover:bg-amber-100 transition">
              <span>🚄 下載高鐵電子車票明細</span>
              <span className="text-xs">↗</span>
            </a>
          )}
          {needEtag && (
            <a href={ETAG_URL} target="_blank" rel="noreferrer"
              className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-amber-800 hover:bg-amber-100 transition">
              <span>🛣️ 查詢 eTag 過路費明細</span>
              <span className="text-xs">↗</span>
            </a>
          )}
        </div>
      )}

      <div className="space-y-3 pt-2">
        {result?.sheet_url && (
          <a href={result.sheet_url} target="_blank" rel="noreferrer"
            className="btn-primary w-full max-w-xs mx-auto flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            開啟 Google Sheet 列印
          </a>
        )}
        <button className="btn-ghost w-full max-w-xs mx-auto block" onClick={onReset}>
          繼續新增報帳
        </button>
      </div>
    </div>
  );
}

const STEP_LABELS = ["填寫資料", "選擇交通", "路程詳細", "確認送出"];

export default function App() {
  const [step, setStep]               = useState(0);
  const [mode, setMode]               = useState(null);
  const [basicData, setBasicData]     = useState(null);
  const [transportData, setTransportData] = useState(null);
  const [initialLegs, setInitialLegs] = useState(null);
  const [initialEtag, setInitialEtag] = useState("");
  const [initialCompanions, setInitialCompanions] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  function reset() {
    setStep(0); setMode(null); setBasicData(null);
    setTransportData(null); setInitialLegs(null);
    setInitialEtag(""); setInitialCompanions(""); setSubmitResult(null);
  }

  // ── 步驟 0 → 1 ───────────────────────────────────────────
  function handleNext(formData) {
    setBasicData(formData);
    setMode(null); setInitialLegs(null); setInitialEtag(""); setInitialCompanions("");
    setStep(1);
  }

  // ── 步驟 0：模板「帶入資料」→ 直接到步驟 2 ──────────────
  function handleSelectMode(m, formData, templateLegs, templateEtag, templateCompanions) {
    setMode(m);
    setBasicData(formData);
    setInitialLegs(templateLegs || null);
    setInitialEtag(String(templateEtag || ""));
    setInitialCompanions(templateCompanions || "");
    setStep(2);
  }

  // ── 步驟 0：模板「⚡ 一鍵報帳」→ 直接完成 ────────────────
  function handleQuickSubmit(res, payload) {
    setSubmitResult({ ...res, ...payload });
    setStep(4);
  }

  // ── 步驟 1：選擇交通方式 → 步驟 2 ───────────────────────
  function handleModeSelect(m) {
    setMode(m);
    setInitialLegs(null); setInitialEtag(""); setInitialCompanions("");
    setStep(2);
  }

  // ── 步驟 2：路程完成 → 步驟 3 ───────────────────────────
  function handleTransportDone(data) {
    setTransportData(data);
    setStep(3);
  }

  // ── 步驟 2：返回（記憶路程草稿 + 同行人） ────────────────
  function handleTransportBack(legs, etag, companions) {
    setInitialLegs(legs?.length > 0 ? legs : null);
    if (etag !== undefined)       setInitialEtag(String(etag || ""));
    if (companions !== undefined) setInitialCompanions(companions || "");
    setStep(1);
  }

  // ── 步驟 3：返回步驟 2（記憶交通資料） ───────────────────
  function handleBackFromConfirm() {
    if (transportData) {
      // 濾掉複製代墊段，讓 StepTransit 重新依勾選產生
      const cleanLegs = (transportData.legs || []).filter(l => !l.isCompanionCopy);
      setInitialLegs(cleanLegs.length > 0 ? cleanLegs : null);
      if (transportData.etag_amt !== undefined)
        setInitialEtag(String(transportData.etag_amt || ""));
      setInitialCompanions(transportData.companions || "");
    }
    setStep(2);
  }

  // ── 步驟 3：確認送出成功 ─────────────────────────────────
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
        {step === 0 && (
          <StepStart
            initialData={basicData}
            onNext={handleNext}
            onSelectMode={handleSelectMode}
            onQuickSubmit={handleQuickSubmit}
          />
        )}

        {step === 1 && (
          <StepTransportMode onSelect={handleModeSelect} onBack={() => setStep(0)} />
        )}

        {step === 2 && mode === "transit" && (
          <StepTransit
            initialLegs={initialLegs}
            initialCompanions={initialCompanions}
            userName={basicData?.name}
            onDone={handleTransportDone}
            onBack={handleTransportBack}
          />
        )}

        {step === 2 && mode === "drive" && (
          <StepDrive
            initialLegs={initialLegs}
            initialEtag={initialEtag}
            initialCompanions={initialCompanions}
            userName={basicData?.name}
            onDone={handleTransportDone}
            onBack={handleTransportBack}
          />
        )}

        {step === 3 && (
          <StepConfirm
            basicData={basicData}
            transportData={transportData}
            onBack={handleBackFromConfirm}
            onDone={handleConfirmDone}
          />
        )}

        {step === 4 && (
          <SuccessScreen result={submitResult} onReset={reset} />
        )}

        <p className="text-center text-xs text-slate-300 pt-8">Powered by Kate Zhang</p>
      </main>
    </div>
  );
}
