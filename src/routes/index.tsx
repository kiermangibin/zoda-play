import { createFileRoute, redirect } from "@tanstack/react-router";

import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login" });
    }

    throw redirect({ to: "/mission" });
  },
});
