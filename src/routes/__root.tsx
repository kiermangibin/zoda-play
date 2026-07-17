import { Outlet, createRootRoute } from "@tanstack/react-router";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import "@/styles/auth.css";
import "@/styles/globals.css";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/mission-shell.css";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    </AuthProvider>
  );
}

function NotFoundComponent() {
  return (
    <main className="zoda-mission-fallback">
      <h1>Mission page not found.</h1>
      <a href="/mission">Open Mission</a>
    </main>
  );
}
