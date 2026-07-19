import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertCircle, Search, ShieldMinus, ShieldPlus, Trash2, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getCurrentUser,
  getSupabaseAuthErrorMessage,
  isAuthenticated,
  useAuth,
  userHasAdminAccess,
} from "@/lib/auth";
import { formatTimestamp } from "@/lib/dates";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/members")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/admin/members" } });
    }

    const user = await getCurrentUser();
    if (!supabase || !user?.email || !(await userHasAdminAccess(user.email))) {
      throw redirect({ to: "/mission" });
    }
  },
  head: () => ({
    meta: [{ title: "Users - ZODA Mission" }],
  }),
  component: AdminMembersPage,
});

type Profile = {
  created_at: string;
  email: string;
  id: string;
  last_seen_at: string;
  name: string;
  role: "user" | "admin";
};

type RoleFilter = "all" | "admin" | "user";

function getAdminActionErrorMessage(message: string) {
  if (message.toLowerCase().includes("admin access required")) {
    return "Your app session has admin access, but Supabase has not synced server-side admin access yet. Apply the latest Supabase migration, then sign out and back in.";
  }

  return getSupabaseAuthErrorMessage(message);
}

async function getFunctionErrorMessage(error: Error) {
  const context = (error as Error & { context?: Response }).context;

  if (context) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === "string") {
        return getAdminActionErrorMessage(body.error);
      }
    } catch {
      // Fall back to the SDK error message.
    }
  }

  return getAdminActionErrorMessage(error.message);
}

