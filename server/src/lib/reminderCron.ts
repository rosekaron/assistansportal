import cron from "node-cron";
import { db } from "../db";
import { settings, profile } from "../db/schema";
import { sendComplianceReminderEmail } from "./email";

/**
 * Pure function: given today's day of month and the configured reminder day,
 * should the cron send a reminder today?
 * Returns false for invalid reminder days (< 1 or > 28).
 */
export function shouldSendReminder(todayDay: number, reminderDay: number): boolean {
  if (reminderDay < 1 || reminderDay > 28) return false;
  return todayDay === reminderDay;
}

/**
 * Pure function: given approved step flags, return list of pending step descriptions.
 * Used to build the email body.
 */
export function buildPendingSteps(flags: {
  reportsApproved: boolean;
  payrollApproved: boolean;
  fkGenerated: boolean;
  agiGenerated: boolean;
}): string[] {
  const steps: string[] = [];
  if (!flags.reportsApproved) steps.push("Approve daily time reports");
  if (!flags.payrollApproved) steps.push("Approve payroll records");
  if (!flags.fkGenerated)     steps.push("Generate FK forms (FK 3059 and FK 3057)");
  if (!flags.agiGenerated)    steps.push("Generate blankett 4805 (AGI)");
  return steps;
}

/**
 * Start the daily cron job that sends compliance reminders.
 * Must be called inside main() after seedDefaults().
 * Fires at 08:00 every day (Europe/Stockholm time).
 */
export function startReminderCron(): void {
  cron.schedule("0 8 * * *", async () => {
    try {
      const today = new Date();
      const dayOfMonth = today.getDate();

      // Read reminder_day from settings key-value table
      const settingsRows = await db.select().from(settings);
      const reminderDayStr = settingsRows.find(r => r.key === "reminder_day")?.value ?? "1";
      const reminderDay = parseInt(reminderDayStr, 10);

      if (!shouldSendReminder(dayOfMonth, reminderDay)) return;

      // Read guardian email from profile table (authoritative source — T-5-02 guard)
      const profileRows = await db.select().from(profile);
      const guardianEmail = profileRows[0]?.guardianEmail ?? "";
      if (!guardianEmail) {
        console.warn("[cron] guardian_email not configured — skipping reminder");  // T-5-02: no email in log
        return;
      }

      // Determine reporting month (previous calendar month)
      const reportMonth = today.getMonth() === 0
        ? `${today.getFullYear() - 1}-12`
        : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, "0")}`;

      // Check pending steps by querying entries and payroll for reportMonth
      const { entries: entriesTable, payrollRecords } = await import("../db/schema");
      const { eq, like } = await import("drizzle-orm");

      // Reports: any approved entries for this month?
      const monthEntries = await db.select()
        .from(entriesTable)
        .where(like(entriesTable.date, `${reportMonth}%`));
      const reportsApproved = monthEntries.length > 0 &&
        monthEntries.every(e => e.repStatus === "approved");

      // Payroll: any approved payroll records for this month?
      const payrollRows = await db.select()
        .from(payrollRecords)
        .where(eq(payrollRecords.month, reportMonth));
      const payrollApproved = payrollRows.length > 0 &&
        payrollRows.every(r => r.status === "approved");

      // FK and AGI generation cannot be detected from DB alone (no download log);
      // treat as pending if payroll is not yet fully approved.
      const fkGenerated  = payrollApproved;
      const agiGenerated = payrollApproved;

      const pendingSteps = buildPendingSteps({
        reportsApproved,
        payrollApproved,
        fkGenerated,
        agiGenerated,
      });

      await sendComplianceReminderEmail(guardianEmail, reportMonth, pendingSteps);
    } catch (err) {
      console.error("[cron] Reminder cron failed:", err);
    }
  }, { timezone: "Europe/Stockholm" });
}
