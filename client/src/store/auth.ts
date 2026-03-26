import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token:       string | null;
  role:        "guardian" | "assistant" | null;
  assistantId: string | null;
  setAuth:     (token: string, role: string, assistantId?: string | null) => void;
  logout:      () => void;
  isAuthed:    () => boolean;
  isGuardian:  () => boolean;
  isAssistant: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:       null,
      role:        null,
      assistantId: null,
      setAuth: (token, role, assistantId = null) => {
        localStorage.setItem("token", token);
        set({ token, role: role as "guardian" | "assistant", assistantId });
      },
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, role: null, assistantId: null });
      },
      isAuthed:    () => !!get().token,
      isGuardian:  () => get().role === "guardian",
      isAssistant: () => get().role === "assistant",
    }),
    { name: "auth" }
  )
);
