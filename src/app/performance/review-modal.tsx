"use client";

import { useState } from "react";
import { Icon, SvgPath, Button, cn } from "@/components/app-shell";
import type { PiEmployeeRow } from "@/lib/payroll/pay-data";
import type { PerformanceReview, KPIResult, CompetencyScore, AIInsight } from "@/lib/performance/types";
import { toast } from "@/components/toast";
import { 
  ALL_COMPETENCY_DEFINITIONS, 
  SKKNI_COMPETENCIES, 
  BROADCAST_COMPETENCIES, 
  EDITORIAL_COMPETENCIES, 
  SECURITY_COMPETENCIES, 
  ULRICH_COMPETENCIES 
} from "@/lib/competency-framework";

export default function ReviewModal({
  employee,
  period,
  existingReview,
  onSave,
  onClose,
}: {
  employee: PiEmployeeRow;
  period: string;
  existingReview?: PerformanceReview;
  onSave: (review: PerformanceReview) => void;
  onClose: () => void;
}) {
  const [kpis, setKpis] = useState<KPIResult[]>(existingReview?.kpis || [
    { metric: "Pencapaian Target Siaran / Rating Acara", target: "100%", actual: "", score: 3 },
    { metric: "Tingkat Kehadiran & Kedisiplinan", target: ">95%", actual: "", score: 3 },
  ]);

  const getDefaultComps = () => {
    const dept = (employee.department || "").toLowerCase();
    let defs = SKKNI_COMPETENCIES;
    if (dept.includes("penyiaran") || dept.includes("broadcast") || dept.includes("studio") || dept.includes("kamera") || dept.includes("teknis") || dept.includes("mcr") || dept.includes("multimedia")) {
      defs = BROADCAST_COMPETENCIES;
    } else if (dept.includes("redaksi") || dept.includes("jurnalistik") || dept.includes("news") || dept.includes("berita") || dept.includes("reporter") || dept.includes("liputan") || dept.includes("editorial")) {
      defs = EDITORIAL_COMPETENCIES;
    } else if (dept.includes("keamanan") || dept.includes("security") || dept.includes("satpam") || dept.includes("ga")) {
      defs = SECURITY_COMPETENCIES;
    } else if (dept.includes("hr") || dept.includes("personal") || dept.includes("sumber daya") || dept.includes("talent")) {
      defs = ULRICH_COMPETENCIES;
    }
    return defs.slice(0, 4).map(d => ({ code: d.id, title: d.nameId || d.name, desc: d.description }));
  };

  const defaultComps = getDefaultComps();

  const [competencies, setCompetencies] = useState<CompetencyScore[]>(
    existingReview?.competencies || defaultComps.map(c => ({ code: c.code, score: 3, notes: "" }))
  );

  const [aiInsight, setAiInsight] = useState<AIInsight | undefined>(existingReview?.aiInsight);
  const [analyzing, setAnalyzing] = useState(false);

  const updateKpi = (idx: number, patch: Partial<KPIResult>) => {
    setKpis(prev => prev.map((k, i) => i === idx ? { ...k, ...patch } : k));
  };
  const updateComp = (idx: number, patch: Partial<CompetencyScore>) => {
    setCompetencies(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  // Insight disusun berbasis aturan (rata-rata skor → kuadran 9-box → rekomendasi
  // template) — bukan panggilan model AI; dieksekusi instan tanpa delay buatan.
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const avgKpi = kpis.reduce((a, b) => a + b.score, 0) / (kpis.length || 1);
      const avgComp = competencies.reduce((a, b) => a + b.score, 0) / (competencies.length || 1);
      
      const highestComp = [...competencies].sort((a, b) => b.score - a.score)[0];
      const lowestComp = [...competencies].sort((a, b) => a.score - b.score)[0];
      
      const highestDef = ALL_COMPETENCY_DEFINITIONS.find(d => d.id === highestComp?.code);
      const lowestDef = ALL_COMPETENCY_DEFINITIONS.find(d => d.id === lowestComp?.code);

      const strTitle = highestDef ? (highestDef.nameId || highestDef.name) : (defaultComps.find(c => c.code === highestComp?.code)?.title || "Kerja Sama Tim");
      const gapTitle = lowestDef ? (lowestDef.nameId || lowestDef.name) : (defaultComps.find(c => c.code === lowestComp?.code)?.title || "Inisiatif Mandiri");

      const perfScore = Math.min(100, Math.round((avgKpi / 5) * 100));
      const potScore = Math.min(100, Math.round((avgComp / 5) * 100));

      const strengths = [
        `Unggul pada standar SKKNI: ${strTitle} (Skor ${highestComp?.score || 4}/5)`,
        perfScore >= 75 ? "Konsisten melampaui target KPI operasional bulanan" : "Menunjukkan stabilitas eksekusi pada tugas rutin harian",
        potScore >= 75 ? "Memiliki kapasitas kepemimpinan dan adaptasi cepat pada instruksi baru" : "Dapat berkolaborasi dengan baik dalam tim kerja divisi"
      ];

      const gaps = [
        `Perlu pengembangan lebih lanjut pada: ${gapTitle} (Skor ${lowestComp?.score || 3}/5)`,
        perfScore < 60 ? "Perhatian khusus pada evaluasi pencapaian target kuantitatif yang masih di bawah standar" : "Perlu peningkatkan inisiatif pemecahan masalah secara mandiri",
        lowestComp?.notes ? `Catatan reviewer: "${lowestComp.notes}"` : "Komunikasi lintas fungsi masih perlu diintensifkan"
      ];

      let actionPlan = "";
      if (perfScore >= 75 && potScore >= 75) {
        actionPlan = "🌟 Future Leader / Fast-Track: Persiapkan untuk promosi ke level manajerial dalam 6 bulan ke depan dengan penugasan proyek kepemimpinan lintas departemen.";
      } else if (perfScore >= 75 && potScore < 75) {
        actionPlan = "🛡️ Trusted Professional: Pertahankan insentif kinerja operasional siaran dan redaksi serta berikan penghargaan atas keandalan eksekusinya.";
      } else if (perfScore < 60 && potScore >= 75) {
        actionPlan = "🔄 Dilemma / Misalignment: Karyawan berpotensi tinggi namun performa saat ini terhambat. Pertimbangkan rotasi tugas atau penyesuaian lingkungan kerja.";
      } else {
        actionPlan = "📈 Performance Improvement Plan (PIP): Jadwalkan sesi pendampingan (mentoring) dwi-mingguan selama 3 bulan fokus pada pemenuhan standar SKKNI.";
      }

      const insight: AIInsight = {
        performanceScore: perfScore,
        potentialScore: potScore,
        strengths,
        gaps,
        actionPlan,
      };
      setAiInsight(insight);
      toast("Insight 9-Box SKKNI selesai dihitung", "success");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = () => {
    onSave({
      id: existingReview?.id || crypto.randomUUID(),
      employeeId: employee.id,
      period,
      status: aiInsight ? "analyzed" : "submitted",
      kpis,
      competencies,
      aiInsight,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Performance Review</h2>
            <p className="text-sm text-slate-500">{employee.full_name} — {employee.department ?? "No Dept"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold mb-3">1. Key Performance Indicators (KPI)</h3>
            <div className="space-y-3">
              {kpis.map((kpi, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium">{kpi.metric}</p>
                    <p className="text-xs text-slate-500">Target: {kpi.target}</p>
                  </div>
                  <input 
                    placeholder="Actual" 
                    value={kpi.actual} 
                    onChange={e => updateKpi(i, { actual: e.target.value })}
                    className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900" 
                  />
                  <select 
                    value={kpi.score} 
                    onChange={e => updateKpi(i, { score: Number(e.target.value) })}
                    className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3">2. Competency Assessment (SKKNI & Ulrich Framework)</h3>
            <div className="space-y-3">
              {competencies.map((comp, i) => {
                const def = ALL_COMPETENCY_DEFINITIONS.find(d => d.id === comp.code);
                const title = def ? (def.nameId || def.name) : (defaultComps.find(c => c.code === comp.code)?.title || comp.code);
                const desc = def?.description || "";
                return (
                  <div key={i} className="flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                      {desc && <p className="text-[11px] text-slate-500 mb-0.5 line-clamp-1">{desc}</p>}
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{comp.code}</p>
                    </div>
                    <input 
                      placeholder="Catatan / bukti (opsional)" 
                      value={comp.notes || ""} 
                      onChange={e => updateComp(i, { notes: e.target.value })}
                      className="flex-1 min-w-[150px] rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:border-blue-500" 
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-medium">Skor:</span>
                      <select 
                        value={comp.score} 
                        onChange={e => updateComp(i, { score: Number(e.target.value) })}
                        className="w-16 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                      >
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}/5</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">3. Insight 9-Box & Action Plan (Berbasis Aturan)</h3>
              {!aiInsight && (
                <Button size="sm" variant="primary" onClick={handleAnalyze} disabled={analyzing}>
                  <Icon className="h-4 w-4 mr-1"><SvgPath name="chart" /></Icon>
                  {analyzing ? "Menghitung..." : "Hitung Insight"}
                </Button>
              )}
            </div>
            
            {aiInsight ? (
              <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-emerald-600 mb-1">Strengths</p>
                    <ul className="list-disc pl-4 text-sm text-slate-700 dark:text-slate-300">
                      {aiInsight.strengths.map((s,i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-amber-600 mb-1">Competency Gaps</p>
                    <ul className="list-disc pl-4 text-sm text-slate-700 dark:text-slate-300">
                      {aiInsight.gaps.map((s,i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Recommended Action Plan</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{aiInsight.actionPlan}</p>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={handleAnalyze} disabled={analyzing}>
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                Isi form di atas lalu klik Hitung Insight.
              </div>
            )}
          </section>

        </div>
        
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleSave}>Simpan Review</Button>
        </div>
      </div>
    </div>
  );
}
