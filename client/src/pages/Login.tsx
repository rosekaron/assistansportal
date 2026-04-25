import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Mode = "login" | "register" | "forgot" | "resend";

export default function LoginPage() {
  const [mode,     setMode]     = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [info,     setInfo]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [devToken, setDevToken] = useState("");

  const setAuth  = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from     = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "login") {
        const { data } = await authApi.login(email, password);
        setAuth(data.token, data.role, data.assistantId);
        navigate(data.role === "assistant" ? "/assistant" : from, { replace: true });

      } else if (mode === "register") {
        const { data } = await authApi.register(email, password);
        setInfo(data.message);
        if (data.devVerifyToken) setDevToken(data.devVerifyToken);

      } else if (mode === "forgot") {
        const { data } = await authApi.forgotPassword(email);
        setInfo((data as { message: string }).message);

      } else if (mode === "resend") {
        const { data } = await authApi.resendVerification(email);
        setInfo((data as { message: string }).message);
      }
    } catch (err: unknown) {
      const e    = err as { response?: { data?: { error?: string; code?: string } } };
      const msg  = e?.response?.data?.error ?? "Something went wrong. Is the server running?";
      const code = e?.response?.data?.code;
      setError(msg);
      if (code === "EMAIL_NOT_VERIFIED") setMode("resend");
    } finally {
      setLoading(false);
    }
  }

  async function devVerify() {
    try {
      const { data } = await authApi.devVerify(devToken);
      setAuth(data.token, data.role);
      navigate(data.role === "assistant" ? "/assistant" : from, { replace: true });
    } catch {
      setError("Dev verify failed — is the server running?");
    }
  }

  const titles: Record<Mode, string> = {
    login:    "Sign in",
    register: "Create account",
    forgot:   "Reset password",
    resend:   "Resend verification",
  };

  const descs: Record<Mode, string> = {
    login:    "Enter your credentials to continue",
    register: "Set up your guardian account",
    forgot:   "We'll send a reset link to your email",
    resend:   "We'll send a new verification link",
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-foreground leading-tight">Assistansportal</p>
              <p className="text-xs text-muted-foreground">Personal assistance management</p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">{titles[mode]}</CardTitle>
            <CardDescription>{descs[mode]}</CardDescription>
          </CardHeader>
          <CardContent>

            {/* Success state */}
            {info ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm text-emerald-700">{info}</p>
                </div>

                {/* Dev mode bypass — shown when email isn't configured */}
                {devToken && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-amber-700 font-semibold">⚙️ Dev mode — Gmail not configured yet</p>
                    <p className="text-xs text-amber-600">Skip email verification and go straight in:</p>
                    <Button size="sm" variant="outline" onClick={devVerify} className="w-full">
                      Verify account &amp; sign in →
                    </Button>
                  </div>
                )}

                <Button variant="ghost" className="w-full" onClick={() => { setInfo(""); setDevToken(""); setMode("login"); }}>
                  ← Back to sign in
                </Button>
              </div>

            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} required
                  />
                </div>

                {(mode === "login" || mode === "register") && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => { setMode("forgot"); setError(""); }}
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password" type="password" placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      required minLength={8}
                    />
                    {mode === "register" && (
                      <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-2.5">
                  <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait…" : titles[mode]}
                </Button>
              </form>
            )}

            {/* Mode switcher */}
            {!info && (
              <div className="mt-4 space-y-2 text-center text-xs text-muted-foreground">
                {mode === "login" && (
                  <p>
                    Don't have an account?{" "}
                    <button onClick={() => { setMode("register"); setError(""); }} className="text-primary hover:underline">
                      Register
                    </button>
                  </p>
                )}
                {mode !== "login" && (
                  <p>
                    <button onClick={() => { setMode("login"); setError(""); }} className="text-primary hover:underline">
                      ← Back to sign in
                    </button>
                  </p>
                )}
                {mode === "login" && (
                  <p>
                    Assistant?{" "}
                    <Link to="/accept-invite" className="text-primary hover:underline">
                      Use your invite link
                    </Link>
                  </p>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
