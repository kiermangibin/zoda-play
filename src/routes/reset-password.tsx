import { FormEvent, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { useAuth } from "@/lib/auth";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

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

          <label>
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
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="zoda-auth-form__error">{error}</p> : null}

          <button
            className="zoda-auth-form__submit"
            disabled={isSubmitting || !auth.hasAuthConfig}
            type="submit"
          >
            {isSubmitting ? "Saving" : "Save password"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
