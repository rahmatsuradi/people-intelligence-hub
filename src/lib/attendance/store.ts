import type { AttendanceRecord, LeaveRequest } from "./types";

const STORE_KEY_ATTENDANCE = "hi_attendance_records";
const STORE_KEY_LEAVES = "hi_leave_requests";

export function getAttendance(): AttendanceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORE_KEY_ATTENDANCE);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAttendance(record: AttendanceRecord) {
  if (typeof window === "undefined") return;
  const all = getAttendance();
  const existing = all.findIndex(r => r.id === record.id);
  if (existing >= 0) all[existing] = record;
  else all.push(record);
  localStorage.setItem(STORE_KEY_ATTENDANCE, JSON.stringify(all));
}

export function getLeaves(): LeaveRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORE_KEY_LEAVES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLeave(leave: LeaveRequest) {
  if (typeof window === "undefined") return;
  const all = getLeaves();
  const existing = all.findIndex(r => r.id === leave.id);
  if (existing >= 0) all[existing] = leave;
  else all.push(leave);
  localStorage.setItem(STORE_KEY_LEAVES, JSON.stringify(all));
}
