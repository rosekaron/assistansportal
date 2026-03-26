export interface ActivityType {
  id:       string;
  label:    string;
  icon:     string;
  capacity: number;
  color:    string;
  desc:     string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: "horse_riding",  label: "Horse riding",      icon: "🐴", capacity: 2, color: "#7c3aed", desc: "Requires 2 for mounting, safety & support" },
  { id: "swimming",      label: "Swimming",          icon: "🏊", capacity: 2, color: "#0891b2", desc: "Requires 2 for water safety" },
  { id: "physiotherapy", label: "Physiotherapy",     icon: "🏋️", capacity: 2, color: "#059669", desc: "Requires 2 for support and technique" },
  { id: "active_time",   label: "Active time",       icon: "⚡", capacity: 2, color: "#d97706", desc: "Physical play requiring 2 for safety" },
  { id: "bathing",       label: "Bathing / hygiene", icon: "🛁", capacity: 2, color: "#6366f1", desc: "Requires 2 for safe handling" },
  { id: "feeding",       label: "Feeding / meals",   icon: "🍽️", capacity: 2, color: "#dc2626", desc: "Requires 2 when feeding assistance needed" },
  { id: "personal_care", label: "Personal care",     icon: "🧼", capacity: 1, color: "#059669", desc: "Dressing, grooming — 1 assistant" },
  { id: "school",        label: "School support",    icon: "🏫", capacity: 1, color: "#0891b2", desc: "Educational and social support" },
  { id: "companionship", label: "Companionship",     icon: "💬", capacity: 1, color: "#475569", desc: "Social activities and play" },
  { id: "sleep",         label: "Overnight / sleep", icon: "🌙", capacity: 1, color: "#334155", desc: "Night supervision" },
  { id: "custom",        label: "Other / custom",    icon: "⚙️", capacity: 1, color: "#64748b", desc: "Set capacity manually" },
];

export const activityById = (id?: string | null): ActivityType =>
  ACTIVITY_TYPES.find((a) => a.id === id) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
