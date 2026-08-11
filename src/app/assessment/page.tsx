"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Konsol Asesmen — tempat HR mengadministrasi psikotes.

   Alur: pilih kandidat (dari pipeline Hire atau ketik manual) → pilih baterai →
   pilih profil jabatan target → sistem membuat tautan tes → tautan dikirim ke
   kandidat → status terpantau di tabel → hasil dibuka di halaman laporan.

   Tautan tes SENGAJA tidak dikirim otomatis lewat email dari halaman ini:
   modul email belum ada, dan tombol "kirim" yang sebenarnya tidak mengirim apa
   pun lebih buruk daripada tombol salin tautan yang benar-benar bekerja.
═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { ALL_BATTERIES, BATTERY_BY_ID, batteryItemCount } from "@/lib/assessment/batteries";
import { suggestProfileForPosition } from "@/lib/assessment/job-profiles";
import {
  defaultExpiry,
  generateAccessToken,
  generateSessionId,
  loadJobProfiles,
  SESSION_STATUS_LABELS,
  type PiAssessmentSessionRow,
  type SessionStatus,
} from "@/lib/assessment/assessment-data";
import { FIT_VERDICT_LABELS } from "@/lib/assessment/job-profiles";
import type { JobProfile } from "@/lib/assessment/types";

interface CandidateOption {
  id: string;
  name: string;
  email: string | null;
  position: string;
  stage: string;
}