function AdminMembersPage() {
  const { currentUser } = useAuth();
  const [deleteEmail, setDeleteEmail] = useState("");
  const [error, setError] = useState("");
  const [deletingEmail, setDeletingEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingDeleteEmail, setPendingDeleteEmail] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [updatingEmail, setUpdatingEmail] = useState("");

  async function loadProfiles() {
    if (!supabase) {
      setError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id,email,name,role,created_at,last_seen_at")
      .order("last_seen_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setProfiles([]);
    } else {
      setError("");
      setProfiles((data ?? []) as Profile[]);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  const stats = useMemo(
    () => ({
      admins: profiles.filter((profile) => profile.role === "admin").length,
      users: profiles.filter((profile) => profile.role === "user").length,
    }),
    [profiles],
  );

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRole = roleFilter === "all" || profile.role === roleFilter;
      const matchesQuery =
        !normalizedQuery ||
        profile.email.toLowerCase().includes(normalizedQuery) ||
        profile.name.toLowerCase().includes(normalizedQuery);

      return matchesRole && matchesQuery;
    });
  }, [profiles, query, roleFilter]);

  async function updateRole(profile: Profile) {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setMessage("");
    setUpdatingEmail(profile.email);

    const { error: updateError } =
      profile.role === "admin"
        ? await supabase.rpc("remove_admin_user", { admin_email: profile.email })
        : await supabase.rpc("add_admin_user", { admin_email: profile.email });

    if (updateError) {
      setMessage(getAdminActionErrorMessage(updateError.message));
    } else {
      setMessage(
        profile.role === "admin"
          ? `${profile.email} is now a user.`
          : `${profile.email} is now an admin.`,
      );
      await loadProfiles();
    }

    setUpdatingEmail("");
  }

  async function deleteUserAccount({
    email,
    userId,
  }: {
    email: string;
    userId?: string;
  }) {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (currentUser?.id === userId || currentUser?.email === email) {
      setMessage("You cannot delete your own account.");
      setPendingDeleteId("");
      setPendingDeleteEmail("");
      return;
    }

    setDeletingEmail(email);
    setMessage("");

    const { error: deleteError } = await supabase.functions.invoke("delete-user-account", {
      body: { email, userId },
    });

    if (deleteError) {
      setMessage(await getFunctionErrorMessage(deleteError));
    } else {
      setMessage(`${email} has been deleted and blocked from signing back in.`);
      setDeleteEmail("");
      setPendingDeleteEmail("");
      setPendingDeleteId("");
      await loadProfiles();
    }

    setDeletingEmail("");
  }

  function confirmDeleteByEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = deleteEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Enter a valid email address to delete.");
      return;
    }

    if (currentUser?.email === email) {
      setMessage("You cannot delete your own account.");
      return;
    }

    setPendingDeleteId("");
    setPendingDeleteEmail(email);
  }

  const pendingDeleteProfile = profiles.find((profile) => profile.id === pendingDeleteId);
  const pendingDeleteTargetEmail = pendingDeleteProfile?.email ?? pendingDeleteEmail;

  return (
    <AppShell eyebrow="Admin" title="Users">
      <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total users</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : profiles.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Admins</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : stats.admins}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Standard users</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : stats.users}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" />
                <CardTitle>Users are not ready</CardTitle>
              </div>
              <CardDescription>Supabase returned: {error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Delete account by email</CardTitle>
            <CardDescription>
              Use this for invited or auth-only users who do not appear in the table yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={confirmDeleteByEmail}>
              <div className="grid gap-2">
                <Label htmlFor="delete-user-email">Email</Label>
                <Input
                  id="delete-user-email"
                  placeholder="user@example.com"
                  type="email"
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                />
              </div>
              <Button className="self-end" type="submit" variant="destructive">
                <Trash2 />
                Delete account
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  User management
                </CardTitle>
                <CardDescription>Search users, manage roles, or delete accounts.</CardDescription>
              </div>
              <Badge variant="secondary">{filteredProfiles.length} shown</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search name or email"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {(["all", "admin", "user"] as RoleFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    variant={roleFilter === filter ? "default" : "outline"}
                    onClick={() => setRoleFilter(filter)}
                  >
                    {filter === "all" ? "All" : filter}
                  </Button>
                ))}
              </div>
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="w-52 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.length > 0 ? (
                  filteredProfiles.map((profile) => {
                    const isUpdating = updatingEmail === profile.email;
                    const isDeleting = deletingEmail === profile.email;
                    const isCurrentUser =
                      currentUser?.id === profile.id || currentUser?.email === profile.email;

                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatTimestamp(profile.created_at)}</TableCell>
                        <TableCell>{formatTimestamp(profile.last_seen_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              disabled={isUpdating || isDeleting}
                              size="sm"
                              type="button"
                              variant={profile.role === "admin" ? "outline" : "default"}
                              onClick={() => void updateRole(profile)}
                            >
                              {profile.role === "admin" ? <ShieldMinus /> : <ShieldPlus />}
                              {isUpdating
                                ? "Saving..."
                                : profile.role === "admin"
                                  ? "Demote"
                                  : "Promote"}
                            </Button>
                            <Button
                              aria-label={
                                isCurrentUser
                                  ? "You cannot delete your own account"
                                  : `Delete ${profile.email}`
                              }
                              disabled={isCurrentUser || isDeleting || isUpdating}
                              size="sm"
                              type="button"
                              variant={isCurrentUser ? "outline" : "destructive"}
                              onClick={() => {
                                if (!isCurrentUser) setPendingDeleteId(profile.id);
                              }}
                            >
                              <Trash2 />
                              {isCurrentUser ? "Self" : isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={6}>
                      {isLoading ? "Loading users..." : "No users match this view."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(pendingDeleteTargetEmail)}
          onOpenChange={(isOpen) => {
            if (!isOpen && !deletingEmail) {
              setPendingDeleteEmail("");
              setPendingDeleteId("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete{" "}
                <span className="font-medium text-foreground">
                  {pendingDeleteTargetEmail}
                </span>{" "}
                from Supabase Auth, remove their profile
                {pendingDeleteProfile?.role === "admin" ? " and admin access" : ""}, and block
                the account from signing back in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingEmail)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={Boolean(deletingEmail)}
                onClick={(event) => {
                  event.preventDefault();
                  if (pendingDeleteProfile) {
                    void deleteUserAccount({
                      email: pendingDeleteProfile.email,
                      userId: pendingDeleteProfile.id,
                    });
                    return;
                  }

                  if (pendingDeleteEmail) {
                    void deleteUserAccount({ email: pendingDeleteEmail });
                  }
                }}
              >
                {deletingEmail ? "Deleting..." : "Delete user"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppShell>
  );
}
