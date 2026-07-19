import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Moon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
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
import { formatChartDate, formatTimestamp } from "@/lib/dates";
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

type MissionResult = {
  challenge_id: string;
  challenge_name: string;
  completed_at: string;
  id: string;
  points: number;
  result: "hit" | "fail" | "final";
  user_email: string;
  user_name: string;
  week_label: string;
};

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
      dateLabel: formatChartDate(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
    };
  });
}

function buildWeeklyOutcomes(results: MissionResult[]) {
  const today = startOfDay(new Date());

  return Array.from({ length: 6 }, (_, index) => {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (5 - index) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const weekResults = results.filter((result) => {
      const completedAt = new Date(result.completed_at);
      return completedAt >= weekStart && completedAt < weekEnd;
    });

    return {
      fail: weekResults.filter((result) => result.result === "fail").length,
      final: weekResults.filter((result) => result.result === "final").length,
      hit: weekResults.filter((result) => result.result === "hit").length,
      label: formatChartDate(weekStart),
    };
  });
}

function buildWeekCompletion(results: MissionResult[]) {
  const weekOrder = ["Week 1", "Week 2", "Week 3", "Final"];

  return weekOrder.map((week) => {
    const weekResults = results.filter((result) => result.week_label === week);

    return {
      fail: weekResults.filter((result) => result.result === "fail").length,
      final: weekResults.filter((result) => result.result === "final").length,
      hit: weekResults.filter((result) => result.result === "hit").length,
      label: week.replace("Week ", "W"),
      total: weekResults.length,
    };
  });
}

