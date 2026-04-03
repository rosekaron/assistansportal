import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isAuthEndpoint = err.config?.url?.includes("/auth/");
    if (err.response?.status === 401 && !isAuthEndpoint) {
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
  list:        () => api.get("/assistants"),
  get:         (id: string) => api.get(`/assistants/${id}`),
  create:      (data: Record<string, unknown>) => api.post("/assistants", data),
  update:      (id: string, data: Record<string, unknown>) => api.put(`/assistants/${id}`, data),
  delete:      (id: string) => api.delete(`/assistants/${id}`),
  linkExisting: (assistantId: string, email: string) => api.post("/assistants/link-existing", { assistantId, email }),
  linkStatus:  (id: string) => api.get(`/assistants/${id}/link-status`),
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

// Assistant self-service
export const assistantSelfApi = {
  me:               () => api.get("/assistant/me"),
  entries:          (params?: Record<string, string>) => api.get("/assistant/entries", { params }),
  accept:           (id: string) => api.put(`/assistant/entries/${id}/accept`),
  reject:           (id: string) => api.put(`/assistant/entries/${id}/reject`),
  submitReport:     (id: string) => api.put(`/assistant/entries/${id}/submit-report`),
  openSlots:        () => api.get("/assistant/open-slots"),
  selfBook:         (slotId: string) => api.post(`/assistant/self-book/${slotId}`),
  clockIn:          (id: string) => api.post(`/assistant/entries/${id}/clock-in`),
  clockOut:         (id: string) => api.post(`/assistant/entries/${id}/clock-out`),
  // Multi-family
  families:         () => api.get("/assistant/families"),
  leaveFamily:      (assistantId: string) => api.post(`/assistant/families/${assistantId}/leave`),
  linkRequests:     () => api.get("/assistant/link-requests"),
  acceptLink:       (linkId: string) => api.post(`/assistant/link-requests/${linkId}/accept`),
  declineLink:      (linkId: string) => api.post(`/assistant/link-requests/${linkId}/decline`),
};
