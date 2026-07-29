/* ═══════════════════════════════════════════════════════════════════════════
   API Route: /api/send-email

   Sends candidate emails directly from the server (no "open a tab" step) via
   SMTP — simplest path to real sending. Configure with a Gmail App Password:

     SMTP_HOST   (default: smtp.gmail.com)
     SMTP_PORT   (default: 465, SSL)
     SMTP_USER   the sending Gmail address
     SMTP_PASS   a Gmail App Password (Google Account → Security → App passwords)
     SMTP_FROM   optional display From (default: SMTP_USER)

   GET  → { configured } so the client can show/hide the "send directly" button.
   POST → { to, subject, body } sends the email.

   If SMTP isn't configured the endpoint reports it (503) and the UI falls back
   to Gmail web compose / mailto.
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function smtpConfig() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
    from: process.env.SMTP_FROM ?? user,
  };
}

export async function GET() {
  return NextResponse.json({ configured: smtpConfig() !== null });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function POST(request: NextRequest) {
  const cfg = smtpConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Email sending not configured. Set SMTP_USER and SMTP_PASS." },
      { status: 503 },
    );
  }

  let body: { to?: string; subject?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const text = body.body ?? "";
  if (!isEmail(to)) {
    return NextResponse.json({ ok: false, error: "Alamat email penerima tidak valid" }, { status: 400 });
  }
  if (!subject || !text.trim()) {
    return NextResponse.json({ ok: false, error: "Subjek dan isi email wajib diisi" }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.auth,
    });
    const info = await transporter.sendMail({ from: cfg.from, to, subject, text });
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
