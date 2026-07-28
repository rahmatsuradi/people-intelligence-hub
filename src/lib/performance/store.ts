import { PerformanceReview } from "./types";

const STORE_KEY = "hi_performance_reviews";

export function getReviews(): PerformanceReview[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveReview(review: PerformanceReview) {
  if (typeof window === "undefined") return;
  const all = getReviews();
  const existing = all.findIndex(r => r.id === review.id);
  if (existing >= 0) {
    all[existing] = review;
  } else {
    all.push(review);
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}

export function getReview(employeeId: string, period: string): PerformanceReview | undefined {
  return getReviews().find(r => r.employeeId === employeeId && r.period === period);
}
