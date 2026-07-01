import { Outlet, createRootRoute } from "@tanstack/react-router";

import "@/styles/globals.css";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/mission-shell.css";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return <Outlet />;
}

function NotFoundComponent() {
  return (
    <main className="zoda-mission-fallback">
      <h1>Mission page not found.</h1>
      <a href="/mission">Open Mission</a>
    </main>
  );
}
