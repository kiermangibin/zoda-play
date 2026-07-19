import { FormEvent, useState } from "react";
import { Link, createFileRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";

import { getCurrentUser, userHasAdminAccess, useAuth } from "@/lib/auth";
import zodaZLogo from "@/assets/zoda-Z.png";
import "@/styles/auth.css";

type LoginSearch = {
  redirect?: string;
};

function getSafeRedirect(value: string | undefined, fallback = "/mission") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ search }) => {
    const currentUser = await getCurrentUser();

    if (currentUser) {
      const fallback = (await userHasAdminAccess(currentUser.email)) ? "/admin" : "/mission";
      const redirectTo = getSafeRedirect(
        typeof search.redirect === "string" ? search.redirect : undefined,
        fallback,
      );
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
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      const fallback = (await userHasAdminAccess(email)) ? "/admin" : "/mission";
      await navigate({ to: getSafeRedirect(search.redirect, fallback), replace: true });
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

          <label className="zoda-auth-password-field">
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

          {mode === "sign-in" ? (
            <Link className="zoda-auth-form__link" to="/forgot-password">
              Forgot password?
            </Link>
          ) : null}

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
