import { useRef, useState } from "react";
import { api } from "../api/client";

/** 收據上傳 — Mobile First。
 *  - 手機: capture="environment" 會直接開相機
 *  - 桌機: 點「從檔案選擇」走一般上傳
 */
export default function UploadReceipt({ onRecognized }) {
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file) return;
    setError("");
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const res = await api.recognizeReceipt(file);
      onRecognized?.(res.suggested, res.recognition);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">📸 上傳收據 / 電子發票</h2>
        <p className="text-sm text-slate-500 mt-1">
          拍下或選取一張照片, AI 會自動辨識日期、商家與金額。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="btn-primary"
          onClick={() => cameraRef.current?.click()}
          disabled={loading}
        >
          📷 拍照
        </button>
        <button
          className="btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
        >
          🖼️ 從檔案選擇
        </button>
      </div>

      {/* 手機用 — 呼叫後置鏡頭 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {/* 桌機用 — 一般檔案選擇 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview && (
        <div className="rounded-xl overflow-hidden border border-slate-200">
          <img src={preview} alt="收據預覽" className="w-full object-contain max-h-80 bg-slate-50" />
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-brand">
          <div className="h-4 w-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span>AI 辨識中…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
