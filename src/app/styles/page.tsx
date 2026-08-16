import Link from "next/link";

const styles = [
  {
    key: "minimal",
    title: "現代簡約風 ✅ 目前主線",
    desc: "白底卡片、細邊框、克制配色，適合資訊密集的攻略站。",
    preview: "bg-slate-100",
    textClass: "text-slate-700",
  },
  {
    key: "retro",
    title: "復古像素風",
    desc: "亮色系、粗黑邊框、跳動按鈕，重現老楓之谷的懷舊感。",
    preview: "bg-gradient-to-br from-orange-300 via-pink-300 to-yellow-300",
    textClass: "text-orange-900",
  },
  {
    key: "dark",
    title: "深色遊戲儀表板",
    desc: "深色背景、玻璃霧面卡片、霓虹漸層，電競儀表板風格。",
    preview: "bg-gradient-to-br from-indigo-950 via-slate-900 to-black",
    textClass: "text-cyan-300",
  },
];

export default function Gallery() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-6">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-800">🍁 楓谷工具箱 — UI 風格預覽</h1>
        <p className="text-slate-500 mt-2">
          目前開發主線是「現代簡約風」，其他兩個風格保留作為樣式參考。
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {styles.map((s) => (
          <Link
            key={s.key}
            href={`/${s.key}`}
            className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-lg transition-shadow"
          >
            <div className={`h-40 ${s.preview} flex items-center justify-center text-4xl`}>🍁</div>
            <div className="p-5 text-left">
              <div className={`font-bold text-lg ${s.textClass}`}>{s.title}</div>
              <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
              <div className="text-sm text-indigo-600 mt-3 group-hover:underline">進入預覽 →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
