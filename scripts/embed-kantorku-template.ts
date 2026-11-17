/* Menanam template impor karyawan KantorKu ke kode (base64) supaya ekspor di server tidak
   bergantung pada berkas yang ikut ter-deploy.

   node node_modules/tsx/dist/cli.mjs scripts/embed-kantorku-template.ts <template.xlsx> [rica-rico|lencir]

   Template hanya berisi struktur KantorKu + unit perusahaan (Branch/Department/Position,
   shift, lokasi absen) — periksa sheet "Existing Data" tidak memuat data karyawan sebelum
   menjalankan ini. */
import { readFileSync, writeFileSync } from "node:fs";
import { readUnits } from "../src/lib/kantorku/xlsx";

const [file, instance = "rica-rico"] = process.argv.slice(2);
if (!file) throw new Error("Pakai: embed-kantorku-template.ts <template.xlsx> [instance]");
const bytes = readFileSync(file);
const units = readUnits(new Uint8Array(bytes));
const out = `src/lib/kantorku/template-${instance}.ts`;
const b64 = bytes.toString("base64");
writeFileSync(out, `/* DIBUAT OTOMATIS oleh scripts/embed-kantorku-template.ts — jangan disunting.
   Template impor karyawan KantorKu untuk instance ${instance} (${bytes.length} byte).
   Unit di sheet Existing Data: ${units.branches.length} branch, ${units.departments.length} department, ${units.positions.length} position. */
export const KANTORKU_TEMPLATE_B64 =
  ${JSON.stringify(b64)};
`);
console.log(out, units);
