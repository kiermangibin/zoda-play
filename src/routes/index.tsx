import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUser, userHasAdminAccess } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      throw redirect({ to: "/login" });
    }

    throw redirect({
      to: (await userHasAdminAccess(currentUser.email)) ? "/admin" : "/mission",
    });
  },
});
