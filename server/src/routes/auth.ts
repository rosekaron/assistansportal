import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../db";
import { auth, emailVerifications, passwordResets, assistants, invites, profile } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { sendVerificationEmail, sendPasswordResetEmail, sendAssistantInviteEmail } from "../lib/email";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

function makeToken() { return crypto.randomBytes(32).toString("hex"); }
function tokenExpiry(hours: number) { return new Date(Date.now() + hours * 60 * 60 * 1000); }

// ── Register ──────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await db.select().from(auth).where(eq(auth.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "An account with this email already exists" });

    const hash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(auth).values({
      email: email.toLowerCase(), passwordHash: hash,
      role: "guardian", emailVerified: false,
    }).returning();

    const token = makeToken();
    await db.insert(emailVerifications).values({ userId: user.id, token, expiresAt: tokenExpiry(24) });

    let emailSent = false;
    try { await sendVerificationEmail(email, token); emailSent = true; } catch (e) { console.warn("⚠️  Email error:", e); }

    res.json({
      message: emailSent
        ? "Account created. Check your email to verify your account."
        : "Account created. Email sending not configured — use the button below to verify.",
      emailSent,
      devVerifyToken: token, // always return in dev — harmless if email works
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Verify email (redirect from email link) ───────────────────
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ error: "Token required" });

    const [record] = await db.select().from(emailVerifications)
      .where(and(eq(emailVerifications.token, token), gt(emailVerifications.expiresAt, new Date()))).limit(1);
    if (!record) return res.status(400).json({ error: "Invalid or expired link" });

    await db.update(auth).set({ emailVerified: true }).where(eq(auth.id, record.userId));
    await db.delete(emailVerifications).where(eq(emailVerifications.id, record.id));

    const [user] = await db.select().from(auth).where(eq(auth.id, record.userId)).limit(1);
    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/verify-success?token=${jwtToken}&role=${user.role}`);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Dev-only: verify without email ────────────────────────────
router.post("/dev-verify", async (req, res) => {
  try {
    const { token } = req.body;
    const [record] = await db.select().from(emailVerifications).where(eq(emailVerifications.token, token)).limit(1);
    if (!record) return res.status(400).json({ error: "Token not found" });

    await db.update(auth).set({ emailVerified: true }).where(eq(auth.id, record.userId));
    await db.delete(emailVerifications).where(eq(emailVerifications.id, record.id));

    const [user] = await db.select().from(auth).where(eq(auth.id, record.userId)).limit(1);
    const jwtToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token: jwtToken, role: user.role, message: "Email verified" });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [user] = await db.select().from(auth).where(eq(auth.email, email.toLowerCase())).limit(1);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    if (!user.emailVerified) return res.status(403).json({
      error: "Please verify your email before logging in",
      code: "EMAIL_NOT_VERIFIED",
    });

    const token = jwt.sign({ userId: user.id, role: user.role, assistantId: user.assistantId }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, userId: user.id, role: user.role, assistantId: user.assistantId ?? null });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Resend verification ───────────────────────────────────────
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const [user] = await db.select().from(auth).where(eq(auth.email, email.toLowerCase())).limit(1);
    if (user && !user.emailVerified) {
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id));
      const token = makeToken();
      await db.insert(emailVerifications).values({ userId: user.id, token, expiresAt: tokenExpiry(24) });
      try { await sendVerificationEmail(email, token); } catch {}
    }
    res.json({ message: "If this email exists and is unverified, a new link has been sent." });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Forgot password ───────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const [user] = await db.select().from(auth).where(eq(auth.email, email.toLowerCase())).limit(1);
    if (user) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
      const token = makeToken();
      await db.insert(passwordResets).values({ userId: user.id, token, expiresAt: tokenExpiry(1) });
      try { await sendPasswordResetEmail(email, token); } catch {}
    }
    res.json({ message: "If this email exists, a reset link has been sent." });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Reset password ────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const [record] = await db.select().from(passwordResets)
      .where(and(eq(passwordResets.token, token), eq(passwordResets.used, false), gt(passwordResets.expiresAt, new Date()))).limit(1);
    if (!record) return res.status(400).json({ error: "Invalid or expired reset link" });

    const hash = await bcrypt.hash(password, 12);
    await db.update(auth).set({ passwordHash: hash }).where(eq(auth.id, record.userId));
    await db.update(passwordResets).set({ used: true }).where(eq(passwordResets.id, record.id));
    res.json({ message: "Password updated. You can now log in." });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Accept assistant invite ───────────────────────────────────
router.post("/accept-invite", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });

    const [invite] = await db.select().from(invites)
      .where(and(eq(invites.id, token), eq(invites.status, "pending"))).limit(1);
    if (!invite) return res.status(400).json({ error: "Invalid or expired invite. Ask your guardian to resend it." });

    const existing = await db.select().from(auth).where(eq(auth.email, invite.email)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });

    const [assistant] = await db.select().from(assistants).where(eq(assistants.email, invite.email)).limit(1);

    const hash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(auth).values({
      email: invite.email, passwordHash: hash,
      role: "assistant", emailVerified: true,
      assistantId: assistant?.id ?? null,
    }).returning();

    if (assistant) {
      await db.update(assistants).set({ authId: user.id, inviteStatus: "accepted" }).where(eq(assistants.id, assistant.id));
    }
    await db.update(invites).set({ status: "accepted" }).where(eq(invites.id, invite.id));

    const jwtToken = jwt.sign({ userId: user.id, role: "assistant", assistantId: assistant?.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token: jwtToken, role: "assistant", assistantId: assistant?.id ?? null, message: "Account created. Welcome!" });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Send assistant invite email ───────────────────────────────
router.post("/send-invite-email", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { inviteId } = req.body;
    const [invite] = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);
    if (!invite) return res.status(404).json({ error: "Invite not found" });

    const [prof] = await db.select().from(profile).limit(1);
    try {
      await sendAssistantInviteEmail(
        invite.email, invite.name,
        prof?.guardianName ?? "Your guardian",
        prof?.patientName  ?? "the person in care",
        invite.id, invite.message ?? ""
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "Could not send email: " + String(e) });
    }
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Get current user ──────────────────────────────────────────
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(auth).where(eq(auth.id, req.userId!)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email, role: user.role, assistantId: user.assistantId, verified: user.emailVerified });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
