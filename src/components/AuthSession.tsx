import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth";

export function AuthSession() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (!auth.currentUser) return null;

  return (
    <div className="zoda-auth-session" aria-label="Signed in user">
      <span>{auth.currentUser.name}</span>
      <button
        type="button"
        aria-label="Log out"
        title="Log out"
        onClick={() => {
          auth.signOut();
          void navigate({ to: "/login", replace: true });
        }}
      >
        <LogOut size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
