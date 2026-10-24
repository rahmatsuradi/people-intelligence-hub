/* ═══════════════════════════════════════════════════════════════════════════
   Industrial Relations Store — per-tenant case log + PP/PKB document tracker.
   Follows the same tenantId-prefixed localStorage pattern as mpp-store.ts /
   competency-matrix-store.ts. All records are HR-entered; nothing here is
   auto-generated or inferred.
═══════════════════════════════════════════════════════════════════════════ */

export type IRCaseCategory = "keluhan" | "indisipliner" | "phk" | "mediasi-bipartit" | "phi" | "lainnya";
export type IRCaseStatus = "open" | "mediasi" | "selesai" | "eskalasi";

export interface IRCase {
  id: string;
  title: string;
  employeeId: string;
  employeeName: string;
  category: IRCaseCategory;
  status: IRCaseStatus;
  openedDate: string; // yyyy-mm-dd
  targetDate: string; // yyyy-mm-dd, target penyelesaian
  description: string;
  resolutionNotes: string;
  legalRef: string; // referensi pasal UU/PP yang relevan, diisi manual HR
  createdAt: string;
  updatedAt: string;
}

/** PP wajib didaftarkan & berlaku maksimal 2 tahun (UU 13/2003 Pasal 111 ayat 3,
 *  tidak diubah UU Cipta Kerja/UU 6/2023). PKB berlaku maksimal 2 tahun, dapat
 *  diperpanjang maksimal 1 tahun (Pasal 123). Nilai default masa berlaku di UI
 *  memakai rujukan ini, tapi tanggal aktual selalu diisi manual HR. */
export type IRDocType = "pp" | "pkb";
export type IRDocStatus = "aktif" | "menuju-kadaluarsa" | "kadaluarsa" | "proses-perpanjangan";

export interface IRDocument {
  id: string;
  docType: IRDocType;
  title: string;
  registrationNumber: string;
  effectiveDate: string; // yyyy-mm-dd
  expiryDate: string; // yyyy-mm-dd
  status: IRDocStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const CASE_PREFIX = "hi_ir_cases_";
const DOC_PREFIX = "hi_ir_documents_";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getIRCases(tenantId: string): IRCase[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(CASE_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveIRCases(tenantId: string, cases: IRCase[]): void {
  localStorage.setItem(CASE_PREFIX + tenantId, JSON.stringify(cases));
}

export function upsertIRCase(tenantId: string, input: Omit<IRCase, "id" | "createdAt" | "updatedAt"> & { id?: string }): IRCase {
  const all = getIRCases(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((c) => c.id === input.id);
    if (idx >= 0) {
      const updated: IRCase = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveIRCases(tenantId, all);
      return updated;
    }
  }
  const created: IRCase = { ...input, id: genId("case"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveIRCases(tenantId, all);
  return created;
}

export function deleteIRCase(tenantId: string, id: string): void {
  saveIRCases(tenantId, getIRCases(tenantId).filter((c) => c.id !== id));
}

export function getIRDocuments(tenantId: string): IRDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(DOC_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveIRDocuments(tenantId: string, docs: IRDocument[]): void {
  localStorage.setItem(DOC_PREFIX + tenantId, JSON.stringify(docs));
}

export function upsertIRDocument(tenantId: string, input: Omit<IRDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }): IRDocument {
  const all = getIRDocuments(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((d) => d.id === input.id);
    if (idx >= 0) {
      const updated: IRDocument = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveIRDocuments(tenantId, all);
      return updated;
    }
  }
  const created: IRDocument = { ...input, id: genId("doc"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveIRDocuments(tenantId, all);
  return created;
}

export function deleteIRDocument(tenantId: string, id: string): void {
  saveIRDocuments(tenantId, getIRDocuments(tenantId).filter((d) => d.id !== id));
}

/** Kadaluarsa jika expiryDate sudah lewat; "menuju kadaluarsa" jika <= 60 hari lagi. */
export function computeDocStatus(expiryDate: string): IRDocStatus {
  if (!expiryDate) return "aktif";
  const days = Math.round((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "kadaluarsa";
  if (days <= 60) return "menuju-kadaluarsa";
  return "aktif";
}

export function suggestExpiryDate(effectiveDate: string): string {
  if (!effectiveDate) return "";
  const d = new Date(effectiveDate);
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}