function AdminPage() {
  useAuth();
  const [missionResults, setMissionResults] = useState<MissionResult[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAdminData() {
    if (!supabase) {
      setError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    const [
      { data: profileRows, error: profileError },
      { data: resultRows, error: resultError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,name,role,created_at,last_seen_at")
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("mission_challenge_results")
        .select(
          "id,user_email,user_name,challenge_id,challenge_name,week_label,result,points,completed_at",
        )
        .order("completed_at", { ascending: false })
        .limit(500),
    ]);

    if (profileError || resultError) {
      setError(profileError?.message ?? resultError?.message ?? "Unable to load admin data.");
      setProfiles([]);
      setMissionResults([]);
    } else {
      setProfiles(profileRows ?? []);
      setMissionResults((resultRows ?? []) as MissionResult[]);
      setError("");
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void loadAdminData();
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

  const missionStats = useMemo(() => {
    const hits = missionResults.filter((result) => result.result === "hit").length;
    const fails = missionResults.filter((result) => result.result === "fail").length;
    const finals = missionResults.filter((result) => result.result === "final").length;
    const attempts = hits + fails;
    const activePlayers = new Set(missionResults.map((result) => result.user_email)).size;

    return {
      activePlayers,
      attempts,
      fails,
      finals,
      hitRate: attempts ? Math.round((hits / attempts) * 100) : 0,
      hits,
      points: Math.round(
        missionResults.reduce((total, result) => total + Number(result.points), 0),
      ),
    };
  }, [missionResults]);

  const dailyActive = useMemo(() => buildDailyCounts(profiles, "last_seen_at"), [profiles]);
  const dailySignups = useMemo(() => buildDailyCounts(profiles, "created_at"), [profiles]);
  const weeklyOutcomes = useMemo(() => buildWeeklyOutcomes(missionResults), [missionResults]);
  const weekCompletion = useMemo(() => buildWeekCompletion(missionResults), [missionResults]);
  const recentMissionResults = useMemo(() => missionResults.slice(0, 8), [missionResults]);
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
    <AppShell eyebrow="Admin" title="Track">
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

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-primary" />
                Successful hits
              </CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : missionStats.hits}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <XCircle className="size-3.5 text-destructive" />
                Failed attempts
              </CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : missionStats.fails}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Target className="size-3.5 text-primary" />
                Hit rate
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? "-" : `${missionStats.hitRate}%`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Trophy className="size-3.5 text-primary" />
                Final complete
              </CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : missionStats.finals}</CardTitle>
              <CardDescription>
                {isLoading
                  ? "Players and points"
                  : `${missionStats.activePlayers} players · ${missionStats.points} pts`}
              </CardDescription>
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
          <OutcomeTrendCard
            data={weeklyOutcomes}
            description="Hit, fail and final-complete results grouped by week."
            icon={<BarChart3 className="size-4 text-primary" />}
            title="Weekly outcomes"
          />
          <WeekCompletionCard
            data={weekCompletion}
            description="All recorded completions by mission week."
            icon={<Target className="size-4 text-primary" />}
            title="Completion by week"
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

        <RecentMissionResultsCard
          emptyLabel={isLoading ? "Loading mission results..." : "No mission results yet."}
          results={recentMissionResults}
        />

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
                      <TableCell>{formatTimestamp(profile.created_at)}</TableCell>
                      <TableCell>{formatTimestamp(profile.last_seen_at)}</TableCell>
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
                  <TableCell>{formatTimestamp(profile[timestampField])}</TableCell>
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
  data: Array<{ count: number; dateLabel: string; label: string }>;
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
                <span className="text-[10px] text-muted-foreground">{item.dateLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OutcomeTrendCard({
  data,
  description,
  icon,
  title,
}: {
  data: Array<{ fail: number; final: number; hit: number; label: string }>;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  const max = Math.max(...data.map((item) => item.hit + item.fail + item.final), 1);

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
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-primary" aria-hidden="true" />
            Hit
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-destructive" aria-hidden="true" />
            Fail
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-foreground" aria-hidden="true" />
            Final
          </span>
        </div>
        <div className="flex h-44 items-end gap-2">
          {data.map((item) => {
            const total = item.hit + item.fail + item.final;

            return (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={item.label}>
                <div className="flex h-32 w-full flex-col justify-end overflow-hidden rounded bg-muted/60">
                  <div
                    className="w-full bg-foreground"
                    style={{ height: `${total ? (item.final / max) * 100 : 0}%` }}
                  />
                  <div
                    className="w-full bg-destructive"
                    style={{ height: `${total ? (item.fail / max) * 100 : 0}%` }}
                  />
                  <div
                    className="w-full bg-primary"
                    style={{ height: `${total ? (item.hit / max) * 100 : 0}%` }}
                  />
                </div>
                <div className="grid gap-0.5 text-center">
                  <span className="text-xs font-semibold text-foreground">{total}</span>
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekCompletionCard({
  data,
  description,
  icon,
  title,
}: {
  data: Array<{ fail: number; final: number; hit: number; label: string; total: number }>;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  const max = Math.max(...data.map((item) => item.total), 1);

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
        <div className="grid gap-4">
          {data.map((item) => (
            <div className="grid gap-2" key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">
                  {item.total} done
                  {item.fail ? ` · ${item.fail} fail` : ""}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${Math.max((item.total / max) * 100, item.total ? 6 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentMissionResultsCard({
  emptyLabel,
  results,
}: {
  emptyLabel: string;
  results: MissionResult[];
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            Recent mission results
          </CardTitle>
          <CardDescription>Latest hits, fails and final completions by user.</CardDescription>
        </div>
        <Badge variant="secondary">{results.length} shown</Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Challenge</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length > 0 ? (
              results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{result.user_name}</span>
                      <span className="text-xs text-muted-foreground">{result.user_email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <span>{result.challenge_name}</span>
                      <span className="text-xs text-muted-foreground">{result.week_label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        result.result === "fail"
                          ? "destructive"
                          : result.result === "final"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {result.result === "final" ? "final" : result.result}
                    </Badge>
                  </TableCell>
                  <TableCell>{Number(result.points)}</TableCell>
                  <TableCell>{formatTimestamp(result.completed_at)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
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
