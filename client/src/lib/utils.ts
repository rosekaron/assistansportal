import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export function getWeekDates(offset = 0): string[] {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function toYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function hhmm(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
