import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isAdminEmail } from "@/lib/admin";
import { hasSupabaseConfig, requireSupabase, supabase } from "@/lib/supabase";

export type AuthUser = {
  email: string;
  id: string;
  name: string;
};

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  currentUser: AuthUser | null;
  hasAuthConfig: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  signUp: (input: { email: string; name: string; password: string }) => Promise<SignUpResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: {
  email?: string | null;
  id: string;
  user_metadata?: { name?: unknown; full_name?: unknown };
}): AuthUser {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";
  const email = user.email ?? "";

  return {
    email,
    id: user.id,
    name: metadataName || email.split("@")[0] || "Mission Player",
  };
}

async function syncUserProfile(user: AuthUser) {
  if (!supabase || !user.email) return;

  await supabase.from("profiles").upsert(
    {
      email: user.email,
      id: user.id,
      last_seen_at: new Date().toISOString(),
      name: user.name,
    },
    { onConflict: "id" },
  );
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? toAuthUser(user) : null;
}

export async function isAuthenticated() {
  return Boolean(await getCurrentUser());
}

export async function userHasAdminAccess(email: string | null | undefined) {
  if (!supabase || !email) return false;

  const normalizedEmail = normalizeEmail(email);
  if (isAdminEmail(normalizedEmail)) return true;

  const { data: adminEmail } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (adminEmail) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("email", normalizedEmail)
    .maybeSingle();

  return profile?.role === "admin";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminStatus() {
      if (!supabase || !currentUser?.email) {
        setIsAdmin(false);
        return;
      }

      const hasAdminAccess = await userHasAdminAccess(currentUser.email);

      if (isMounted) {
        setIsAdmin(hasAdminAccess);
      }
    }

    void loadAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      const nextUser = data.user ? toAuthUser(data.user) : null;
      setCurrentUser(nextUser);
      if (nextUser) void syncUserProfile(nextUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? toAuthUser(session.user) : null;
      setCurrentUser(nextUser);
      if (nextUser) void syncUserProfile(nextUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      hasAuthConfig: hasSupabaseConfig,
      isAdmin,
      isAuthenticated: Boolean(currentUser),
      signIn: async (email, password) => {
        const normalizedEmail = normalizeEmail(email);
        const client = requireSupabase();
        const { data, error } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) throw new Error(error.message);
        if (data.user) {
          const nextUser = toAuthUser(data.user);
          setCurrentUser(nextUser);
          await syncUserProfile(nextUser);
        }
      },
      signOut: () => {
        void requireSupabase().auth.signOut();
        setCurrentUser(null);
      },
      signUp: async ({ email, name, password }) => {
        const normalizedEmail = normalizeEmail(email);
        const trimmedName = name.trim();

        if (!trimmedName) {
          throw new Error("Enter your name.");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          throw new Error("Enter a valid email address.");
        }

        if (password.length < 8) {
          throw new Error("Use at least 8 characters for your password.");
        }

        const { data, error } = await requireSupabase().auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: trimmedName },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (error) throw new Error(error.message);
        if (data.user && data.session) {
          const nextUser = toAuthUser(data.user);
          setCurrentUser(nextUser);
          await syncUserProfile(nextUser);
        }
        return { needsEmailConfirmation: Boolean(data.user && !data.session) };
      },
    }),
    [currentUser, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
