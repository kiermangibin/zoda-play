import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { requireSupabase, supabase } from "@/lib/supabase";
import zodaZLogo from "@/assets/zoda-Z.png";
import "@/styles/auth.css";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset Password - ZODA Mission" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepareResetSession() {
      if (!supabase) {
        setIsPreparingSession(false);
        return;
      }

      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = searchParams.get("code");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const urlError =
          searchParams.get("error_description") ??
          hashParams.get("error_description") ??
          searchParams.get("error") ??
          hashParams.get("error");

        if (urlError) {
          throw new Error(urlError.replaceAll("+", " "));
        }

        if (code) {
          const { error: exchangeError } = await requireSupabase().auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await requireSupabase().auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const {
          data: { session },
        } = await requireSupabase().auth.getSession();

        if (!isMounted) return;

        setIsSessionReady(Boolean(session));
        if (!session) {
          setError("Open the latest password reset email link, then set your new password from that page.");
        } else if (code || accessToken || refreshToken) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (nextError) {
        if (!isMounted) return;
        setIsSessionReady(false);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Open the latest password reset email link, then set your new password from that page.",
        );
      } finally {
        if (isMounted) setIsPreparingSession(false);
      }
    }

    void prepareResetSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await auth.updatePassword(password);
      await auth.signOut();
      await navigate({ to: "/login", replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="zoda-auth-page">
      <section className="zoda-auth-panel" aria-label="Create a new ZODA Mission password">
        <div className="zoda-auth-panel__brand">
          <img src={zodaZLogo} alt="" aria-hidden="true" />
          <span>ZODA Mission</span>
        </div>

        <div className="zoda-auth-panel__headline">
          <p>New password</p>
          <h1>Set your new password.</h1>
        </div>

        <form className="zoda-auth-form" onSubmit={handleSubmit}>
          {!auth.hasAuthConfig ? (
            <p className="zoda-auth-form__error">
              Supabase needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.
            </p>
          ) : null}

          <label className="zoda-auth-password-field">
            <span>Password</span>
            <i aria-hidden="true">
              <LockKeyhole size={16} />
            </i>
            <input
              autoComplete="new-password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="zoda-auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </label>

          {error ? <p className="zoda-auth-form__error">{error}</p> : null}

          <button
            className="zoda-auth-form__submit"
            disabled={isPreparingSession || isSubmitting || !auth.hasAuthConfig || !isSessionReady}
            type="submit"
          >
            {isPreparingSession ? "Checking link" : isSubmitting ? "Saving" : "Save password"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
