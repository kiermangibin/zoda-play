import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  CalendarPlus,
  Clock,
  Moon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser, isAuthenticated, useAuth, userHasAdminAccess } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/admin" } });
    }

    const user = await getCurrentUser();
    if (!supabase || !user?.email) {
      throw redirect({ to: "/mission" });
    }

    if (!(await userHasAdminAccess(user.email))) {
      throw redirect({ to: "/mission" });
    }
  },
  head: () => ({
    meta: [{ title: "Admin - ZODA Mission" }],
  }),
  component: AdminPage,
});

type Profile = {
  created_at: string;
  email: string;
  id: string;
  last_seen_at: string;
  name: string;
  role: "user" | "admin";
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function buildDailyCounts(profiles: Profile[], field: "created_at" | "last_seen_at") {
  const today = startOfDay(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    return {
      count: profiles.filter((profile) => {
        const value = new Date(profile[field]);
        return value >= date && value < nextDate;
      }).length,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
    };
  });
}

function AdminPage() {
  useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      setProfiles(data ?? []);
      setError("");
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const activeThirtyDays = profiles.filter(
      (profile) => new Date(profile.last_seen_at) >= thirtyDaysAgo,
    ).length;

    return {
      activeToday: profiles.filter((profile) => new Date(profile.last_seen_at) >= todayStart)
        .length,
      activeSevenDays: profiles.filter((profile) => new Date(profile.last_seen_at) >= sevenDaysAgo)
        .length,
      activeThirtyDays,
      admins: profiles.filter((profile) => profile.role === "admin").length,
      dormantFourteenDays: profiles.filter(
        (profile) => new Date(profile.last_seen_at) < fourteenDaysAgo,
      ).length,
      newSevenDays: profiles.filter((profile) => new Date(profile.created_at) >= sevenDaysAgo)
        .length,
      retentionThirtyDays: profiles.length
        ? Math.round((activeThirtyDays / profiles.length) * 100)
        : 0,
      totalUsers: profiles.length,
    };
  }, [profiles]);

  const dailyActive = useMemo(() => buildDailyCounts(profiles, "last_seen_at"), [profiles]);
  const dailySignups = useMemo(() => buildDailyCounts(profiles, "created_at"), [profiles]);
  const recentActive = useMemo(
    () =>
      [...profiles]
        .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
        .slice(0, 5),
    [profiles],
  );
  const recentSignups = useMemo(
    () =>
      [...profiles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [profiles],
  );

  return (
    <AppShell eyebrow="Admin" title="Analytics">
      <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6">
        <section className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader>
              <CardDescription>Total users</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : stats.totalUsers}</CardTitle>
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
              <CardDescription>Active today</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : stats.activeToday}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active 7 days</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : stats.activeSevenDays}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>New 7 days</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : stats.newSevenDays}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="size-3.5 text-primary" />
                Active 30 days
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? "-" : stats.activeThirtyDays}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Activity className="size-3.5 text-primary" />
                30-day retention
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? "-" : `${stats.retentionThirtyDays}%`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Moon className="size-3.5 text-primary" />
                Dormant 14+ days
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? "-" : stats.dormantFourteenDays}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4" />
                <CardTitle>Admin tracking is not ready</CardTitle>
              </div>
              <CardDescription>
                Apply `supabase/migrations/001_profiles_admin.sql` in Supabase SQL Editor, then
                sign out and back in. Supabase returned: {error}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard
            data={dailyActive}
            description="Users with a profile update each day."
            icon={<Activity className="size-4 text-primary" />}
            title="Daily activity"
          />
          <AnalyticsCard
            data={dailySignups}
            description="New profile rows created each day."
            icon={<CalendarPlus className="size-4 text-primary" />}
            title="Daily signups"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <RecentProfilesCard
            description="Newest profile rows created in Supabase."
            emptyLabel={isLoading ? "Loading signups..." : "No signups yet."}
            icon={<Sparkles className="size-4 text-primary" />}
            profiles={recentSignups}
            timestampLabel="Created"
            timestampField="created_at"
            title="Recent signups"
          />
          <RecentProfilesCard
            description="Latest users seen by the mission app."
            emptyLabel={isLoading ? "Loading activity..." : "No activity yet."}
            icon={<Clock className="size-4 text-primary" />}
            profiles={recentActive}
            timestampLabel="Last seen"
            timestampField="last_seen_at"
            title="Recently active"
          />
        </section>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Mission users
              </CardTitle>
              <CardDescription>Profiles are updated when users sign in.</CardDescription>
            </div>
            <Badge className="gap-1.5" variant="secondary">
              <ShieldCheck className="size-3.5" />
              RLS protected
            </Badge>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length > 0 ? (
                  profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>
                        <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                          {profile.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(profile.created_at)}</TableCell>
                      <TableCell>{formatDate(profile.last_seen_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      {isLoading ? "Loading users..." : "No tracked users yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}

function RecentProfilesCard({
  description,
  emptyLabel,
  icon,
  profiles,
  timestampField,
  timestampLabel,
  title,
}: {
  description: string;
  emptyLabel: string;
  icon: ReactNode;
  profiles: Profile[];
  timestampField: "created_at" | "last_seen_at";
  timestampLabel: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>{timestampLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <TableRow key={`${title}-${profile.id}`}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{profile.name}</span>
                      <span className="text-xs text-muted-foreground">{profile.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                      {profile.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(profile[timestampField])}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={3}>
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AnalyticsCard({
  data,
  description,
  icon,
  title,
}: {
  data: Array<{ count: number; label: string }>;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-44 items-end gap-2">
          {data.map((item) => (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={item.label}>
              <div className="flex h-32 w-full items-end rounded bg-muted/60 p-1">
                <div
                  className="w-full rounded bg-primary"
                  style={{ height: `${Math.max((item.count / max) * 100, item.count ? 8 : 0)}%` }}
                />
              </div>
              <div className="grid gap-0.5 text-center">
                <span className="text-xs font-semibold text-foreground">{item.count}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
