// Client-side type definitions mirroring server/src/db/schema.ts
// Per D-05: types duplicated client-side (no shared workspace in this monorepo).
// Keep in sync with server/src/db/schema.ts when schema changes.

export type EntryType  = "active" | "waiting" | "standby" | "sick";
export type ReqStatus  = "pending" | "approved" | "rejected";
export type RepStatus  = "draft" | "pending" | "approved" | "rejected";
export type Source     = "proposal" | "self_book";
export type CalStatus  = "tentative" | "confirmed";

export interface Entry {
  id:          string;
  assistantId: string;
  date:        string;
  startTime:   string;
  endTime:     string;
  hours:       number;
  entryType:   EntryType | null;
  reqStatus:   ReqStatus | null;
  repStatus:   RepStatus | null;
  source:      Source | null;
  calStatus:   CalStatus | null;
  activityId:  string | null;
  gcalEventId: string | null;
  createdAt:   string | null;
  updatedAt:   string | null;
}

export interface Blocked {
  id:        string;
  date:      string;
  startTime: string;
  endTime:   string;
  reason:    string | null;
  createdAt: string | null;
}

export interface Assistant {
  id:             string;
  name:           string;
  initials:       string | null;
  color:          string | null;
  personnummer:   string | null;
  email:          string | null;
  phone:          string | null;
  minWeeklyHours: number | null;
  isFlexible:     boolean | null;
  createdAt:      string | null;
}

export interface Rates {
  fkHourlyRate:    number;
  employerTaxRate: number;
}
