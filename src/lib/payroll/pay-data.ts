import type { StatutoryConfig } from "./run-payroll";
import { getActiveCompanyId } from "./company-profile";

// Bentuk baris DB pi_* (mirror kolom di supabase/pay-module-schema.sql).
export interface PiEmployeeRow {
  id: string;
  tenant_id: string;
  full_name: string;
  nik: string | null;
  npwp: string | null;
  ptkp_status: string;
  join_date: string;
  employment_type: string;
  risk_class: string;
  department: string | null;
  position?: string | null;
  bank_account: string | null;
  status: string;
  hired_candidate_id?: string | null; // tautan ke candidates.id (modul Hire); null = karyawan non-rekrutmen
}

// Kandidat modul Hire berstatus 'hired' — kandidat untuk di-onboard jadi pi_employees.
export interface HiredCandidateRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string;
  department: string | null;
  stage: string;
}

export interface PiCompensationRow {
  id: string;
  employee_id: string;
  upah_pokok: number | string;
  tunjangan_tetap: { name: string; amount: number }[];
  tunjangan_tidak_tetap: { name: string; amount: number }[];
  effective_date: string;
}

export interface PiStatutoryConfigRow {
  id: string;
  effective_date: string;
  ptkp: StatutoryConfig["ptkpConfig"];
  ter_tables: StatutoryConfig["terTables"];
  bpjs_rates: StatutoryConfig["bpjsRates"];
  progressive: StatutoryConfig["progressiveRates"];
  biaya_jabatan: StatutoryConfig["biayaJabatanConfig"];
  overtime: StatutoryConfig["overtimeConfig"];
}

export interface PiPayrollRunRow {
  id: string;
  tenant_id: string;
  period: string;
  status: string;
  run_date: string | null;
}

export interface PiPayrollLineComponents {
  bpjs?: {
    employee?: { jht?: number; jp?: number; kesehatan?: number };
    employer?: { jht?: number; jp?: number; jkk?: number; jkm?: number; kesehatan?: number };
  };
  bpjsWageBase?: number; // hilang pada baris tersimpan sebelum field ini ditambahkan -- tampilkan "-", jangan tebak
  overtimePay?: number;
  thrAmount?: number;
  pieceRates?: { label: string; quantity: number; rate: number }[];
}

export interface PiPayrollLineRow {
  id: string;
  run_id: string;
  employee_id: string;
  gross: number | string;
  components: PiPayrollLineComponents | null;
  bpjs_employee: number | string;
  bpjs_employer: number | string;
  taxable_base: number | string;
  pph21: number | string;
  net: number | string;
  other_deductions: { name: string; amount: number }[] | null;
}

// Memilih config statutori yang BERLAKU untuk suatu periode payroll: baris dengan
// effective_date terbaru yang <= awal periode. `pi_statutory_config` bersifat versioned
// (CLAUDE.md §4/§10) -- tarif berubah antar-periode (mis. plafon JP naik tiap Maret), jadi
// perhitungan HARUS pakai config yang berlaku saat itu, BUKAN sekadar baris terbaru.
// Mengembalikan null bila tidak ada config yang berlaku pada/sebelum periode (data belum lengkap).
export function pickStatutoryConfigForPeriod<T extends { effective_date: string }>(
  configs: T[],
  period: string, // 'YYYY-MM'
): T | null {
  const periodStart = `${period}-01`;
  const eligible = configs
    .filter((c) => c.effective_date <= periodStart)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date)); // ISO date -> perbandingan string aman
  return eligible[0] ?? null;
}

// Memetakan baris pi_statutory_config -> bentuk StatutoryConfig yang dipakai engine.
export function toStatutoryConfig(row: PiStatutoryConfigRow): StatutoryConfig {
  return {
    bpjsRates: row.bpjs_rates,
    terTables: row.ter_tables,
    ptkpConfig: row.ptkp,
    biayaJabatanConfig: row.biaya_jabatan,
    progressiveRates: row.progressive,
    overtimeConfig: row.overtime,
  };
}

export interface DecemberAggregate {
  grossJanNov: number;
  iuranPensiunKaryawanJanNov: number;
  pph21JanNov: number;
  monthsFound: number; // periode Jan-Nov distinct yang punya data tersimpan (lengkap = 11)
}

