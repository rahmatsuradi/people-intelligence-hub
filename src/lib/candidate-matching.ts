import { type CandidateRecord, type JobRequisition, type TalentProfile, getCandidate, saveCandidate, getTalentPool } from "./store";

export interface CandidateMatchResult {
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: "Highly Recommended" | "Good Fit" | "Potential Match" | "Low Match";
  reasons: string[];
}

export function matchCandidateToJobReq(
  candidate: CandidateRecord | TalentProfile,
  req: JobRequisition
): CandidateMatchResult {
  let score = 0;
  const reasons: string[] = [];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  const reqText = `${req.title} ${req.department} ${req.requirements} ${req.description}`.toLowerCase();
  
  // Extract key skills/keywords from requirements
  const potentialSkills = [
    "kamera", "editing", "video editor", "cameraman", "mcr", "broadcast", "penyiaran",
    "reporter", "jurnalistik", "redaksi", "anchor", "scriptwriter", "audio", "lighting", "satpam", "security",
    "react", "typescript", "node", "hr", "payroll", "finance", "accounting"
  ];

  const reqSkills = potentialSkills.filter(s => reqText.includes(s));

  // Extract candidate skills & notes text
  let candidateSkills: string[] = [];
  let candidateTitle = "";
  let candidateLoc = "";
  let cvScore = 0;

  if ("skills" in candidate) {
    // TalentProfile
    candidateSkills = candidate.skills.map(s => s.toLowerCase());
    candidateTitle = candidate.category;
    candidateLoc = candidate.location;
  } else {
    // CandidateRecord
    candidateTitle = candidate.position.toLowerCase();
    candidateLoc = candidate.department.toLowerCase();
    cvScore = candidate.cvAnalysis?.overallScore || 0;
    
    // Extract skills from notes and position
    candidateSkills = potentialSkills.filter(s => 
      `${candidate.position} ${candidate.notes} ${candidate.cvAnalysis?.summary || ""}`.toLowerCase().includes(s)
    );
  }

  // 1. Role Title / Category Alignment (Max 30 pts)
  const titleOverlap = req.title.toLowerCase().split(/\s+/).some(term => 
    term.length > 3 && (candidateTitle.includes(term) || reqText.includes(candidateTitle))
  );
  if (titleOverlap) {
    score += 30;
    reasons.push(`Posisi/pengalaman relevan dengan lowongan ${req.title}`);
  } else {
    score += 10;
  }

  // 2. Skill Match (Max 40 pts)
  if (reqSkills.length > 0) {
    reqSkills.forEach(skill => {
      const hasSkill = candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs));
      if (hasSkill) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    });

    const skillRatio = matchedSkills.length / Math.max(reqSkills.length, 1);
    const skillScore = Math.round(skillRatio * 40);
    score += skillScore;

    if (matchedSkills.length > 0) {
      reasons.push(`Memiliki keahlian utama: ${matchedSkills.join(", ")}`);
    }
  } else {
    score += 25; // Default baseline if job req doesn't specify strict skills
  }

  // 3. AI CV Score or Rating Bonus (Max 20 pts)
  if (cvScore > 0) {
    const cvBonus = Math.round((cvScore / 100) * 20);
    score += cvBonus;
    reasons.push(`Skor AI CV Analysis: ${cvScore}/100`);
  } else if ("rating" in candidate && candidate.rating > 0) {
    const ratingBonus = Math.round((candidate.rating / 5) * 20);
    score += ratingBonus;
    reasons.push(`Rating Performa: ${candidate.rating.toFixed(1)}/5.0`);
  } else {
    score += 10;
  }

  // 4. Location & Availability (Max 10 pts)
  if (candidateLoc && req.location.toLowerCase().includes(candidateLoc.toLowerCase())) {
    score += 10;
    reasons.push(`Lokasi domisili cocok (${candidateLoc})`);
  } else {
    score += 5;
  }

  // Clamp 0 to 100
  const finalPercentage = Math.min(100, Math.max(0, score));

  let recommendation: CandidateMatchResult["recommendation"] = "Low Match";
  if (finalPercentage >= 80) recommendation = "Highly Recommended";
  else if (finalPercentage >= 65) recommendation = "Good Fit";
  else if (finalPercentage >= 50) recommendation = "Potential Match";

  return {
    matchPercentage: finalPercentage,
    matchedSkills,
    missingSkills,
    recommendation,
    reasons,
  };
}

export function rankCandidatesForJobReq(
  candidates: (CandidateRecord | TalentProfile)[],
  req: JobRequisition
): { item: CandidateRecord | TalentProfile; match: CandidateMatchResult }[] {
  return candidates
    .map(c => ({ item: c, match: matchCandidateToJobReq(c, req) }))
    .sort((a, b) => b.match.matchPercentage - a.match.matchPercentage);
}

export function promoteTalentToCandidate(talentId: string, jobReq: JobRequisition): CandidateRecord | null {
  const talents = getTalentPool();
  const talent = talents.find(t => t.id === talentId);
  if (!talent) return null;

  const newId = `C-TALENT-${Date.now()}`;
  const now = new Date().toISOString();

  const newCandidate: CandidateRecord = {
    id: newId,
    name: talent.name,
    email: `${talent.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    phone: talent.phone,
    stage: "applied",
    jobReqId: jobReq.id,
    department: jobReq.department,
    position: jobReq.title,
    source: "Talent Pool",
    notes: `Dipromosikan dari Talent Pool (Kategori: ${talent.category}, Lokasi: ${talent.location}, Skills: ${talent.skills.join(", ")}).`,
    cvAnalysis: null,
    interviewResults: [],
    createdAt: now,
    updatedAt: now,
  };

  saveCandidate(newCandidate);
  return newCandidate;
}
