import { FormEvent, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";

import { useAuth } from "@/lib/auth";
import zodaZLogo from "@/assets/zoda-Z.png";
import "@/styles/auth.css";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot Password - ZODA Mission" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await auth.requestPasswordReset(email);
      setNotice("Check your email for the reset link.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send reset link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="zoda-auth-page">
      <section className="zoda-auth-panel" aria-label="Reset ZODA Mission password">
        <div className="zoda-auth-panel__brand">
          <img src={zodaZLogo} alt="" aria-hidden="true" />
          <span>ZODA Mission</span>
        </div>

        <div className="zoda-auth-panel__headline">
          <p>Password help</p>
          <h1>Reset your password.</h1>
        </div>

        <form className="zoda-auth-form" onSubmit={handleSubmit}>
          {!auth.hasAuthConfig ? (
            <p className="zoda-auth-form__error">
              Supabase needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.
            </p>
          ) : null}

          <label>
            <span>Email</span>
            <i aria-hidden="true">
              <Mail size={16} />
            </i>
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          {error ? <p className="zoda-auth-form__error">{error}</p> : null}
          {notice ? <p className="zoda-auth-form__notice">{notice}</p> : null}

          <button
            className="zoda-auth-form__submit"
            disabled={isSubmitting || !auth.hasAuthConfig}
            type="submit"
          >
            {isSubmitting ? "Sending" : "Send reset link"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          <Link className="zoda-auth-form__link" to="/login">
            Back to login
          </Link>
        </form>
      </section>
    </main>
  );
}
