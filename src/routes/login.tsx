import { FormEvent, useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";

import { isAuthenticated, useAuth } from "@/lib/auth";
import zodaZLogo from "@/assets/zoda-Z.png";
import "@/styles/auth.css";

type LoginSearch = {
  redirect?: string;
};

function getSafeRedirect(value: string | undefined) {
  return value?.startsWith("/") ? value : "/mission";
}

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ search }) => {
    const redirectTo = getSafeRedirect(typeof search.redirect === "string" ? search.redirect : undefined);

    if (await isAuthenticated()) {
      throw redirect({ to: redirectTo });
    }
  },
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login - ZODA Mission" },
      {
        name: "description",
        content: "Sign in or create a ZODA Mission account.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const redirectTo = useMemo(() => getSafeRedirect(search.redirect), [search.redirect]);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = mode === "sign-up" ? "Create Account" : "Sign In";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      if (mode === "sign-up") {
        const result = await auth.signUp({ email, name, password });

        if (result.needsEmailConfirmation) {
          setNotice("Check your email to confirm your account, then come back to log in.");
          setMode("sign-in");
          setPassword("");
          return;
        }
      } else {
        await auth.signIn(email, password);
      }

      await navigate({ to: redirectTo, replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="zoda-auth-page">
      <section className="zoda-auth-panel" aria-label="ZODA Mission account">
        <div className="zoda-auth-panel__brand">
          <img src={zodaZLogo} alt="" aria-hidden="true" />
          <span>ZODA Mission</span>
        </div>

        <div className="zoda-auth-panel__headline">
          <p>{mode === "sign-up" ? "Join the mission" : "Welcome back"}</p>
          <h1>{mode === "sign-up" ? "Create your account." : "Sign in to continue."}</h1>
        </div>

        <div className="zoda-auth-toggle" role="tablist" aria-label="Account mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-up"}
            onClick={() => {
              setMode("sign-up");
              setError("");
            }}
          >
            Sign Up
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-in"}
            onClick={() => {
              setMode("sign-in");
              setError("");
            }}
          >
            Login
          </button>
        </div>

        <form className="zoda-auth-form" onSubmit={handleSubmit}>
          {!auth.hasAuthConfig ? (
            <p className="zoda-auth-form__error">
              Supabase needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.
            </p>
          ) : null}

          {mode === "sign-up" ? (
            <label>
              <span>Name</span>
              <i aria-hidden="true">
                <UserRound size={16} />
              </i>
              <input
                autoComplete="name"
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                type="text"
                value={name}
              />
            </label>
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

          <label>
            <span>Password</span>
            <i aria-hidden="true">
              <LockKeyhole size={16} />
            </i>
            <input
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
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
          {notice ? <p className="zoda-auth-form__notice">{notice}</p> : null}

          <button
            className="zoda-auth-form__submit"
            disabled={isSubmitting || !auth.hasAuthConfig}
            type="submit"
          >
            {isSubmitting ? "Please wait" : submitLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
