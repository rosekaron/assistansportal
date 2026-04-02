import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { profileApi } from "@/lib/api";

import Layout             from "@/components/Layout";
import LoginPage          from "@/pages/Login";
import SetupWizard        from "@/pages/SetupWizard";
import VerifySuccess      from "@/pages/VerifySuccess";
import AcceptInvite       from "@/pages/AcceptInvite";
import ResetPassword      from "@/pages/ResetPassword";
import Dashboard          from "@/pages/Dashboard";
import CalendarPage       from "@/pages/Calendar";
import HoursPage          from "@/pages/Hours";
import ReportsPage        from "@/pages/Reports";
import AssistantsPage     from "@/pages/Assistants";
import SettingsPage       from "@/pages/Settings";
import AssistantDashboard from "@/pages/AssistantDashboard";
import AssistantDetail    from "@/pages/AssistantDetail";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token    = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireGuardian({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role);
  if (role === "assistant") return <Navigate to="/assistant" replace />;
  return <>{children}</>;
}

function RequireAssistant({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role);
  if (role === "guardian") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireSetup({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn:  () => profileApi.get().then((r) => r.data),
    enabled:  !!token,
  });
  if (isLoading) return (
    <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
  // Allow entry even without setup — wizard is optional on first run
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/verify-success" element={<VerifySuccess />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite"  element={<AcceptInvite />} />

      {/* Guardian setup wizard */}
      <Route path="/setup" element={
        <RequireAuth><RequireGuardian><SetupWizard /></RequireGuardian></RequireAuth>
      } />

      {/* Assistant dashboard */}
      <Route path="/assistant" element={
        <RequireAuth><RequireAssistant><AssistantDashboard /></RequireAssistant></RequireAuth>
      } />

      {/* Guardian app */}
      <Route element={
        <RequireAuth><RequireGuardian><RequireSetup><Layout /></RequireSetup></RequireGuardian></RequireAuth>
      }>
        <Route index             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar"  element={<CalendarPage />} />
        <Route path="/hours"     element={<HoursPage />} />
        <Route path="/reports"   element={<ReportsPage />} />
        <Route path="/assistants"    element={<AssistantsPage />} />
        <Route path="/assistants/:id" element={<AssistantDetail />} />
        <Route path="/settings"  element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
