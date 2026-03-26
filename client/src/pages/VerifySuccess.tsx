import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

export default function VerifySuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = params.get("token");
    const role  = params.get("role") ?? "guardian";
    if (token) {
      setAuth(token, role);
      setTimeout(() => navigate(role === "assistant" ? "/assistant" : "/dashboard", { replace: true }), 1500);
    } else {
      navigate("/login", { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="text-lg font-semibold text-foreground">Email verified!</p>
        <p className="text-sm text-muted-foreground">Taking you to the app…</p>
      </div>
    </div>
  );
}
