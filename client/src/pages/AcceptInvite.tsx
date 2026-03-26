import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AcceptInvite() {
  const [params]      = useSearchParams();
  const token         = params.get("token") ?? "";
  const navigate      = useNavigate();
  const setAuth       = useAuthStore((s) => s.setAuth);
  const [manualToken, setManualToken] = useState(token);
  const [password,    setPassword]    = useState("");
  const [password2,   setPassword2]   = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Passwords do not match");
    if (password.length < 8)    return setError("Password must be at least 8 characters");
    if (!manualToken)            return setError("Invite token is missing");
    setLoading(true);
    try {
      const { data } = await authApi.acceptInvite(manualToken, password);
      setAuth(data.token, data.role, data.assistantId);
      setDone(true);
      setTimeout(() => navigate("/assistant", { replace: true }), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="text-4xl">🎉</div>
        <p className="text-lg font-semibold">Welcome to Assistansportal!</p>
        <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-base font-semibold">Assistansportal</span>
          </div>
          <p className="text-sm text-muted-foreground">You've been invited as a personal assistant</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create your account</CardTitle>
            <CardDescription>Set a password to activate your assistant account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {!token && (
                <div className="space-y-1.5">
                  <Label>Invite token</Label>
                  <Input placeholder="Paste your invite token"
                    value={manualToken} onChange={(e) => setManualToken(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Find this in your invitation email</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Choose a password</Label>
                <Input type="password" placeholder="Minimum 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input type="password" placeholder="Repeat your password"
                  value={password2} onChange={(e) => setPassword2(e.target.value)} required />
              </div>
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading || !manualToken}>
                {loading ? "Creating account…" : "Create account & sign in →"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary hover:underline">Sign in</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
