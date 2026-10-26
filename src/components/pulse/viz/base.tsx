"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Fondasi grafik Pulse Check — token warna, tooltip, kartu grafik, legenda.

   Warna: palet acuan data-viz yang sudah divalidasi (delapan hue kategorikal berurutan tetap,
   ramp sekuensial biru, pasangan diverging biru↔merah dengan titik tengah abu). Mode gelap =
   langkah warna yang dipilih ulang untuk permukaan gelap, bukan pembalikan otomatis. Teks selalu
   memakai token teks (--v-ink*), tidak pernah warna seri — identitas dibawa oleh tanda warna di sebelahnya.
   Setiap grafik punya tombol "Tabel" (kembaran yang ramah aksesibilitas) dan tooltip yang hanya
   menambah, tidak pernah menjadi satu-satunya cara membaca angka.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useId, useRef, useState } from "react";
import { cn } from "@/components/app-shell";

const CSS = `
.viz {
  --v-surface: #fcfcfb; --v-ink: #0b0b0b; --v-ink2: #52514e; --v-muted: #898781;
  --v-grid: #e1e0d9; --v-axis: #c3c2b7; --v-track: #f0efec;
  --v-s1: #2a78d6; --v-s2: #eb6834; --v-s3: #1baf7a;
  --v-seq-1: #cde2fb; --v-seq-2: #9ec5f4; --v-seq-3: #6da7ec; --v-seq-4: #3987e5; --v-seq-5: #256abf; --v-seq-6: #184f95; --v-seq-7: #0d366b;
  --v-ink-1: #0b0b0b; --v-ink-2: #0b0b0b; --v-ink-3: #0b0b0b; --v-ink-4: #0b0b0b; --v-ink-5: #fff; --v-ink-6: #fff; --v-ink-7: #fff;
  --v-neg2: #e34948; --v-neg1: #ee9a99; --v-pos1: #6da7ec; --v-pos2: #256abf; --v-mid: #f0efec;
  --v-ord-1: #86b6ef; --v-ord-2: #5598e7; --v-ord-3: #2a78d6; --v-ord-4: #1c5cab; --v-ord-5: #104281; --v-ord-6: #0d366b;
  --v-ordink-1: #0b0b0b; --v-ordink-2: #0b0b0b; --v-ordink-3: #fff; --v-ordink-4: #fff; --v-ordink-5: #fff; --v-ordink-6: #fff;
  --v-good: #006300; --v-bad: #d03b3b; --v-warn: #b36b00;
  color: var(--v-ink);
}
.dark .viz {
  --v-surface: #1a1a19; --v-ink: #f0efec; --v-ink2: #c3c2b7; --v-muted: #898781;
  --v-grid: #2c2c2a; --v-axis: #383835; --v-track: #2c2c2a;
  --v-s1: #3987e5; --v-s2: #d95926; --v-s3: #199e70;
  --v-seq-1: #0d366b; --v-seq-2: #104281; --v-seq-3: #184f95; --v-seq-4: #256abf; --v-seq-5: #3987e5; --v-seq-6: #6da7ec; --v-seq-7: #9ec5f4;
  --v-ink-1: #fff; --v-ink-2: #fff; --v-ink-3: #fff; --v-ink-4: #fff; --v-ink-5: #0b0b0b; --v-ink-6: #0b0b0b; --v-ink-7: #0b0b0b;
  --v-neg2: #e66767; --v-neg1: #944848; --v-pos1: #2d5b93; --v-pos2: #3987e5; --v-mid: #383835;
  --v-ord-1: #184f95; --v-ord-2: #1c5cab; --v-ord-3: #3987e5; --v-ord-4: #5598e7; --v-ord-5: #86b6ef; --v-ord-6: #b7d3f6;
  --v-ordink-1: #fff; --v-ordink-2: #fff; --v-ordink-3: #fff; --v-ordink-4: #0b0b0b; --v-ordink-5: #0b0b0b; --v-ordink-6: #0b0b0b;
  --v-good: #0ca30c; --v-bad: #e66767; --v-warn: #fab219;
}
.viz-tip { position: absolute; z-index: 30; pointer-events: none; min-width: 150px; max-width: 280px; padding: 8px 10px; border-radius: 10px;
  background: var(--v-surface); border: 1px solid var(--v-grid); box-shadow: 0 6px 24px rgba(0,0,0,.14); font-size: 12px; line-height: 1.35; color: var(--v-ink2); }
.viz-tip b { color: var(--v-ink); font-weight: 600; }
.viz-mark { transition: filter .12s, opacity .12s; }
.viz-mark:hover, .viz-mark:focus-visible { filter: brightness(1.12) saturate(1.1); outline: none; }
.viz-mark:focus-visible { outline: 2px solid var(--v-ink); outline-offset: 1px; }
.viz-dim { opacity: .45; transition: opacity .12s; }
`;

