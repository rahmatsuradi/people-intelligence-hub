// Identitas pemberi kerja — WAJIB di slip gaji (PP 36/2021 Pasal 53(2), "identitas pemberi kerja").
// Multi-Tenant Platform: mendukung perpindahan instan antar anak perusahaan di dalam holding.

export interface CompanyProfile {
  id: string;
  name: string;
  shortName: string;
  address: string;
  signerName: string; // penanda tangan otorisasi (HR/Finance)
  signerTitle: string;
  tagline: string;
  industry: "broadcast" | "garment";
  headcountTarget: number;
}

export const COMPANY_VALORA_TV: CompanyProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "PT Valora Media Television (VALORA TV)",
  shortName: "VALORA TV (Broadcast)",
  address: "Gedung Valora Tower, Jl. Penyiaran Digital No. 99, Jakarta Barat 11530",
  signerName: "Thibaut Courtois",
  signerTitle: "VP Human Capital & GA",
  tagline: "Indonesian National News & Multi-Platform TV Broadcasting Network",
  industry: "broadcast",
  headcountTarget: 754,
};

// Alias untuk kompatibilitas kode yang masih merujuk ke nama konstanta lama
export const COMPANY_VALORIS_TV: CompanyProfile = COMPANY_VALORA_TV;

export const COMPANY_ZUS_TEXTILE: CompanyProfile = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "PT Zus Textilindo Utama (ZUS APPAREL)",
  shortName: "ZUS APPAREL (Garment)",
  address: "Kawasan Industri Modern Cikande Blok F-12, Serang, Banten 42186",
  signerName: "Wulan Sari Kurnia",
  signerTitle: "VP Human Resources & Plant GA",
  tagline: "Modern Export Garment & High-Speed Textile Manufacturing Plant",
  industry: "garment",
  headcountTarget: 245,
};

export const ALL_COMPANIES: CompanyProfile[] = [
  COMPANY_VALORA_TV,
  COMPANY_ZUS_TEXTILE,
];

// Perusahaan DEFAULT bila tidak dispesifikasikan.
export const DEMO_COMPANY_PROFILE: CompanyProfile = COMPANY_VALORA_TV;

const STORAGE_KEY = "pi_active_company_id";

export function getActiveCompanyId(): string {
  if (typeof window === "undefined") return "11111111-1111-4111-8111-111111111111";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "11111111-1111-4111-8111-111111111111" || stored === "22222222-2222-4222-8222-222222222222" || stored === "valora_tv" || stored === "zus_textile") {
      return stored === "valora_tv" ? "11111111-1111-4111-8111-111111111111" : (stored === "zus_textile" ? "22222222-2222-4222-8222-222222222222" : stored);
    }
  } catch {
    // abaikan jika localStorage tidak bisa diakses
  }
  return "11111111-1111-4111-8111-111111111111";
}

export function setActiveCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, companyId);
    window.dispatchEvent(new Event("pi-company-change"));
  } catch {
    // abaikan error storage
  }
}

export function getActiveCompanyProfile(): CompanyProfile {
  const id = getActiveCompanyId();
  return ALL_COMPANIES.find((c) => c.id === id) || COMPANY_VALORA_TV;
}

export function resolveCompanyProfile(companyId?: string): CompanyProfile {
  if (!companyId) return getActiveCompanyProfile();
  const found = ALL_COMPANIES.find((c) => c.id === companyId);
  if (found) return found;
  
  const name = process.env.PI_COMPANY_NAME;
  if (!name) return COMPANY_VALORA_TV;
  return {
    id: "custom",
    name,
    shortName: name,
    address: process.env.PI_COMPANY_ADDRESS ?? COMPANY_VALORA_TV.address,
    signerName: process.env.PI_COMPANY_SIGNER_NAME ?? COMPANY_VALORA_TV.signerName,
    signerTitle: process.env.PI_COMPANY_SIGNER_TITLE ?? COMPANY_VALORA_TV.signerTitle,
    tagline: "Custom Enterprise Entity",
    industry: "broadcast",
    headcountTarget: 500,
  };
}