// Menghitung akumulasi Jan-Nov per karyawan dari histori pi_payroll_runs/pi_payroll_lines
// tersimpan (via "Simpan Run" tiap bulan) -- input yang dibutuhkan computePPh21_Annual untuk
// rekonsiliasi Desember. monthsFound < 11 berarti data historis belum lengkap; JANGAN hitung
// Desember untuk karyawan itu seolah 0 di bulan yang hilang (silently wrong), tampilkan sebagai
// gap eksplisit ke pemanggil.
export function aggregateDecemberContext(
  runs: PiPayrollRunRow[],
  lines: PiPayrollLineRow[],
  year: string,
): Map<string, DecemberAggregate> {
  const janNovPeriods = new Set(
    Array.from({ length: 11 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`),
  );
  const runIdToPeriod = new Map(runs.filter((r) => janNovPeriods.has(r.period)).map((r) => [r.id, r.period]));

  const result = new Map<string, DecemberAggregate>();
  const monthsSeen = new Map<string, Set<string>>();

  for (const line of lines) {
    const period = runIdToPeriod.get(line.run_id);
    if (!period) continue; // baris dari run di luar Jan-Nov tahun ini

    const acc = result.get(line.employee_id) ?? {
      grossJanNov: 0,
      iuranPensiunKaryawanJanNov: 0,
      pph21JanNov: 0,
      monthsFound: 0,
    };
    const iuranPensiun = (line.components?.bpjs?.employee?.jht ?? 0) + (line.components?.bpjs?.employee?.jp ?? 0);

    acc.grossJanNov += Number(line.gross);
    acc.pph21JanNov += Number(line.pph21);
    acc.iuranPensiunKaryawanJanNov += iuranPensiun;

    const seen = monthsSeen.get(line.employee_id) ?? new Set<string>();
    seen.add(period);
    monthsSeen.set(line.employee_id, seen);
    acc.monthsFound = seen.size;

    result.set(line.employee_id, acc);
  }

  return result;
}

function generateValorisTv754Employees() {
  const firstNames = [
    "Lionel", "Cristiano", "Zinedine", "Thierry", "David", "Wayne", "Steven", "Frank", "Didier", "John",
    "Iker", "Sergio", "Gerard", "Dani", "Marcelo", "Toni", "Carlos", "Karim", "Gareth", "Mohamed",
    "Sadio", "Virgil", "Alisson", "Kevin", "Erling", "Kylian", "Harry", "Heung-min", "Thibaut", "Leonardo",
    "Javier", "Roberto", "Marco", "Ruud", "Francesco", "Alessandro", "Gabriel", "Hernan", "Juan", "Tevez",
    "Angel", "Paulo", "Lautaro", "Julian", "Pedri", "Gavi", "Lamine", "Jude", "Phil", "Bukayo",
    "Declan", "Rodri", "Vinicius", "Rodrygo", "Federico", "Eder", "Bruno", "Bernardo", "Ruben", "Joao",
    "Pepe", "Nani", "Ricardo", "Luis", "Manuel", "Pauleta", "Eusebio", "Johan", "Ronald", "Dennis",
    "Patrick", "Clarence", "Edgar", "Jaap", "Edwin", "Arjen", "Wesley", "Robin", "Memphis", "Frenkie",
    "Matthijs", "Denzel", "Peter", "Christian", "Pierre", "Simon", "Michael", "Zlatan", "Henrik", "Freddie"
  ];
  const lastNames = [
    "Messi", "Ronaldo", "Zidane", "Henry", "Beckham", "Rooney", "Gerrard", "Lampard", "Drogba", "Terry",
    "Casillas", "Ramos", "Pique", "Alves", "Marcelo", "Kroos", "Casemiro", "Benzema", "Bale", "Salah",
    "Mane", "Van Dijk", "Becker", "De Bruyne", "Haaland", "Mbappe", "Kane", "Son", "Courtois", "Bonucci",
    "Zanetti", "Carlos", "Van Basten", "Rijkaard", "Gullit", "Baggio", "Totti", "Del Piero", "Batistuta", "Crespo",
    "Veron", "Riquelme", "Aguero", "Di Maria", "Dybala", "Martinez", "Alvarez", "Gonzalez", "Lopez", "Hernandez",
    "Garcia", "Fernandez", "Silva", "Santos", "Oliveira", "Pereira", "Costa", "Ferreira", "Rodrigues", "Martins",
    "Gomes", "Lopes", "Marques", "Ribeiro", "Almeida", "Carvalho", "Soares", "Teixeira", "Moreira", "Correia",
    "Mendes", "Nunes", "Vieira", "Monteiro", "Cardoso", "Neves", "Dias", "Cancelo", "Felix", "Pepe",
    "Nani", "Quaresma", "Deco", "Figo", "Pauleta", "Eusebio", "Cruyff", "Neeskens", "Koeman", "Bergkamp"
  ];

  const divisions = [
    { name: "Divisi Redaksi & Pemberitaan", count: 316, titles: [
      "Pemimpin Redaksi / VP News", "Wakil Pemimpin Redaksi", "Redaktur Pelaksana Senior",
      "Produser Berita Senior", "Produser Investigasi", "Koordinator Liputan (Korlip) Nasional",
      "Presenter Utama / Senior News Anchor", "Reporter Lapangan Senior", "Reporter Berita / Journalist",
      "News Desk & Scriptwriter", "Jurnalis Daerah / Kontributor"
    ], salaryMin: 6000000, salaryMax: 18000000 },
    { name: "Divisi Operasional Studio & Broadcast", count: 166, titles: [
      "VP Production Studio", "Chief Cameraman", "Studio Technical Manager", "Chief Lighting & Audio",
      "ENG Cameraman Senior", "ENG Cameraman", "Video Editor & Colorist",
      "Senior Audio Mixer & Sound Engineer", "Lighting Specialist & Switcher", "Studio Prompter & CG Operator"
    ], salaryMin: 5500000, salaryMax: 15000000 },
    { name: "Divisi Kreatif & Program Siaran TV", count: 121, titles: [
      "VP Entertainment & Programming", "Executive Producer Program TV", "Creative Director",
      "Program Director (PD)", "Floor Director (FD)", "Creative Scriptwriter & Rundown Planner",
      "Talent Coordinator & Guest Relation", "Sports Programming & Broadcast Specialist", "Acquisition & Scheduling Officer"
    ], salaryMin: 5500000, salaryMax: 16000000 },
    { name: "Divisi Teknik Penyiaran & IT", count: 90, titles: [
      "VP Engineering & IT", "Chief Transmitter & Network Officer", "MCR Supervisor", "IT Infrastructure Lead",
      "Master Control Room (MCR) Operator", "Transmisi RF & Satellite Uplink Engineer",
      "Switching & Routing broadcast Engineer", "IT Network & Cybersecurity Specialist", "Broadcast Helpdesk & Hardware Support"
    ], salaryMin: 6000000, salaryMax: 17000000 },
    { name: "Divisi Human Capital & GA", count: 35, titles: [
      "Chief Human Capital & GA Officer", "HRBP Lead (News & Production)", "Senior Recruitment & Talent Acquisition",
      "Payroll & Compensation Specialist", "Industrial Relations & BPJS Specialist", "Organizational Development (OD) Analyst",
      "Studio Facility & Fleet Operations Supervisor"
    ], salaryMin: 6500000, salaryMax: 20000000 },
    { name: "Divisi Keuangan & Anggaran", count: 26, titles: [
      "CFO / VP Keuangan & Anggaran", "Senior Accounting & Tax Manager", "Budgeting & Financial Planning Specialist",
      "Treasury & Cash Flow Analyst", "Supervisor Payroll & Kompensasi", "Senior Accounting Staff"
    ], salaryMin: 6500000, salaryMax: 22000000 }
  ];

  const ptkpList = ["TK/0", "TK/1", "K/0", "K/1", "K/2", "K/3"];
  const banks = ["Bank Mandiri", "Bank BCA", "Bank BNI", "Bank BRI"];

  const emps: any[] = [];
  let idCounter = 1;

  for (const div of divisions) {
    for (let j = 0; j < div.count; j++) {
      const hexId = idCounter.toString(16).padStart(12, "0");
      const id = `e1000000-0000-4000-8000-${hexId}`;
      
      const fName = firstNames[(idCounter * 7 + 3) % firstNames.length];
      const lName = lastNames[(idCounter * 13 + 5) % lastNames.length];
      const middleInitial = idCounter > 200 ? ` ${String.fromCharCode(65 + (idCounter % 26))}.` : "";
      const fullName = `${fName}${middleInitial} ${lName}`;

      const titleIdx = j === 0 ? 0 : Math.min(div.titles.length - 1, 1 + ((j - 1) % (div.titles.length - 1)));
      const position = div.titles[titleIdx];

      const employment_type = idCounter <= 654 ? "PKWTT (Tetap)" : "PKWT (Kontrak)";
      
      let salary = Math.round((div.salaryMin + ((idCounter * 123457) % (div.salaryMax - div.salaryMin))) / 500000) * 500000;
      if (j === 0) salary = Math.max(salary, 25000000);

      const ptkp = ptkpList[idCounter % ptkpList.length];
      const bank = `${banks[idCounter % banks.length]} — ${1000000000 + idCounter}`;
      const nik = `317101${(10 + (idCounter % 20)).toString().padStart(2, "0")}08${(70 + (idCounter % 25)).toString().padStart(2, "0")}${idCounter.toString().padStart(4, "0")}`;
      const npwp = `09.${100 + (idCounter % 899)}.${200 + (idCounter % 799)}.${idCounter % 9}-${(idCounter % 90).toString().padStart(3, "0")}.000`;

      // Employee lifecycle (join/exit) — seeded deterministically, not random per run,
      // so the demo is reproducible. join_date spread 2021-2025; every 50th employee
      // (15 people, spread across all 6 divisions) is marked resigned/terminated with
      // an exit_date in Q1/Q2 2026, so Turnover Rate has real sample data to compute.
      // Tenure weighted toward older cohorts — a mature broadcaster hires
      // steadily, not in a recent surge. Year and month use different
      // multipliers so they don't correlate (which would clump every recent
      // hire into the same calendar month). This distribution is what makes
      // the dashboard's computed headcount-YoY land in a believable
      // low-single-digit range instead of implying explosive growth.
      // Month uses modulus 11 (coprime to the year table's 12) — with a
      // shared modulus the two collapse and every hire of a given year lands
      // in the same calendar month.
      const joinYearTable = [2021, 2021, 2021, 2022, 2022, 2022, 2023, 2023, 2023, 2024, 2024, 2025];
      const joinYear = joinYearTable[(idCounter * 7) % 12];
      const joinMonth = 1 + ((idCounter * 5) % 11);
      const joinDay = 1 + (idCounter % 28);
      const join_date = `${joinYear}-${String(joinMonth).padStart(2, "0")}-${String(joinDay).padStart(2, "0")}`;

      const isExitSample = idCounter % 50 === 0;
      const exitIndex = idCounter / 50; // 1..15 when isExitSample
      const employment_status = isExitSample ? (exitIndex % 4 === 0 ? "terminated" : "resigned") : "active";
      const exit_type = isExitSample ? (exitIndex % 3 === 0 ? "involuntary" : "voluntary") : null;
      const exitMonth = isExitSample ? 1 + ((exitIndex - 1) % 6) : null; // Jan-Jun 2026
      const exit_date = isExitSample ? `2026-${String(exitMonth).padStart(2, "0")}-${String(5 + (idCounter % 20)).padStart(2, "0")}` : null;
      const voluntaryReasons = ["Pindah domisili", "Kompensasi di tempat lain", "Peluang karir lain", "Kembali studi"];
      const involuntaryReasons = ["Restrukturisasi organisasi", "Evaluasi kinerja", "Pelanggaran disiplin"];
      const exit_reason = isExitSample
        ? (exit_type === "involuntary" ? involuntaryReasons[exitIndex % involuntaryReasons.length] : voluntaryReasons[exitIndex % voluntaryReasons.length])
        : null;

      // Average monthly overtime hours. Broadcast reality: field/studio crews
      // carry heavy overtime (live events, breaking news, weekend shifts),
      // corporate functions barely any. Synthetic input — the Rupiah cost is
      // then computed by the real PP 35/2021 engine (computeOvertime), never
      // hardcoded. See src/lib/overtime-load.ts.
      const otBase: Record<string, number> = {
        "Divisi Redaksi & Pemberitaan": 26,
        "Divisi Operasional Studio & Broadcast": 32,
        "Divisi Kreatif & Program Siaran TV": 22,
        "Divisi Teknik Penyiaran & IT": 30,
        "Divisi Human Capital & GA": 6,
        "Divisi Keuangan & Anggaran": 5,
      };
      const overtime_hours_monthly = Math.max(0, (otBase[div.name] ?? 8) + ((idCounter % 9) - 4));

      emps.push({
        id,
        full_name: fullName,
        nik,
        npwp,
        ptkp_status: ptkp,
        employment_type,
        department: div.name,
        position,
        bank_account: bank,
        upah_pokok: salary,
        join_date,
        employment_status,
        exit_date,
        exit_type,
        exit_reason,
        overtime_hours_monthly,
      });

      idCounter++;
    }
  }

  return emps;
}

export const DEMO_VALORIS_TV_EMPLOYEES = generateValorisTv754Employees();

function generateZusTextile245Employees() {
  const firstNames = [
    "Wulan", "Bayu", "Fajar", "Budi", "Siti", "Andi", "Dewi", "Eko", "Rina", "Agus",
    "Hendra", "Rizki", "Rahmat", "Ulan", "Kartika", "Sari", "Lestari", "Wahyu", "Surya", "Dedi",
    "Nurul", "Yuni", "Putri", "Ahmad", "Asep", "Joko", "Sri", "Indah", "Ratna", "Hadi",
    "Gunawan", "Bambang", "Wawan", "Cahyo", "Dwi", "Tri", "Kurniawan", "Saputra", "Pratama", "Hartono",
    "Lukman", "Firman", "Yusuf", "Maulana", "Irwan", "Anwar", "Rudi", "Haryanto", "Susanto", "Setiawan",
    "Tari", "Fitri", "Nisa", "Maya", "Lina", "Desi", "Amalia", "Anisa", "Wanda", "Devi"
  ];
  const lastNames = [
    "Sari", "Kurnia", "Saputra", "Hidayat", "Pratama", "Widodo", "Santoso", "Lestari", "Wibowo", "Anggraini",
    "Nugroho", "Purnama", "Kusuma", "Ramadhan", "Susanti", "Handayani", "Mulyani", "Utami", "Melati", "Rahayu",
    "Wijaya", "Halim", "Yulianti", "Setiawan", "Hasanah", "Maryati", "Wulandari", "Supriyanti", "Sugiarto", "Muryani",
    "Sutrisno", "Irawan", "Permadi", "Pambudi", "Hakim", "Rochman", "Suryadi", "Purwanto", "Widyastuti", "Retno"
  ];

  const divisions = [
    { name: "Cutting & Pattern Making", count: 45, titles: [
      "Supervisor Potong / Cutting Lead", "Senior Pattern Maker & Grading", "Master Sample Maker",
      "Operator Mesin Potong (Cutting)", "Staff CAD Marker & Layout", "QC Fabric Inspection"
    ], salaryMin: 3500000, salaryMax: 8000000 },
    { name: "Sewing & Assembly Production", count: 125, titles: [
      "Line Supervisor Jahit (Sewing)", "Chief Mechanic Mesin Jahit", "Operator Mesin Jahit High-Speed",
      "Operator Mesin Obras & Overlock", "Operator Jahit Borongan", "Staff Admin Produksi Line"
    ], salaryMin: 3500000, salaryMax: 7500000 },
    { name: "Quality Control & Finishing", count: 40, titles: [
      "Supervisor QC Finishing", "QC Inline Inspector", "QC Final & Buyer Assurance",
      "Operator Setrika & Steam Uap", "Staff Packing & Folding", "Operator Stain Removal"
    ], salaryMin: 3500000, salaryMax: 7000000 },
    { name: "Warehouse & Logistics", count: 20, titles: [
      "Warehouse & Inventory Lead", "Staff Gudang Kain & Aksesoris (Trim)", "Staff Gudang Barang Jadi (FG)",
      "Operator Forklift & Material Handler", "Staff Expedisi & Bea Cukai Export"
    ], salaryMin: 3800000, salaryMax: 8500000 },
    { name: "Factory HR & Administration", count: 15, titles: [
      "Plant GA & IR Manager", "Supervisor HR & Payroll Pabrik", "Staff Compliance & Audit Buyer",
      "Staff K3 & Kesehatan Kerja", "Staff Rekrutmen Operator Pabrik", "Komandan Regu Security Pabrik"
    ], salaryMin: 4500000, salaryMax: 14000000 }
  ];

  const ptkpList = ["TK/0", "TK/0", "TK/0", "K/0", "K/1", "K/2", "K/3"];
  const empTypes = ["Karyawan Tetap (PKWTT)", "Karyawan Tetap (PKWTT)", "Kontrak (PKWT)", "Kontrak Borongan (PKWT)"];
  const emps = [];
  let idCounter = 1;

  for (const div of divisions) {
    for (let i = 0; i < div.count; i++) {
      const fn = firstNames[(idCounter - 1) % firstNames.length];
      const ln = lastNames[Math.floor((idCounter - 1) / firstNames.length) % lastNames.length];
      const fullName = `${fn} ${ln}`;
      // pi_employees.id bertipe uuid — id string "ZUS-001" ditolak Postgres (gagal diam-diam).
      // Pakai pola UUID sama seperti Valora, prefix e2 sebagai penanda tenant Zus.
      const hexId = idCounter.toString(16).padStart(12, "0");
      const id = `e2000000-0000-4000-8000-${hexId}`;
      const nik = `360401${String(100000 + idCounter)}`;
      const npwp = `85.${String(100 + idCounter).slice(0, 3)}.${String(idCounter).padStart(3, "0")}.8-402.000`;
      const ptkp = ptkpList[idCounter % ptkpList.length];
      const employment_type = empTypes[idCounter % empTypes.length];
      const position = div.titles[i % div.titles.length];
      const bank = `BCA 8830${String(100000 + idCounter)}`;
      
      const ratio = div.count > 1 ? i / (div.count - 1) : 0;
      const salary = Math.round((div.salaryMax - (div.salaryMax - div.salaryMin) * ratio) / 100000) * 100000;

      emps.push({
        id,
        full_name: fullName,
        nik,
        npwp,
        ptkp_status: ptkp,
        employment_type,
        department: div.name,
        position,
        bank_account: bank,
        upah_pokok: salary
      });

      idCounter++;
    }
  }

  return emps;
}

export const DEMO_ZUS_TEXTILE_EMPLOYEES = generateZusTextile245Employees();

export function getActiveCompanyEmployees(): any[] {
  const compId = getActiveCompanyId();
  if (compId === "22222222-2222-4222-8222-222222222222" || compId === "zus_textile") {
    return DEMO_ZUS_TEXTILE_EMPLOYEES;
  }
  return DEMO_VALORIS_TV_EMPLOYEES;
}

// Auto-seed data demo untuk database (Valora TV & Zus Textile)
export async function ensureDemoEmployeesExist(supabase: any): Promise<void> {
  if (!supabase) return;
  try {
    const valoraEmps = DEMO_VALORIS_TV_EMPLOYEES.map(e => ({ ...e, tenant_id: "11111111-1111-4111-8111-111111111111" }));
    const zusEmps = DEMO_ZUS_TEXTILE_EMPLOYEES.map(e => ({ ...e, tenant_id: "22222222-2222-4222-8222-222222222222" }));
    const allDemoEmployees = [...valoraEmps, ...zusEmps];

    const employeeRows = allDemoEmployees.map((item: any) => ({
      id: item.id,
      tenant_id: item.tenant_id,
      full_name: item.full_name,
      nik: item.nik,
      npwp: item.npwp,
      ptkp_status: item.ptkp_status,
      join_date: "2023-01-01",
      employment_type: item.employment_type,
      risk_class: "I",
      department: item.department,
      position: item.position || item.department,
      bank_account: item.bank_account,
      status: "active"
    }));

    const compRows = allDemoEmployees.map(item => ({
      employee_id: item.id,
      upah_pokok: item.upah_pokok,
      tunjangan_tetap: [],
      tunjangan_tidak_tetap: [],
      effective_date: "2026-01-01"
    }));

    const BATCH_SIZE = 150;
    for (let i = 0; i < employeeRows.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("pi_employees").upsert(employeeRows.slice(i, i + BATCH_SIZE), { onConflict: "id" });
      if (error) { console.error(`Auto-seed pi_employees batch ${i / BATCH_SIZE + 1} gagal:`, error.message); break; }
    }
    for (let i = 0; i < compRows.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("pi_compensation").upsert(compRows.slice(i, i + BATCH_SIZE), { onConflict: "employee_id,effective_date" });
      if (error) { console.error(`Auto-seed pi_compensation batch ${i / BATCH_SIZE + 1} gagal:`, error.message); break; }
    }
  } catch (e) {
    console.error("Gagal auto-seed demo employees:", e);
  }
}

export const ensureRahmatSuradiExists = ensureDemoEmployeesExist;

const STATUTORY_TOGGLES_KEY = "pi_statutory_toggles_v1";

export function getStatutoryToggles(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STATUTORY_TOGGLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setStatutoryToggle(employeeIdOrName: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const toggles = getStatutoryToggles();
    toggles[employeeIdOrName] = enabled;
    localStorage.setItem(STATUTORY_TOGGLES_KEY, JSON.stringify(toggles));
    window.dispatchEvent(new Event("statutory_toggles_changed"));
  } catch {}
}

export function isStatutoryEnabled(employeeId: string, employeeName: string): boolean {
  const toggles = getStatutoryToggles();
  if (toggles[employeeId] !== undefined) return toggles[employeeId];
  if (toggles[employeeName] !== undefined) return toggles[employeeName];
  return true;
}
