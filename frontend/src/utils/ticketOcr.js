import { createWorker } from "tesseract.js";

// ── 站名清單 ────────────────────────────────────────────────
const THSR_STATIONS = [
  "南港", "台北", "板橋", "桃園", "新竹", "苗栗",
  "台中", "彰化", "雲林", "嘉義", "台南", "左營",
];
const TRA_STATIONS = [
  "基隆", "八堵", "七堵", "五堵", "暖暖", "汐止",
  "南港", "台北", "萬華", "板橋", "樹林", "鶯歌", "桃園", "中壢",
  "新竹", "竹南", "苗栗", "台中", "彰化", "員林", "田中", "二水",
  "斗六", "斗南", "嘉義", "水上", "台南", "保安", "高雄", "鳳山",
  "屏東", "潮州", "枋寮", "花蓮", "光復", "玉里", "台東",
];

// ── 高鐵票價（單程、對稱，NTD）────────────────────────────
// 索引: 南港=0, 台北=1, 板橋=2, 桃園=3, 新竹=4, 苗栗=5,
//       台中=6, 彰化=7, 雲林=8, 嘉義=9, 台南=10, 左營=11
const THSR_FARE_MATRIX = [
//  南  北  橋  桃  竹  栗  中  化  林  義  南  左
  [  0, 30, 50,190,320,400,700,770,870,1060,1380,1520], // 南港
  [ 30,  0, 25,160,290,370,670,740,840,1030,1350,1490], // 台北
  [ 50, 25,  0,145,275,350,650,720,820,1010,1330,1470], // 板橋
  [190,160,145,  0,140,215,510,580,680, 870,1190,1330], // 桃園
  [320,290,275,140,  0, 95,380,450,550, 740,1060,1190], // 新竹
  [400,370,350,215, 95,  0,290,360,455, 645, 965,1100], // 苗栗
  [700,670,650,510,380,290,  0, 75,175, 360, 680, 790], // 台中
  [770,740,720,580,450,360, 75,  0,105, 290, 610, 740], // 彰化
  [870,840,820,680,550,455,175,105,  0, 190, 510, 640], // 雲林
  [1060,1030,1010,870,740,645,360,290,190,  0, 320, 450], // 嘉義
  [1380,1350,1330,1190,1060,965,680,610,510,320,  0, 140], // 台南
  [1520,1490,1470,1330,1190,1100,790,740,640,450,140,  0], // 左營
];

function thsrFare(a, b) {
  const i = THSR_STATIONS.indexOf(a);
  const j = THSR_STATIONS.indexOf(b);
  if (i < 0 || j < 0) return null;
  return THSR_FARE_MATRIX[i][j];
}

// ── 台鐵票價（主要對） ──────────────────────────────────────
const TRA_FARES = {
  "台北-基隆": 41, "台北-新竹": 114, "台北-台中": 375,
  "台北-彰化": 426, "台北-嘉義": 568, "台北-台南": 689,
  "台北-高雄": 845, "台北-花蓮": 440, "台北-台東": 783,
  "台中-嘉義": 218, "台中-台南": 339, "台中-高雄": 506,
  "嘉義-台南": 127, "嘉義-高雄": 294, "台南-高雄": 167,
  "高雄-屏東": 52, "高雄-花蓮": 674, "花蓮-台東": 342,
  "新竹-台中": 262, "桃園-台中": 303,
};

function traFare(a, b) {
  const key = `${a}-${b}`;
  const rev = `${b}-${a}`;
  return TRA_FARES[key] ?? TRA_FARES[rev] ?? null;
}

// ── 主要辨識函式 ──────────────────────────────────────────
export async function recognizeTicket(imageFile, tool, onProgress) {
  onProgress?.("辨識中…（約 10-20 秒）");

  const worker = await createWorker(["chi_tra", "eng"], 1, {
    logger: m => {
      if (m.status === "recognizing text") {
        onProgress?.(`辨識中… ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  let text = "";
  try {
    const { data } = await worker.recognize(imageFile);
    text = data.text || "";
  } finally {
    await worker.terminate();
  }

  // 找站名
  const stationList = tool === "高鐵" ? THSR_STATIONS : TRA_STATIONS;
  const found = stationList.filter(s => text.includes(s));

  if (found.length < 2) {
    return { ok: false, error: "無法辨識站名，請手動輸入", rawText: text };
  }

  // 取前兩個
  const origin = found[0];
  const destination = found[1];

  // 查票價
  const fare = tool === "高鐵" ? thsrFare(origin, destination) : traFare(origin, destination);

  return { ok: true, origin, destination, fare, rawText: text };
}
