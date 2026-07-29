/* ═══════════════════════════════════════════════════════════════════════════
   Integrations — link-based connectors that work with zero backend / OAuth.

   These build standard deep-links and files that any user can use immediately:
   - Gmail web compose (pre-filled)          → no OAuth, opens in a new tab
   - Google Calendar event template          → no OAuth, opens pre-filled event
   - .ics calendar file (RFC 5545)           → universal (Outlook, Apple, etc.)
   - Indeed job search                        → opens a pre-filled search

   Full API / two-way sync (Gmail API send, Workday/Greenhouse) needs OAuth
   credentials the deploying team must provision — those live on the
   Integrations page as "requires setup".
═══════════════════════════════════════════════════════════════════════════ */

/* ─── Gmail ─── */

/** Gmail web "compose" deep-link, pre-filled. Opens in the user's logged-in Gmail. */
export function buildGmailCompose(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** Outlook web "compose" deep-link, pre-filled. */
export function buildOutlookCompose(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ path: "/mail/action/compose", to, subject, body });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

/* ─── Calendar ─── */

export interface CalendarEvent {
  title: string;
  details?: string;
  location?: string;
  /** Start time. */
  start: Date;
  /** Duration in minutes (default 45). */
  durationMin?: number;
  /** Guest emails to invite. */
  guests?: string[];
}

/** Format a Date as an iCalendar UTC timestamp: 20260705T090000Z */
function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function eventEnd(ev: CalendarEvent): Date {
  return new Date(ev.start.getTime() + (ev.durationMin ?? 45) * 60000);
}

/** Google Calendar "render event" template URL, pre-filled. No OAuth needed. */
export function buildGoogleCalendar(ev: CalendarEvent): string {
  const dates = `${toIcsUtc(ev.start)}/${toIcsUtc(eventEnd(ev))}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates });
  if (ev.details) params.set("details", ev.details);
  if (ev.location) params.set("location", ev.location);
  for (const g of ev.guests ?? []) if (g.trim()) params.append("add", g.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Build a universal .ics file body (RFC 5545) — works with Outlook, Apple, etc. */
export function buildIcs(ev: CalendarEvent): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@hire-intelligence`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hire Intelligence//Interview Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(ev.start)}`,
    `DTEND:${toIcsUtc(eventEnd(ev))}`,
    `SUMMARY:${esc(ev.title)}`,
  ];
  if (ev.details) lines.push(`DESCRIPTION:${esc(ev.details)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  for (const g of ev.guests ?? []) {
    if (g.trim()) lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${g.trim()}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file for the given event. */
export function downloadIcs(ev: CalendarEvent, filename = "interview.ics"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Indeed ─── */

/** Indeed job-search deep-link (Indonesia site), pre-filled with a query + location. */
export function buildIndeedSearch(query: string, location = ""): string {
  const params = new URLSearchParams({ q: query });
  if (location.trim()) params.set("l", location.trim());
  return `https://id.indeed.com/jobs?${params.toString()}`;
}
