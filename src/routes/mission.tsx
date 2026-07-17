import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Gift, Package, Play, Trophy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import { REWARD_TIERS } from "@/lib/mission-content";

export const Route = createFileRoute("/mission")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/mission" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Mission Control - ZODA" },
      {
        name: "description",
        content: "ZODA Mission control center with play, rewards and final mission actions.",
      },
    ],
  }),
  component: MissionOverviewPage,
});

const overviewCards = [
  {
    description: "Roll the dice, clear weekly tasks, and keep your streak alive.",
    icon: Play,
    label: "Open board",
    title: "Mission Play",
    to: "/mission/play",
  },
  {
    description: "Review tier targets and what each score level unlocks.",
    icon: Trophy,
    label: "View tiers",
    title: "Rewards",
    to: "/mission/rewards",
  },
  {
    description: "Reserve the ZODA Mission Bag and finish the challenge path.",
    icon: Package,
    label: "Reserve",
    title: "Mission Bag",
    to: "/mission/bag",
  },
];

function MissionOverviewPage() {
  return (
    <AppShell eyebrow="Mission" title="Control Center">
      <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6">
        <section className="grid gap-4">
          <Badge className="w-fit gap-2" variant="secondary">
            <Gift className="size-3.5" />
            21-day build a habit mission
          </Badge>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="max-w-3xl text-4xl font-black uppercase leading-none tracking-normal md:text-6xl">
                Roll. Complete. Climb.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                Your mission is now split into focused pages. Start with the board, check your
                reward tier, then move into the final bag action when the run is complete.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/mission/play">
                Start Playing
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {overviewCards.map((card) => (
            <Card key={card.title} className="border-border/80 bg-card/80">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary">
                  <card.icon className="size-4" />
                </div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant="outline">
                  <Link to={card.to}>
                    {card.label}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {REWARD_TIERS.map((tier) => (
            <Card key={tier.name} className="bg-card/60">
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div>
                  <CardDescription>{tier.label}</CardDescription>
                  <CardTitle>{tier.name}</CardTitle>
                </div>
                <img className="size-12 object-contain" src={tier.icon} alt="" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-primary">{tier.points} pts</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
