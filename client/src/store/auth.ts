import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token:          string | null;
  role:           "guardian" | "assistant" | null;
  assistantId:    string | null;
  /** Guardian who has linked an assistant record can switch to assistant view */
  activeView:     "guardian" | "assistant";
  setAuth:        (token: string, role: string, assistantId?: string | null) => void;
  setAssistantId: (id: string) => void;
  setActiveView:  (view: "guardian" | "assistant") => void;
  logout:         () => void;
  isAuthed:       () => boolean;
  isGuardian:     () => boolean;
  isAssistant:    () => boolean;
  /** True when this guardian has a linked assistant record */
  isDualRole:     () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:       null,
      role:        null,
      assistantId: null,
      activeView:  "guardian",
      setAuth: (token, role, assistantId = null) => {
        localStorage.setItem("token", token);
        set({
          token,
          role:       role as "guardian" | "assistant",
          assistantId,
          activeView: role === "assistant" ? "assistant" : "guardian",
        });
      },
      setAssistantId: (id) => set({ assistantId: id }),
      setActiveView:  (view) => set({ activeView: view }),
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, role: null, assistantId: null, activeView: "guardian" });
      },
      isAuthed:    () => !!get().token,
      isGuardian:  () => get().role === "guardian",
      isAssistant: () => get().role === "assistant",
      isDualRole:  () => get().role === "guardian" && !!get().assistantId,
    }),
    { name: "auth" }
  )
);
