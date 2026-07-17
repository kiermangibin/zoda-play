import { createFileRoute, redirect } from "@tanstack/react-router";
import { Medal } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { isAuthenticated } from "@/lib/auth";
import { REWARD_TIERS } from "@/lib/mission-content";
import "@/styles/mission-page.css";

export const Route = createFileRoute("/mission/rewards")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/mission/rewards" } });
    }
  },
  head: () => ({
    meta: [{ title: "Mission Rewards - ZODA" }],
  }),
  component: MissionRewardsPage,
});

function MissionRewardsPage() {
  return (
    <AppShell eyebrow="Mission" title="Reward Tiers">
      <main className="zoda-mission-page zoda-mission-page--combined zoda-mission-combined bg-background">
        <section id="mission-rewards" className="zoda-mission-section zoda-mission-rewards">
          <div className="zoda-mission-rewards__inner">
            <div className="zoda-mission-copy zoda-mission-rewards__copy">
              <Badge className="mb-4 gap-2" variant="secondary">
                <Medal size={15} aria-hidden="true" /> Reward Tiers
              </Badge>
              <h2>Stack points. Unlock your tier.</h2>
              <p>
                Your reward level is based on the points you bank across the mission. Every hit,
                streak bonus and Beast Save push you closer to the top tier.
              </p>
            </div>
            <div className="zoda-mission-rewards__pricing" aria-label="Mission reward tiers">
              {REWARD_TIERS.map((tier) => (
                <article
                  key={tier.name}
                  className="zoda-mission-reward-card"
                  data-tone={tier.tone}
                  data-featured={tier.name === "Beast" ? "true" : undefined}
                >
                  <div className="zoda-mission-reward-card__head">
                    <span>{tier.label}</span>
                    <img src={tier.icon} alt="" aria-hidden="true" />
                  </div>
                  <h3>{tier.name}</h3>
                  <p>{tier.summary}</p>
                  <div className="zoda-mission-reward-card__points">
                    <strong>{tier.points}</strong>
                    <span>points</span>
                  </div>
                  <ul>
                    {tier.rewards.map((reward) => (
                      <li key={reward}>
                        <i aria-hidden="true" />
                        <span>{reward}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
