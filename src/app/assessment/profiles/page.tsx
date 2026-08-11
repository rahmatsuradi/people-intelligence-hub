"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Profil Jabatan — "menyiapkan tes sesuai posisi dan permintaan perusahaan".

   Di sinilah tes yang sama diberi arti yang berbeda per posisi: skala mana yang
   dinilai, rentang sten yang diinginkan, bobot relatif, dan ambang kritis yang
   tidak boleh dilanggar.

   TEMPLATE TIDAK PERNAH DITIMPA. Menyunting template bawaan menghasilkan SALINAN
   milik perusahaan (source='custom', tenant_id terisi, id berakhiran -CUST-xxxx).
   Alasannya: template bawaan dipakai lintas perusahaan pada instance yang sama,
   dan perubahan satu perusahaan tidak boleh diam-diam mengubah perusahaan lain.
═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { ALL_SCALES, SCALE_BY_ID } from "@/lib/assessment/scales";
import { jobProfileToRow, loadJobProfiles, loadNormGroups } from "@/lib/assessment/assessment-data";
import { MIN_LOCAL_NORM_N } from "@/lib/assessment/norms";
import type { JobProfile, NormGroup, ProfileRequirement, ScaleId } from "@/lib/assessment/types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const DIRECTION_LABELS: Record<ProfileRequirement["direction"], string> = {
  higher: "Makin tinggi makin baik",
  lower: "Makin rendah makin baik",
  midrange: "Harus di rentang tengah",
};

