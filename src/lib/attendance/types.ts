export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: "present" | "leave" | "sick" | "absent";
  checkIn?: string; // HH:mm
  checkOut?: string; // HH:mm
  overtimeHours: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: "annual" | "sick" | "maternity" | "unpaid";
  reason: string;
  status: "pending" | "approved" | "rejected";
  appliedAt: string;
}

export interface BurnoutRisk {
  employeeId: string;
  level: "Low" | "Medium" | "High";
  factors: string[];
  recommendation: string;
}
