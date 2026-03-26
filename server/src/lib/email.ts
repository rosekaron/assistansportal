import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Assistansportal" <${process.env.GMAIL_USER}>`;
const BASE = process.env.CLIENT_URL || "http://localhost:5173";

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${BASE}/verify-success?token=${token}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: "Verify your Assistansportal account",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#1e3a8a">Verify your account</h2>
      <p style="color:#475569;margin-bottom:24px">Click below to verify your email and activate your account.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Verify email →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">This link expires in 24 hours.</p>
    </div>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${BASE}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: "Reset your Assistansportal password",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#1e3a8a">Reset your password</h2>
      <p style="color:#475569;margin-bottom:24px">Click below to set a new password. Valid for 1 hour.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Reset password →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't request this, ignore it.</p>
    </div>`,
  });
}

export async function sendAssistantInviteEmail(
  to: string, assistantName: string, guardianName: string,
  patientName: string, token: string, message?: string
) {
  const link = `${BASE}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from: FROM, to,
    subject: `You've been invited to assist ${patientName} — Assistansportal`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#1e3a8a">Hi ${assistantName},</h2>
      <p style="color:#475569;margin-bottom:16px"><strong>${guardianName}</strong> has invited you as a personal assistant for <strong>${patientName}</strong>.</p>
      ${message ? `<blockquote style="border-left:3px solid #e2e8f0;padding-left:12px;color:#64748b;margin-bottom:16px;font-style:italic">${message}</blockquote>` : ""}
      <p style="color:#475569;margin-bottom:24px">View your shifts, accept proposals, and submit time reports — all in one place.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">This invitation expires in 7 days.</p>
    </div>`,
  });
}
