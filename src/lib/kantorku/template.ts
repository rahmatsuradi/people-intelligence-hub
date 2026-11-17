/* Template KantorKu bawaan per instance — HANYA untuk kode server (berkasnya ±300 KB).
   Rica Rico: template yang diunggah HR 17 Nov 2026. Instance lain belum punya; HR
   mengunggah template dari KantorKu-nya sendiri di halaman ekspor. */
import { INSTANCE } from "@/lib/instance";
import { KANTORKU_TEMPLATE_B64 } from "./template-rica-rico";
import { readUnits } from "./xlsx";
import type { KkUnits } from "./map";

export function builtinTemplate(): Uint8Array | null {
  return INSTANCE.key === "rica-rico" ? new Uint8Array(Buffer.from(KANTORKU_TEMPLATE_B64, "base64")) : null;
}

let unitsCache: KkUnits | null | undefined;
export function builtinUnits(): KkUnits | null {
  if (unitsCache === undefined) {
    const t = builtinTemplate();
    unitsCache = t ? readUnits(t) : null;
  }
  return unitsCache;
}
