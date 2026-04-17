import cron from "node-cron";
import { db } from "../db";
import { profile } from "../db/schema";

/**
 * Pure function: given today's day of month and the configured reminder day,
 * should the cron send a reminder today?
 * Returns false for invalid reminder days (< 1 or > 28).
 */
export function shouldSendReminder(todayDay: number, reminderDay: number): boolean {
  throw new Error("Not implemented");
}

/**
 * Pure function: given approved step flags, return list of pending step descriptions.
 * Used to build the email body.
 */
export function buildPendingSteps(_flags: {
  reportsApproved: boolean;
  payrollApproved: boolean;
  fkGenerated: boolean;
  agiGenerated: boolean;
}): string[] {
  throw new Error("Not implemented");
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

      // Read reminder_day from settings (key-value table)
      const { settings } = await import("../db/schema");
      const settingsRows = await db.select().from(settings);
      const reminderDayStr = settingsRows.find(r => r.key === "reminder_day")?.value ?? "1";
      const reminderDay = parseInt(reminderDayStr, 10);

      if (!shouldSendReminder(dayOfMonth, reminderDay)) return;

      // Read guardian email from profile table (authoritative source)
      const profileRows = await db.select().from(profile);
      const guardianEmail = profileRows[0]?.guardianEmail ?? "";
      if (!guardianEmail) {
        // T-5-W0-02: do not log the full email address
        console.warn(`[cron] guardian_email not configured — skipping reminder`);
        return;
      }

      // Determine reporting month (previous month)
      const reportMonth = today.getMonth() === 0
        ? `${today.getFullYear() - 1}-12`
        : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, "0")}`;

      // TODO: query entries/payroll to build pending steps (implemented in Plan 04)
      const pendingSteps = ["Approve daily reports", "Approve payroll", "Generate FK forms", "Generate blankett 4805"];

      const { sendComplianceReminderEmail } = await import("./email") as any;
      await sendComplianceReminderEmail(guardianEmail, reportMonth, pendingSteps);
    } catch (err) {
      console.error("[cron] Reminder cron failed:", err);
    }
  }, { timezone: "Europe/Stockholm" });
}
