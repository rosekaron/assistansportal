import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { profileApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CheckSquare, FolderOpen, Settings, LogOut } from "lucide-react";

const nav = [
  { to: "/home",     label: "Home",     icon: LayoutDashboard },
  { to: "/monthly",  label: "Monthly",  icon: CheckSquare },
  { to: "/records",  label: "Records",  icon: FolderOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn:  () => profileApi.get().then((r) => r.data),
  });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Sidebar — warm white with soft border */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-white shadow-sm">

        {/* Logo */}
        <div className="px-6 pt-7 pb-2">
          <div className="flex items-center gap-2.5 border-b border-border pb-5 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">Assistansportal</p>
              {profile?.patientName && (
                <p className="text-xs text-muted-foreground leading-tight">For {profile.patientName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="shrink-0" style={{ width: 18, height: 18 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom — weekly hours + logout */}
        <div className="p-4 border-t border-border space-y-3">
          {profile?.weeklyHours && (
            <div className="bg-primary/10 rounded-xl px-4 py-3 border border-primary/15">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly hours (FK)</p>
              <p className="text-2xl font-bold mt-0.5 text-primary">
                {profile.weeklyHours}h
                <span className="text-xs font-normal text-muted-foreground"> / week</span>
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="shrink-0" style={{ width: 18, height: 18 }} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
