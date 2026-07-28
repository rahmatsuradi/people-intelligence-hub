export interface CompetencyScore {
  code: string; // dari SKKNI, misal M.70100.001.01
  score: number; // 1-5
  notes?: string;
}

export interface KPIResult {
  metric: string;
  target: string;
  actual: string;
  score: number; // 1-5
}

export interface AIInsight {
  strengths: string[];
  gaps: string[];
  actionPlan: string;
  potentialScore: number; // 1-100 (dari AI)
  performanceScore: number; // 1-100 (dari rata-rata KPI)
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  period: string; // e.g. "2026-H1"
  status: "draft" | "submitted" | "analyzed";
  kpis: KPIResult[];
  competencies: CompetencyScore[];
  aiInsight?: AIInsight;
  updatedAt: string;
}
