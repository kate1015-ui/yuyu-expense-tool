/** 第二步：選擇交通方式。 */
export default function StepTransportMode({ onSelect, onBack }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600">← 返回</button>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-800">這次怎麼去的？</h2>
          <p className="text-sm text-slate-500 mt-0.5">選擇交通方式，系統自動帶入對應流程</p>
        </div>
      </div>

      <button
        onClick={() => onSelect("transit")}
        className="w-full card flex items-start gap-4 text-left hover:border-brand hover:shadow-md active:scale-[.98] transition cursor-pointer"
      >
        <span className="text-4xl mt-1">🚇</span>
        <div>
          <div className="text-lg font-bold text-slate-800">大眾交通工具</div>
          <div className="text-sm text-slate-500 mt-0.5">
            捷運、公車、高鐵、台鐵、計程車…<br />
            拍下票根，AI 自動辨識金額
          </div>
        </div>
      </button>

      <button
        onClick={() => onSelect("drive")}
        className="w-full card flex items-start gap-4 text-left hover:border-brand hover:shadow-md active:scale-[.98] transition cursor-pointer"
      >
        <span className="text-4xl mt-1">🚗</span>
        <div>
          <div className="text-lg font-bold text-slate-800">自行開車</div>
          <div className="text-sm text-slate-500 mt-0.5">
            填寫起點與終點<br />
            系統自動計算里程，每公里 8 元
          </div>
        </div>
      </button>
    </div>
  );
}
