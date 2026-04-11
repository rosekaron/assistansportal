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
import HomePage           from "@/pages/Home";
import SettingsPage       from "@/pages/Settings";
import AssistantDashboard from "@/pages/AssistantDashboard";

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
  if (role === "guardian") return <Navigate to="/home" replace />;
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
        {/* ── New IA routes (Plans 05-08 wire the real components) ── */}
        <Route index              element={<Navigate to="/home" replace />} />
        <Route path="/home"       element={<HomePage />} />
        <Route path="/monthly"    element={<Dashboard />} />       {/* stub → Plan 06 replaces with Monthly.tsx */}
        <Route path="/records"    element={<Dashboard />} />       {/* stub → Plan 07 replaces with Records.tsx */}
        <Route path="/settings"   element={<SettingsPage />} />    {/* Plan 08 updates Settings.tsx in place */}

        {/* ── Legacy redirects — keep all old bookmarks working ── */}
        <Route path="/dashboard"  element={<Navigate to="/home"     replace />} />
        <Route path="/calendar"   element={<Navigate to="/home"     replace />} />
        <Route path="/schedule"   element={<Navigate to="/home"     replace />} />
        <Route path="/reports"    element={<Navigate to="/monthly"  replace />} />
        <Route path="/compliance" element={<Navigate to="/monthly"  replace />} />
        <Route path="/payroll"    element={<Navigate to="/monthly"  replace />} />
        <Route path="/assistants" element={<Navigate to="/settings" replace />} />
        <Route path="/leave"      element={<Navigate to="/records"  replace />} />
        <Route path="/hours"      element={<Navigate to="/home"     replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
