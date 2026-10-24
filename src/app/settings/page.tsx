"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Button, Card, Label, inputClass } from "@/components/app-shell";
import { setCompanyName, setCompanyEmail } from "@/lib/email-templates";

export default function SettingsPage() {
  const [userName, setUserName] = useState("");
  const [company, setCompany] = useState("");
  const [companyEmail, setCompanyEmailState] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem("hi_user_name") ?? "");
    setCompany(localStorage.getItem("hi_company_name") ?? "");
    setCompanyEmailState(localStorage.getItem("hi_company_email") ?? "");
  }, []);

  const handleSave = useCallback(() => {
    const name = userName.trim();
    if (name) localStorage.setItem("hi_user_name", name);
    setCompanyName(company);
    setCompanyEmail(companyEmail);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [userName, company, companyEmail]);

  // Hanya membuang salinan di browser ini dari data yang PUNYA cadangan di cloud
  // (kandidat, lowongan, aktivitas) — dimuat ulang saat halaman dibuka lagi. Kunci
  // `hi_*` lain (eNPS, pelatihan, suksesi, dst.) hanya hidup di browser; membuangnya
  // berarti kehilangan data. Sengaja TIDAK ada tombol hapus-semua-di-cloud: database
  // dipakai bersama satu tim HR, jadi satu klik akan menghapus data semua orang.
  const handleClearAll = useCallback(() => {
    if (!window.confirm("Bersihkan salinan kandidat, lowongan, dan aktivitas di browser ini? Data di cloud tetap aman dan akan dimuat ulang.")) return;
    Object.keys(localStorage)
      .filter((k) => /^hi_(candidates|jobreqs|activity)(_|$)/.test(k))
      .forEach((k) => localStorage.removeItem(k));
    window.location.href = "/";
  }, []);

  return (
    <AppShell activeNavId="settings" title="Settings" subtitle="Preferences and data management">
      <div className="max-w-xl space-y-6">
        <Card>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Profile</h2>
          <p className="mt-0.5 text-sm text-slate-500">Your name shown in the sidebar and activity feed.</p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="user-name">Your name</Label>
              <input
                id="user-name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. Pep Guardiola"
                className={inputClass}
              />
            </div>
            <div>
              <Label htmlFor="company-name">Company name</Label>
              <input
                id="company-name"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. PT Maju Bersama"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">Used to fill {"{{company}}"} in candidate emails.</p>
            </div>
            <div>
              <Label htmlFor="company-email">Company email (optional)</Label>
              <input
                id="company-email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmailState(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. hr@perusahaan.com"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">Shown in the email signature so candidates can reply. Leave blank to omit.</p>
            </div>
            <Button variant="primary" size="md" onClick={handleSave}>
              {saved ? "Saved ✓" : "Save"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Appearance</h2>
          <p className="mt-0.5 text-sm text-slate-500">Use the moon/sun icon in the top bar to cycle between Light, Dark, and System theme.</p>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
          <p className="mt-1 text-sm text-slate-500">Membuang salinan kandidat, lowongan, dan aktivitas di browser ini, lalu memuat ulang dari cloud. Data di cloud tidak ikut terhapus.</p>
          <Button variant="danger" size="md" className="mt-4" onClick={handleClearAll}>
            Bersihkan cache browser
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
