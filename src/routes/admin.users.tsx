import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertCircle, ShieldCheck, ShieldPlus, Trash2, UserPlus, Users } from "lucide-react";

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
import { getCurrentUser, isAuthenticated, useAuth, userHasAdminAccess } from "@/lib/auth";
import { formatTimestamp } from "@/lib/dates";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/admin/users" } });
    }

    const user = await getCurrentUser();
    if (!supabase || !user?.email || !(await userHasAdminAccess(user.email))) {
      throw redirect({ to: "/mission" });
    }
  },
  head: () => ({
    meta: [{ title: "Admin Users - ZODA Mission" }],
  }),
  component: AdminUsersPage,
});

type AdminEmail = {
  created_at: string;
  email: string;
};

type Profile = {
  email: string;
  id: string;
  last_seen_at: string;
  name: string;
  role: "user" | "admin";
};

type AdminRow = AdminEmail & {
  last_seen_at?: string;
  name?: string;
  profile_id?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAdminActionErrorMessage(message: string) {
  if (message.toLowerCase().includes("admin access required")) {
    return "Your app session has admin access, but Supabase has not synced your admin row yet. Apply supabase/migrations/003_bootstrap_admin_access.sql, then sign out and back in.";
  }

  return message;
}

async function getInviteAdminErrorMessage(error: Error) {
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

function AdminUsersPage() {
  const { currentUser } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [error, setError] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingRemoveEmail, setPendingRemoveEmail] = useState("");
  const [removingEmail, setRemovingEmail] = useState("");

  async function loadAdmins() {
    if (!supabase) {
      setError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    const [{ data: adminRows, error: adminError }, { data: profileRows, error: profileError }] =
      await Promise.all([
        supabase.from("admin_emails").select("email,created_at").order("created_at"),
        supabase
          .from("profiles")
          .select("id,email,name,role,last_seen_at")
          .eq("role", "admin")
          .order("last_seen_at", { ascending: false }),
      ]);

    if (adminError || profileError) {
      setError(adminError?.message ?? profileError?.message ?? "Unable to load admin users.");
      setAdmins([]);
      setIsLoading(false);
      return;
    }

    const profileByEmail = new Map(
      ((profileRows ?? []) as Profile[]).map((profile) => [profile.email, profile]),
    );

    setAdmins(
      ((adminRows ?? []) as AdminEmail[]).map((admin) => {
        const profile = profileByEmail.get(admin.email);

        return {
          ...admin,
          last_seen_at: profile?.last_seen_at,
          name: profile?.name,
          profile_id: profile?.id,
        };
      }),
    );
    setError("");
    setIsLoading(false);
  }

  useEffect(() => {
    void loadAdmins();
  }, []);

  async function handleAddAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    const email = normalizeEmail(adminEmail);
    const name = adminName.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Enter a valid email address.");
      return;
    }

    if (name.length < 2) {
      setMessage("Enter the admin's name.");
      return;
    }

    setIsAddingAdmin(true);
    setMessage("");

    const { error: inviteError } = await supabase.functions.invoke("invite-admin-user", {
      body: { email, name },
    });

    if (inviteError) {
      setMessage(await getInviteAdminErrorMessage(inviteError));
    } else {
      setAdminEmail("");
      setAdminName("");
      setMessage(`Invite sent to ${email}. They can set their password from the email link.`);
      await loadAdmins();
    }

    setIsAddingAdmin(false);
  }

  async function handleRemoveAdmin(email: string) {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (currentUser?.email === email) {
      setMessage("You cannot remove your own admin access.");
      setPendingRemoveEmail("");
      return;
    }

    setRemovingEmail(email);
    setMessage("");

    const { error: removeError } = await supabase.rpc("remove_admin_user", {
      admin_email: email,
    });

    if (removeError) {
      setMessage(getAdminActionErrorMessage(removeError.message));
    } else {
      setMessage(`${email} is no longer an admin.`);
      setPendingRemoveEmail("");
      await loadAdmins();
    }

    setRemovingEmail("");
  }

  const pendingRemoveAdmin = admins.find((admin) => admin.email === pendingRemoveEmail);

  return (
    <AppShell eyebrow="Admin" title="Admin Users">
      <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6">
        {error ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" />
                <CardTitle>Admin users are not ready</CardTitle>
              </div>
              <CardDescription>
                Apply `supabase/migrations/001_profiles_admin.sql` in Supabase SQL Editor.
                Supabase returned: {error}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldPlus className="size-4 text-primary" />
                Invite admin
              </CardTitle>
              <CardDescription>Send an invite link so the admin can set their password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={handleAddAdmin}>
                <div className="grid gap-2">
                  <Label htmlFor="admin-name">Name</Label>
                  <Input
                    id="admin-name"
                    placeholder="Trisha Baltazar"
                    type="text"
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    placeholder="admin@zoda.sg"
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                  />
                </div>
                <Button disabled={isAddingAdmin} type="submit">
                  <UserPlus />
                  {isAddingAdmin ? "Sending..." : "Send invite"}
                </Button>
                {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Admin access
                </CardTitle>
                <CardDescription>Admins can manage analytics and admin users.</CardDescription>
              </div>
              <Badge className="gap-1.5" variant="secondary">
                <ShieldCheck className="size-3.5" />
                Guarded
              </Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead className="w-20 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.length > 0 ? (
                    admins.map((admin) => {
                      const isCurrentUser = currentUser?.email === admin.email;
                      const isRemoving = removingEmail === admin.email;

                      return (
                        <TableRow key={admin.email}>
                          <TableCell className="font-medium">
                            {admin.name ?? "Pending signup"}
                          </TableCell>
                          <TableCell>{admin.email}</TableCell>
                          <TableCell>{formatTimestamp(admin.created_at)}</TableCell>
                          <TableCell>{formatTimestamp(admin.last_seen_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              aria-label={
                                isCurrentUser
                                  ? "You cannot remove your own admin access"
                                  : `Remove ${admin.email} admin access`
                              }
                              disabled={isCurrentUser || isRemoving}
                              size="sm"
                              type="button"
                              variant={isCurrentUser ? "outline" : "destructive"}
                              onClick={() => {
                                if (!isCurrentUser) setPendingRemoveEmail(admin.email);
                              }}
                            >
                              <Trash2 />
                              {isCurrentUser ? "Self" : "Remove"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={5}>
                        {isLoading ? "Loading admin users..." : "No admin users yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <AlertDialog
          open={Boolean(pendingRemoveAdmin)}
          onOpenChange={(isOpen) => {
            if (!isOpen && !removingEmail) setPendingRemoveEmail("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove admin access?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove admin dashboard access for{" "}
                <span className="font-medium text-foreground">
                  {pendingRemoveAdmin?.email}
                </span>
                . They will remain a regular mission user.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(removingEmail)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={Boolean(removingEmail)}
                onClick={(event) => {
                  event.preventDefault();
                  if (pendingRemoveAdmin) void handleRemoveAdmin(pendingRemoveAdmin.email);
                }}
              >
                {removingEmail ? "Removing..." : "Remove admin"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppShell>
  );
}