export default function JobProfilesPage() {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [source, setSource] = useState<"db" | "default">("default");
  const [norms, setNorms] = useState<NormGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<JobProfile | null>(null);

  const tenantId = typeof window !== "undefined" ? getActiveCompanyId() : "";

  const refresh = useCallback(async () => {
    setLoading(true);
    const [profRes, normRes] = await Promise.all([loadJobProfiles(supabase, tenantId), loadNormGroups(supabase)]);
    setProfiles(profRes.data);
    setSource(profRes.source);
    setNorms(normRes.data);
    // "Tabel belum ada" bukan kegagalan: fallback ke template bawaan memang
    // jalur yang dirancang, dan sudah dijelaskan lewat banner kuning di bawah.
    // Menampilkannya lagi sebagai error merah membuat halaman yang berfungsi
    // terbaca seolah rusak.
    const missingTable = profRes.error && /relation .* does not exist|schema cache/i.test(profRes.error);
    setError(missingTable ? "" : (profRes.error ?? ""));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeNorm = norms[0] ?? null;

  return (
    <AppShell
      activeNavId="assessment"
      title="Profil Jabatan Asesmen"
      subtitle="Menentukan skala, rentang target, dan ambang kritis per posisi"
      headerActions={<Link href="/assessment"><Button variant="secondary">Kembali ke Konsol</Button></Link>}
    >
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="flex gap-3">
          <Icon className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"><SvgPath name="warning" /></Icon>
          <div className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
            <p className="font-semibold">Status profil ini: template, bukan hasil job analysis</p>
            <p className="mt-1">
              Rentang target di bawah disusun dari penalaran praktik, belum dari studi yang menghubungkan skor dengan
              kinerja pemangku jabatan di perusahaan Anda. Profil yang benar-benar sahih dibangun dengan cara: skor
              karyawan yang sedang menjabat dikumpulkan, dibandingkan dengan penilaian kinerja mereka, lalu rentangnya
              disetel dari data itu. Sunting angka di sini bila Anda punya dasar yang lebih baik — setiap syarat wajib
              disertai alasan supaya keputusan seleksi bisa diaudit.
            </p>
          </div>
        </div>
      </Card>

      {/* Status norma — menentukan makna semua angka sten di profil */}
      {activeNorm && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Kelompok norma aktif</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {activeNorm.label} · berlaku sejak {activeNorm.effectiveDate}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                activeNorm.provenance === "synthetic_demo"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
              )}
            >
              {activeNorm.provenance === "synthetic_demo" ? "Sintetis (demo)" : `Sampel lokal · n = ${activeNorm.sampleSize}`}
            </span>
          </div>
          {activeNorm.provenance === "synthetic_demo" && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Selama norma masih sintetis, rentang sten di profil jabatan berfungsi sebagai urutan prioritas antar-kandidat,
              bukan sebagai ambang kelulusan. Norma lokal dapat dibangun setelah terkumpul minimal {MIN_LOCAL_NORM_N} peserta
              pada populasi yang sebanding, dan dimasukkan sebagai baris baru di <span className="font-mono">pi_assessment_norms</span> —
              bukan menimpa baris lama, agar laporan lama tetap dapat dihitung ulang.
            </p>
          )}
        </Card>
      )}

      {source === "default" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Profil dibaca dari template bawaan di kode — tabel <span className="font-mono">pi_assessment_profiles</span> belum
            terisi. Jalankan <span className="font-mono">supabase/assessment-module-schema.sql</span> lalu{" "}
            <span className="font-mono">assessment-module-seed.sql</span> agar profil bisa disunting dan disimpan.
          </p>
        </Card>
      )}

      {loading ? (
        <Card><p className="text-sm text-slate-500">Memuat…</p></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} onEdit={() => setEditing(p)} canEdit={isSupabaseConfigured && source === "db"} />
          ))}
        </div>
      )}

      {editing && (
        <ProfileEditor
          profile={editing}
          tenantId={tenantId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </AppShell>
  );
}

function ProfileCard({ profile, onEdit, canEdit }: { profile: JobProfile; onEdit: () => void; canEdit: boolean }) {
  const sorted = useMemo(() => [...profile.requirements].sort((a, b) => b.weight - a.weight), [profile.requirements]);

  return (
    <Card padding={false}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{profile.name}</p>
            <span className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              profile.source === "custom"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
            )}>
              {profile.source === "custom" ? "Custom" : "Template"}
            </span>
          </div>
          <p className="text-xs text-slate-500">{profile.level} · {profile.family}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onEdit} disabled={!canEdit}>Sunting</Button>
      </div>

      <div className="px-5 py-3">
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{profile.description}</p>

        <div className="mt-3 space-y-1.5">
          {sorted.map((r) => (
            <div key={r.scaleId} className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 rounded bg-slate-100 px-1 py-0.5 text-center font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                ×{r.weight}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                {SCALE_BY_ID[r.scaleId]?.name ?? r.scaleId}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">sten {r.targetStenMin}–{r.targetStenMax}</span>
              {r.criticalMinSten !== null && (
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                  kritis ≥{r.criticalMinSten}
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Ambang: direkomendasikan ≥ {profile.recommendThreshold} · dipertimbangkan ≥ {profile.considerThreshold}
        </p>
      </div>
    </Card>
  );
}

/* ─── Editor profil ─── */

function ProfileEditor({
  profile,
  tenantId,
  onClose,
  onSaved,
}: {
  profile: JobProfile;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<JobProfile>(() => structuredClone(profile));
  const [saving, setSaving] = useState(false);

  const isTemplate = profile.source === "template";
  // Id salinan bersifat deterministik: menyimpan berulang kali memperbarui baris
  // yang sama, bukan membuat profil baru setiap kali tombol simpan ditekan.
  const targetId = isTemplate ? `${profile.id}-CUST-${tenantId.slice(0, 4).toUpperCase()}` : profile.id;

  const setReq = (idx: number, patch: Partial<ProfileRequirement>) =>
    setDraft((d) => ({
      ...d,
      requirements: d.requirements.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const addReq = () => {
    const used = new Set(draft.requirements.map((r) => r.scaleId));
    const next = ALL_SCALES.find((s) => !used.has(s.id));
    if (!next) return;
    setDraft((d) => ({
      ...d,
      requirements: [
        ...d.requirements,
        { scaleId: next.id, targetStenMin: 5, targetStenMax: 10, weight: 1, direction: "higher", criticalMinSten: null, rationale: "" },
      ],
    }));
  };

  const removeReq = (idx: number) =>
    setDraft((d) => ({ ...d, requirements: d.requirements.filter((_, i) => i !== idx) }));

  const validate = (): string | null => {
    if (!draft.name.trim()) return "Nama profil wajib diisi.";
    if (draft.requirements.length === 0) return "Minimal satu skala harus dinilai.";
    if (draft.considerThreshold >= draft.recommendThreshold)
      return "Ambang 'dipertimbangkan' harus lebih kecil dari ambang 'direkomendasikan'.";
    const seen = new Set<ScaleId>();
    for (const r of draft.requirements) {
      if (seen.has(r.scaleId)) return `Skala ${SCALE_BY_ID[r.scaleId]?.name ?? r.scaleId} muncul dua kali.`;
      seen.add(r.scaleId);
      if (r.targetStenMin > r.targetStenMax) return `Rentang target ${SCALE_BY_ID[r.scaleId]?.name} terbalik.`;
      if (r.weight <= 0) return "Bobot harus lebih besar dari nol.";
      if (r.criticalMinSten !== null && r.criticalMinSten > r.targetStenMax)
        return `Ambang kritis ${SCALE_BY_ID[r.scaleId]?.name} melebihi batas atas targetnya — mustahil dipenuhi.`;
      if (!r.rationale.trim())
        return `Alasan untuk ${SCALE_BY_ID[r.scaleId]?.name ?? r.scaleId} wajib diisi — keputusan seleksi harus bisa diaudit.`;
    }
    return null;
  };

  const save = async () => {
    if (!supabase) return;
    const problem = validate();
    if (problem) {
      toast(problem, "error");
      return;
    }
    setSaving(true);
    const row = jobProfileToRow({ ...draft, id: targetId, source: "custom" }, tenantId);
    const { error } = await supabase.from("pi_assessment_profiles").upsert({ ...row, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast(`Gagal menyimpan: ${error.message}`, "error");
      return;
    }
    toast(isTemplate ? "Salinan profil perusahaan dibuat." : "Profil diperbarui.");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Sunting Profil Jabatan</h2>
            <p className="text-xs text-slate-500">
              {isTemplate
                ? `Template bawaan tidak diubah — penyimpanan membuat salinan perusahaan (${targetId})`
                : `Memperbarui profil custom ${targetId}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama profil</label>
              <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Level</label>
              <select className={inputCls} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as JobProfile["level"] })}>
                <option value="staff">Staff</option>
                <option value="supervisor">Supervisor</option>
                <option value="specialist">Specialist</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi tuntutan jabatan</label>
            <textarea
              className={cn(inputCls, "min-h-[70px] resize-y")}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Skala yang dinilai</label>
              <Button size="sm" variant="secondary" onClick={addReq}>+ Tambah skala</Button>
            </div>

            <div className="space-y-3">
              {draft.requirements.map((r, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Skala</label>
                      <select className={inputCls} value={r.scaleId} onChange={(e) => setReq(idx, { scaleId: e.target.value as ScaleId })}>
                        {ALL_SCALES.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Sten min</label>
                      <input type="number" min={1} max={10} className={inputCls} value={r.targetStenMin}
                        onChange={(e) => setReq(idx, { targetStenMin: Number(e.target.value) })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Sten maks</label>
                      <input type="number" min={1} max={10} className={inputCls} value={r.targetStenMax}
                        onChange={(e) => setReq(idx, { targetStenMax: Number(e.target.value) })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Bobot</label>
                      <input type="number" min={1} max={5} className={inputCls} value={r.weight}
                        onChange={(e) => setReq(idx, { weight: Number(e.target.value) })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Kritis ≥</label>
                      <input type="number" min={1} max={10} placeholder="—" className={inputCls}
                        value={r.criticalMinSten ?? ""}
                        onChange={(e) => setReq(idx, { criticalMinSten: e.target.value === "" ? null : Number(e.target.value) })} />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Arah</label>
                      <select className={inputCls} value={r.direction} onChange={(e) => setReq(idx, { direction: e.target.value as ProfileRequirement["direction"] })}>
                        {(Object.keys(DIRECTION_LABELS) as ProfileRequirement["direction"][]).map((d) => (
                          <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-7">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Alasan skala ini relevan (wajib)
                      </label>
                      <input className={inputCls} value={r.rationale} onChange={(e) => setReq(idx, { rationale: e.target.value })}
                        placeholder="mis. Ketelitian menentukan mutu keluaran pada posisi ini" />
                    </div>
                    <div className="flex items-end sm:col-span-1">
                      <button type="button" onClick={() => removeReq(idx)}
                        className="w-full rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        aria-label="Hapus skala">
                        <Icon className="mx-auto h-4 w-4"><SvgPath name="trash" /></Icon>
                      </button>
                    </div>
                  </div>

                  {SCALE_BY_ID[r.scaleId] && (
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {SCALE_BY_ID[r.scaleId].description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Ambang &quot;direkomendasikan&quot; (0–100)
              </label>
              <input type="number" min={0} max={100} className={inputCls} value={draft.recommendThreshold}
                onChange={(e) => setDraft({ ...draft, recommendThreshold: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Ambang &quot;dipertimbangkan&quot; (0–100)
              </label>
              <input type="number" min={0} max={100} className={inputCls} value={draft.considerThreshold}
                onChange={(e) => setDraft({ ...draft, considerThreshold: Number(e.target.value) })} />
            </div>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
            <span className="font-medium">Ambang kritis</span> memblokir rekomendasi meski skor kesesuaian total tinggi.
            Pakai hanya untuk hal yang benar-benar tidak bisa ditawar pada posisi tsb (mis. kesadaran keselamatan untuk
            pekerjaan di mesin, integritas untuk pemegang kas). Semakin banyak ambang kritis, semakin sedikit kandidat
            yang bisa lolos — dan semakin besar risiko menyaring keluar orang yang sebenarnya mampu.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan…" : isTemplate ? "Simpan sebagai profil perusahaan" : "Simpan perubahan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