const STATUS_STYLE: Record<SessionStatus, string> = {
  invited: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function AssessmentConsolePage() {
  const [sessions, setSessions] = useState<PiAssessmentSessionRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [profileSource, setProfileSource] = useState<"db" | "default">("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Tabel modul belum ada = seluruh tulis-baca sesi pasti gagal. Ditandai
  // eksplisit supaya tombol Undang bisa dimatikan SEBELUM HR mengisi formulir
  // panjang dan baru gagal saat menekan simpan.
  const [setupMissing, setSetupMissing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filter, setFilter] = useState<SessionStatus | "all">("all");

  const tenantId = typeof window !== "undefined" ? getActiveCompanyId() : "";

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError(
        "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local.",
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    const [sessRes, candRes, profRes] = await Promise.all([
      supabase
        .from("pi_assessment_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("invited_at", { ascending: false })
        .limit(200),
      supabase.from("candidates").select("id, name, email, position, stage").order("name").limit(300),
      loadJobProfiles(supabase, tenantId),
    ]);

    if (sessRes.error) {
      // Tabel belum dibuat adalah kondisi yang paling mungkin terjadi dan
      // solusinya berbeda dari error lain, jadi dipisahkan penanganannya.
      const missing = /relation .* does not exist|schema cache/i.test(sessRes.error.message);
      setSetupMissing(missing);
      setError(missing ? "" : `Gagal memuat sesi asesmen: ${sessRes.error.message}`);
    } else {
      setError("");
      setSetupMissing(false);
      setSessions((sessRes.data ?? []) as PiAssessmentSessionRow[]);
    }

    setCandidates((candRes.data ?? []) as CandidateOption[]);
    setProfiles(profRes.data);
    setProfileSource(profRes.source);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(
    () => (filter === "all" ? sessions : sessions.filter((s) => s.status === filter)),
    [sessions, filter],
  );

  const stats = useMemo(() => {
    const by = (s: SessionStatus) => sessions.filter((x) => x.status === s).length;
    return { total: sessions.length, invited: by("invited"), running: by("in_progress"), done: by("completed") };
  }, [sessions]);

  const copyLink = useCallback((token: string) => {
    const url = `${window.location.origin}/tes/${token}`;
    void navigator.clipboard.writeText(url).then(
      () => toast("Tautan tes disalin."),
      () => toast(url, "info"),
    );
  }, []);

  return (
    <AppShell
      activeNavId="assessment"
      title="Asesmen Psikologi"
      subtitle="Administrasi psikotes: undang, pantau, interpretasi"
      headerActions={
        <>
          <Link href="/assessment/demo">
            <Button variant="secondary">Lihat Soal &amp; Contoh</Button>
          </Link>
          <Link href="/assessment/profiles">
            <Button variant="secondary">Profil Jabatan</Button>
          </Link>
          <Button
            variant="primary"
            onClick={() => setInviteOpen(true)}
            disabled={!isSupabaseConfigured || setupMissing}
            title={setupMissing ? "Skema modul Assessment belum dipasang di database" : undefined}
          >
            <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
            Undang Kandidat
          </Button>
        </>
      }
    >
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {setupMissing && <SetupCard />}

      {/* Pernyataan batasan — ditempatkan di atas, bukan di catatan kaki, karena
          inilah yang menentukan bagaimana seluruh angka di modul ini boleh dibaca. */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="flex gap-3">
          <Icon className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"><SvgPath name="warning" /></Icon>
          <div className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
            <p className="font-semibold">Dasar instrumen &amp; batasannya</p>
            <p className="mt-1">
              Kepribadian memakai adaptasi <span className="font-medium">IPIP-BFM-50</span> (Big Five, domain publik).
              Item kognitif dan SJT ditulis sendiri. Instrumen berlisensi (MBTI, DISC, 16PF, Papikostick, CFIT, IST)
              tidak direproduksi di sini. Norma bawaan masih <span className="font-medium">sintetis</span> — sten dan
              persentil sah untuk membandingkan kandidat dalam satu lowongan, belum sah sebagai ambang kelulusan
              absolut. Hasil asesmen adalah satu sumber bukti, bukan penentu tunggal keputusan seleksi.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total sesi" value={stats.total} />
        <StatCard label="Menunggu dikerjakan" value={stats.invited} />
        <StatCard label="Sedang dikerjakan" value={stats.running} />
        <StatCard label="Selesai" value={stats.done} />
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sesi asesmen</p>
          <div className="flex flex-wrap gap-1">
            {(["all", "invited", "in_progress", "completed", "expired"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                {f === "all" ? "Semua" : SESSION_STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">Memuat…</div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {sessions.length === 0
                ? "Belum ada sesi asesmen. Mulai dengan mengundang kandidat."
                : "Tidak ada sesi dengan status ini."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Kandidat</th>
                  <th className="px-5 py-2.5 font-medium">Posisi</th>
                  <th className="px-5 py-2.5 font-medium">Baterai</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Hasil</th>
                  <th className="px-5 py-2.5 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{s.candidate_name}</p>
                      <p className="text-xs text-slate-500">{s.candidate_email || "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{s.position || "—"}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {BATTERY_BY_ID[s.battery_id]?.name ?? s.battery_id}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[s.status])}>
                        {SESSION_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {s.report?.fit ? (
                        <span className="text-slate-700 dark:text-slate-300">
                          <span className="font-semibold tabular-nums">{s.report.fit.fitScore}</span>
                          <span className="text-xs text-slate-500"> /100 · {FIT_VERDICT_LABELS[s.report.fit.verdict]}</span>
                        </span>
                      ) : s.status === "completed" ? (
                        <span className="text-xs text-slate-500">Selesai, tanpa profil jabatan</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {s.status === "completed" ? (
                          <Link href={`/assessment/${s.id}`}>
                            <Button size="sm" variant="primary">Lihat laporan</Button>
                          </Link>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => copyLink(s.access_token)}>
                            Salin tautan tes
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {inviteOpen && (
        <InviteModal
          tenantId={tenantId}
          candidates={candidates}
          profiles={profiles}
          profileSource={profileSource}
          existingCandidateIds={new Set(sessions.map((s) => s.candidate_id).filter(Boolean) as string[])}
          onClose={() => setInviteOpen(false)}
          onCreated={(token) => {
            setInviteOpen(false);
            void refresh();
            copyLink(token);
          }}
        />
      )}
    </AppShell>
  );
}

/* ─── Kartu setup ───
   Muncul hanya bila tabel pi_assessment_* belum ada. Sengaja menyebut nama file
   dan urutannya, bukan sekadar "hubungi admin": pemasangannya memang satu kali
   tempel, dan menyembunyikan langkahnya cuma membuat modul terlihat rusak.

   Link SQL Editor dibangun dari NEXT_PUBLIC_SUPABASE_URL (bukan di-hardcode)
   supaya tetap benar di instance mana pun — privat maupun demo. */
function SetupCard() {
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  const sqlEditorUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/sql/new` : null;
  const [copying, setCopying] = useState(false);

  // SQL diambil dari public/setup/ (dihasilkan bundle-assessment-sql.ts) lalu
  // disalin ke clipboard. Alternatifnya adalah meminta orang membuka repo dan
  // menyalin 400+ baris dari ponsel — yang praktis berarti langkah ini tidak
  // akan pernah dikerjakan.
  const copySql = async () => {
    setCopying(true);
    try {
      const res = await fetch("/setup/assessment-module-ALL.sql");
      if (!res.ok) throw new Error(String(res.status));
      await navigator.clipboard.writeText(await res.text());
      toast("SQL disalin. Tempel di Supabase SQL Editor, lalu Run.");
    } catch {
      toast("Gagal menyalin. Buka file supabase/assessment-module-ALL.sql di repo dan salin manual.", "error");
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="flex gap-3">
        <Icon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"><SvgPath name="warning" /></Icon>
        <div className="min-w-0 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          <p className="text-base font-semibold">Modul belum terpasang di database</p>
          <p className="mt-1">
            Tabel <span className="font-mono text-xs">pi_assessment_norms</span>,{" "}
            <span className="font-mono text-xs">pi_assessment_profiles</span>, dan{" "}
            <span className="font-mono text-xs">pi_assessment_sessions</span> belum ada, jadi sesi asesmen belum bisa
            dibuat. Tombol <span className="font-medium">Undang Kandidat</span> dimatikan sampai ini beres — supaya
            Anda tidak mengisi formulir panjang lalu gagal di akhir.
          </p>

          <p className="mt-3 font-semibold">Cara memasang — dua tombol di bawah ini:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Tekan <span className="font-medium">Salin SQL</span> (gabungan schema + seed + RLS, urutannya sudah benar)</li>
            <li>Tekan <span className="font-medium">Buka SQL Editor</span>, tempel, lalu <span className="font-medium">Run</span></li>
            <li>Kembali ke halaman ini dan muat ulang</li>
          </ol>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={copySql} disabled={copying}>
              {copying ? "Menyalin…" : "Salin SQL"}
            </Button>
            {sqlEditorUrl && (
              <a href={sqlEditorUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">Buka SQL Editor ↗</Button>
              </a>
            )}
            <Button variant="secondary" onClick={() => window.location.reload()}>Sudah — muat ulang</Button>
          </div>

          <p className="mt-3 text-xs opacity-90">
            Aman dijalankan ulang, dan tidak menyentuh tabel modul Hire maupun Pay. Selagi menunggu, isi soal dan contoh
            laporannya sudah bisa dilihat di{" "}
            <Link href="/assessment/demo" className="font-medium underline underline-offset-2">halaman demo</Link> —
            halaman itu tidak butuh database.
          </p>
        </div>
      </div>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </Card>
  );
}

/* ─── Modal undangan ─── */

function InviteModal({
  tenantId,
  candidates,
  profiles,
  profileSource,
  existingCandidateIds,
  onClose,
  onCreated,
}: {
  tenantId: string;
  candidates: CandidateOption[];
  profiles: JobProfile[];
  profileSource: "db" | "default";
  existingCandidateIds: Set<string>;
  onClose: () => void;
  onCreated: (token: string) => void;
}) {
  const [candidateId, setCandidateId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [batteryId, setBatteryId] = useState(ALL_BATTERIES[0].id);
  const [profileId, setProfileId] = useState("");
  const [saving, setSaving] = useState(false);

  // Memilih kandidat dari pipeline mengisi nama/email/posisi, lalu profil
  // jabatan disarankan dari judul posisinya. HR tetap bisa menimpanya —
  // judul jabatan di lapangan sering tidak konsisten.
  const pickCandidate = (id: string) => {
    setCandidateId(id);
    const c = candidates.find((x) => x.id === id);
    if (!c) return;
    setName(c.name);
    setEmail(c.email ?? "");
    setPosition(c.position);
    const suggested = suggestProfileForPosition(c.position, profiles);
    if (suggested) setProfileId(suggested.id);
  };

  const battery = BATTERY_BY_ID[batteryId];
  const selectedProfile = profiles.find((p) => p.id === profileId) ?? null;

  const submit = async () => {
    if (!supabase) return;
    if (!name.trim()) {
      toast("Nama kandidat wajib diisi.", "error");
      return;
    }
    setSaving(true);
    const token = generateAccessToken();
    const row = {
      id: generateSessionId(),
      tenant_id: tenantId,
      candidate_id: candidateId || null,
      candidate_name: name.trim(),
      candidate_email: email.trim(),
      position: position.trim(),
      battery_id: batteryId,
      profile_id: profileId || null,
      access_token: token,
      status: "invited",
      invited_at: new Date().toISOString(),
      expires_at: defaultExpiry(),
      responses: {},
      timings: [],
    };

    const { error } = await supabase.from("pi_assessment_sessions").insert(row);
    setSaving(false);
    if (error) {
      // Pesan Postgres mentah ("schema cache") tidak memberi tahu apa pun yang
      // bisa ditindaklanjuti HR. Diterjemahkan ke langkah nyata.
      const missing = /relation .* does not exist|schema cache/i.test(error.message);
      toast(
        missing
          ? "Tabel modul Assessment belum ada di database. Jalankan supabase/assessment-module-ALL.sql di Supabase SQL Editor lebih dulu."
          : `Gagal membuat sesi: ${error.message}`,
        "error",
      );
      return;
    }
    toast("Sesi asesmen dibuat. Tautan tes sudah disalin.");
    onCreated(token);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Undang Kandidat Asesmen</h2>
            <p className="text-xs text-slate-500">Tautan tes dibuat setelah disimpan, lalu disalin ke clipboard</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Ambil dari pipeline Hire
            </label>
            <select className={inputCls} value={candidateId} onChange={(e) => pickCandidate(e.target.value)}>
              <option value="">— Isi manual (kandidat di luar pipeline) —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.position} ({c.stage}){existingCandidateIds.has(c.id) ? " · sudah pernah diundang" : ""}
                </option>
              ))}
            </select>
            {candidateId && existingCandidateIds.has(candidateId) && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Kandidat ini sudah pernah diundang. Membuat sesi baru berarti tes ulang, bukan mengganti hasil lama.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama kandidat *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Posisi yang dilamar</label>
            <input
              className={inputCls}
              value={position}
              onChange={(e) => {
                setPosition(e.target.value);
                const s = suggestProfileForPosition(e.target.value, profiles);
                if (s) setProfileId(s.id);
              }}
              placeholder="mis. Supervisor Produksi"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Baterai tes</label>
            <select className={inputCls} value={batteryId} onChange={(e) => setBatteryId(e.target.value)}>
              {ALL_BATTERIES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — ± {b.estimatedMinutes} menit, {batteryItemCount(b)} soal
                </option>
              ))}
            </select>
            {battery && <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{battery.description}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Profil jabatan target
            </label>
            <select className={inputCls} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">— Tanpa profil (laporan profil saja, tanpa skor kesesuaian) —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.level}){p.source === "custom" ? " · custom" : ""}
                </option>
              ))}
            </select>
            {selectedProfile && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {selectedProfile.description} — {selectedProfile.requirements.length} skala dinilai.
              </p>
            )}
            {profileSource === "default" && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Profil dibaca dari template bawaan di kode (tabel pi_assessment_profiles belum terisi).
              </p>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
            Tautan tes berlaku {14} hari dan hanya berisi token acak — tidak memuat nama maupun identitas kandidat di URL.
            Kirimkan tautan itu langsung ke kandidat yang bersangkutan.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Menyimpan…" : "Buat sesi & salin tautan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
