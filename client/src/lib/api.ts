import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Absence types
export type AbsenceType = "sjukfrånvaro" | "vab" | "semester" | "other";

export type Absence = {
  id: string;
  guardianId: number;
  assistantId: string | null;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  createdAt: string;
};

export type AbsenceBalance = {
  vabRemaining: number;
  sickDays: number;
  year: number;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  register:           (email: string, password: string) =>
    api.post<{ message: string; devVerifyToken?: string }>("/auth/register", { email, password }),
  login:              (email: string, password: string) =>
    api.post<{ token: string; role: string; assistantId?: string }>("/auth/login", { email, password }),
  me:                 () => api.get("/auth/me"),
  resendVerification: (email: string) => api.post("/auth/resend-verification", { email }),
  forgotPassword:     (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword:      (token: string, password: string) => api.post("/auth/reset-password", { token, password }),
  acceptInvite:       (token: string, password: string) =>
    api.post<{ token: string; role: string; assistantId?: string }>("/auth/accept-invite", { token, password }),
  sendInviteEmail:    (inviteId: string) => api.post("/auth/send-invite-email", { inviteId }),
  devVerify:          (token: string) =>
    api.post<{ token: string; role: string }>("/auth/dev-verify", { token }),
};

// Profile
export const profileApi = {
  get:    () => api.get("/profile"),
  update: (data: Record<string, unknown>) => api.put("/profile", data),
};

// Assistants
export const assistantsApi = {
  list:   () => api.get("/assistants"),
  create: (data: Record<string, unknown>) => api.post("/assistants", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/assistants/${id}`, data),
  delete: (id: string) => api.delete(`/assistants/${id}`),
};

// Entries
export const entriesApi = {
  list:       (params?: Record<string, string>) => api.get("/entries", { params }),
  create:     (data: Record<string, unknown>) => api.post("/entries", data),
  bulkCreate: (items: Record<string, unknown>[]) => api.post("/entries/bulk", { items }),
  update:     (id: string, data: Record<string, unknown>) => api.put(`/entries/${id}`, data),
  delete:     (id: string) => api.delete(`/entries/${id}`),
};

// Slots
export const slotsApi = {
  list:   () => api.get("/slots"),
  create: (data: Record<string, unknown>) => api.post("/slots", data),
  delete: (id: string) => api.delete(`/slots/${id}`),
};

// Blocked
export const blockedApi = {
  list:   () => api.get("/blocked"),
  create: (data: Record<string, unknown>) => api.post("/blocked", data),
  delete: (id: string) => api.delete(`/blocked/${id}`),
};

// Invites
export const invitesApi = {
  list:   () => api.get("/invites"),
  create: (data: Record<string, unknown>) => api.post("/invites", data),
  update: (id: string, status: string) => api.put(`/invites/${id}`, { status }),
  delete: (id: string) => api.delete(`/invites/${id}`),
};

// Settings
export const settingsApi = {
  get:    () => api.get("/settings"),
  update: (data: Record<string, string>) => api.put("/settings", data),
};

// PDF
export const pdfApi = {
  forms:  () => api.get("/pdf/forms"),
  fk3057: (year: string, month: string) =>
    api.post("/pdf/fk3057", { year, month }, { responseType: "blob" }),
  fk3059: (year: string, month: string, assistantId: string) =>
    api.post("/pdf/fk3059", { year, month, assistantId }, { responseType: "blob" }),
};

// Costs
export const costsApi = {
  list:   (month?: string) => api.get("/costs", { params: month ? { month } : {} }),
  create: (data: Record<string, unknown>) => api.post("/costs", data),
  delete: (id: string) => api.delete(`/costs/${id}`),
};

// Google Calendar
export const gcalApi = {
  status:      () => api.get("/gcal/status"),
  connectUrl:  () => `${window.location.origin}/api/gcal/connect`,
  disconnect:  () => api.post("/gcal/disconnect"),
  events:      (start: string, end: string) => api.get("/gcal/events", { params: { start, end } }),
  createEvent: (data: Record<string, unknown>) => api.post("/gcal/events", data),
  deleteEvent: (eventId: string) => api.delete(`/gcal/events/${eventId}`),
};

// Rates (env-var sourced from server)
export const ratesApi = {
  get: () => api.get<{ fkHourlyRate: number; employerTaxRate: number }>("/rates"),
};

// Absences
export const absenceApi = {
  list:    (params?: Record<string, string>) =>
    api.get<Absence[]>("/absences", { params }),
  create:  (data: Record<string, unknown>) =>
    api.post<Absence>("/absences", data),
  delete:  (id: string) =>
    api.delete<{ ok: boolean }>(`/absences/${id}`),
  balance: (assistantId: string) =>
    api.get<AbsenceBalance>(`/absences/balance/${assistantId}`),
};

// Payroll
export type PayrollRecord = {
  id: string;
  assistantId: string;
  month: string;                 // YYYY-MM
  billableHours: number;
  hourlyRateSnapshot: number;
  taxRateSnapshot: number;
  grossPay: number;
  employerContributions: number;
  totalEmployerCost: number;
  absenceBreakdownJson: string | null;  // JSON: {"sjukfrånvaro":h,"vab":h,"semester":h,"other":h} (PAY-02)
  status: "draft" | "approved";
  approvedAt: string | null;
  createdAt: string;
};

export type Payment = {
  id: string;
  payrollRecordId: string;
  assistantId: string;
  date: string;                  // YYYY-MM-DD
  amountSek: number;
  method: "bankgiro" | "swish" | "kontant";
  createdAt: string;
};

export const payrollApi = {
  list:     (month: string) =>
    api.get<PayrollRecord[]>("/payroll", { params: { month } }),
  generate: (month: string) =>
    api.post<PayrollRecord[]>("/payroll/generate", { month }),
  approve:  (id: string) =>
    api.post<PayrollRecord>(`/payroll/${id}/approve`),
};

export const paymentsApi = {
  list: (payrollRecordId: string) =>
    api.get<Payment[]>("/payments", { params: { payrollRecordId } }),
  create: (data: {
    payrollRecordId: string;
    assistantId: string;
    date: string;
    amountSek: number;
    method: "bankgiro" | "swish" | "kontant";
  }) => api.post<Payment>("/payments", data),
  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/payments/${id}`),
};

// Assistant self-service
export const assistantSelfApi = {
  me:           () => api.get("/assistant/me"),
  entries:      (params?: Record<string, string>) => api.get("/assistant/entries", { params }),
  accept:       (id: string) => api.put(`/assistant/entries/${id}/accept`),
  reject:       (id: string) => api.put(`/assistant/entries/${id}/reject`),
  submitReport: (id: string) => api.put(`/assistant/entries/${id}/submit-report`),
  openSlots:    () => api.get("/assistant/open-slots"),
  selfBook:     (slotId: string) => api.post(`/assistant/self-book/${slotId}`),
};
