import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/inputs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ResetPassword() {
  const [params]    = useSearchParams();
  const token       = params.get("token") ?? "";
  const navigate    = useNavigate();
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [error,     setError]     = useState("");
  const [done,      setDone]      = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Passwords do not match");
    if (password.length < 8)    return setError("Password must be at least 8 characters");
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-base font-semibold">Assistansportal</span>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{done ? "Password updated" : "Set new password"}</CardTitle>
            <CardDescription>
              {done ? "You can now sign in with your new password." : "Choose a new password for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <Button className="w-full" onClick={() => navigate("/login")}>Go to sign in →</Button>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {!token && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                    <p className="text-xs text-destructive">Invalid reset link. Please request a new one.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input type="password" placeholder="Minimum 8 characters"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm new password</Label>
                  <Input type="password" placeholder="Repeat your password"
                    value={password2} onChange={(e) => setPassword2(e.target.value)} required />
                </div>
                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading || !token}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
