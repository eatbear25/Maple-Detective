const guides = [
  { title: "楓葉新手村 5人本推薦配置", tag: "Lv.1-20", desc: "劍士頂前排、法師遠程輸出，新手最穩配置。" },
  { title: "紅寶王 頭目速刷組隊", tag: "Lv.15-25", desc: "建議 4 人：坦一、輸出二、補師一，注意王的突進技能。" },
  { title: "熾熱沙漠 練功隊組建心法", tag: "Lv.13-30", desc: "分工採集與清怪，效率翻倍的地圖走位建議。" },
];

export default function DarkPartyPage() {
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-bold text-white tracking-wide">組隊攻略</h1>
      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-200 text-sm px-4 py-3">
        這個版面預留給「組隊攻略」內容，之後會加入職業搭配、王本流程、語音頻道招募等功能。
      </div>
      <div className="space-y-3">
        {guides.map((g) => (
          <div key={g.title} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-100">{g.title}</div>
              <span className="text-xs bg-white/10 text-slate-300 rounded-full px-2 py-0.5">{g.tag}</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{g.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
