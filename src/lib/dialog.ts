/* Pengganti window.confirm / window.prompt yang jalan di mana saja.
   Kotak dialog bawaan browser diblokir atau tidak tampil di panel/aplikasi tertanam, di sebagian
   browser HP, dan saat tab di latar — tombol yang memakainya terasa "mati". Ini membuat kotak
   sendiri di dalam halaman dan mengembalikan Promise, jadi pemakaiannya:
     if (!(await confirmDialog("Hapus?"))) return;
     const v = await promptDialog("Berapa orang?", "10");   // null = dibatalkan
   Hanya untuk kode sisi browser (dipanggil dari klik tombol). */

interface Opts { yes?: string; no?: string; danger?: boolean }

function overlay(build: (close: (v: unknown) => void, root: HTMLDivElement) => void): Promise<unknown> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const wrap = document.createElement("div");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)";
    const box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:420px;border-radius:16px;background:#fff;color:#0f172a;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.3);font:15px/1.5 system-ui,sans-serif";
    wrap.appendChild(box);
    const close = (v: unknown) => { wrap.remove(); document.removeEventListener("keydown", onKey, true); prevFocus?.focus?.(); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } };
    document.addEventListener("keydown", onKey, true);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(null); });
    build(close, box);
    document.body.appendChild(wrap);
  });
}

function button(label: string, primary: boolean, danger: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  const bg = primary ? (danger ? "#b91c1c" : "#2563eb") : "#f1f5f9";
  b.style.cssText = `border:0;border-radius:10px;padding:9px 16px;font:600 14px system-ui,sans-serif;cursor:pointer;background:${bg};color:${primary ? "#fff" : "#0f172a"}`;
  b.addEventListener("click", onClick);
  return b;
}

function text(msg: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = msg;           // textContent, bukan innerHTML: pesan memuat nama dari data
  p.style.cssText = "margin:0 0 16px;white-space:pre-line";
  return p;
}

export async function confirmDialog(message: string, opts: Opts = {}): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const danger = opts.danger ?? /hapus|delete|cabut|tolak|decline|bersihkan|keluarkan/i.test(message);
  const r = await overlay((close, box) => {
    box.appendChild(text(message));
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap";
    const no = button(opts.no ?? "Batal", false, false, () => close(false));
    const yes = button(opts.yes ?? "Ya, lanjutkan", true, danger, () => close(true));
    row.append(no, yes);
    box.appendChild(row);
    setTimeout(() => (danger ? no : yes).focus(), 0);
  });
  return r === true;
}

/** Mengembalikan teks isian, atau null bila dibatalkan. */
export async function promptDialog(message: string, initial = ""): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const r = await overlay((close, box) => {
    box.appendChild(text(message));
    const input = document.createElement("input");
    input.type = "text";
    input.value = initial;
    input.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:15px system-ui,sans-serif;margin-bottom:16px";
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") close(input.value); });
    box.appendChild(input);
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:flex-end;gap:8px";
    row.append(button("Batal", false, false, () => close(null)), button("Simpan", true, false, () => close(input.value)));
    box.appendChild(row);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
  return typeof r === "string" ? r : null;
}