/** Pasang token warna sekali per halaman; komponen grafik memakai kelas `.viz`. */
export function VizStyle() {
  return <style>{CSS}</style>;
}

/* ─── Tooltip ─── */

export interface TipRow { color?: string; label: string; value: string; ring?: boolean }
export interface TipData { title?: string; sub?: string; rows?: TipRow[] }

export function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; data: TipData } | null>(null);
  const at = useCallback((e: { clientX: number; clientY: number }, data: TipData) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, data });
  }, []);
  const atEl = useCallback((el: Element, data: TipData) => {
    const box = ref.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (box) setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, data });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const width = ref.current?.clientWidth ?? 600;
  const node = tip ? (
    <div className="viz-tip" role="tooltip" style={{
      left: Math.min(Math.max(tip.x, 90), Math.max(90, width - 90)), top: tip.y,
      transform: tip.y < 70 ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 12px))",
    }}>
      {tip.data.title && <div><b>{tip.data.title}</b></div>}
      {tip.data.sub && <div>{tip.data.sub}</div>}
      {tip.data.rows?.map((r, i) => (
        <div key={i} className="mt-1 flex items-center gap-2">
          {r.color && <span style={{ width: 10, height: 3, borderRadius: 2, background: r.ring ? "transparent" : r.color, border: r.ring ? `2px solid ${r.color}` : undefined, flex: "none" }} />}
          <span className="flex-1">{r.label}</span><b>{r.value}</b>
        </div>
      ))}
    </div>
  ) : null;
  return { ref, at, atEl, hide, node, active: !!tip };
}

/* ─── Kartu grafik + tabel pendamping ─── */

export interface TableView { head: string[]; rows: (string | number)[][] }

export function ChartCard({ title, subtitle, legend, table, children, className, actions }: {
  title: string; subtitle?: string; legend?: React.ReactNode; table?: TableView; children: React.ReactNode; className?: string; actions?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section className={cn("viz rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)} aria-labelledby={id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {table && (
            <button type="button" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}
              className={cn("rounded-md border px-2 py-1 text-[11px]", asTable ? "border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100" : "border-slate-200 text-slate-500 dark:border-slate-700")}>
              {asTable ? "Grafik" : "Tabel"}
            </button>
          )}
        </div>
      </div>
      {legend && <div className="mt-2">{legend}</div>}
      <div className="mt-3">
        {asTable && table ? (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500">{table.head.map((h, i) => <th key={i} className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cn("py-1.5 pr-3", j > 0 ? "text-right tabular-nums" : "font-medium")}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        ) : children}
      </div>
    </section>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; kind?: "swatch" | "line" | "ring" }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.kind === "line" ? <span style={{ width: 14, height: 3, borderRadius: 2, background: it.color }} />
            : it.kind === "ring" ? <span style={{ width: 9, height: 9, borderRadius: 9, border: `2px solid ${it.color}` }} />
            : <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Teks di atas warna isi: putih atau tinta sesuai kecerahan agar selalu terbaca. */
export function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0b0b0b";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0b0b0b" : "#ffffff";
}

export const fmtPct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${x.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
export const fmtNum = (x: number | null | undefined, d = 2) => (x == null ? "—" : x.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }));
