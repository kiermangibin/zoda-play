import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { isAuthenticated } from "@/lib/auth";
import { MISSION_BAG } from "@/lib/mission-content";
import "@/styles/mission-page.css";

export const Route = createFileRoute("/mission/bag")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/mission/bag" } });
    }
  },
  head: () => ({
    meta: [{ title: "Mission Bag - ZODA" }],
  }),
  component: MissionBagPage,
});

function MissionBagPage() {
  return (
    <AppShell eyebrow="Mission" title="Mission Bag">
      <main className="zoda-mission-page zoda-mission-page--combined zoda-mission-combined bg-background">
        <section id="mission-cta" className="zoda-mission-section zoda-mission-final-cta">
          <div className="zoda-mission-final-cta__inner">
            <div className="zoda-mission-final-cta__copy">
              <p className="zoda-mission-kicker">
                <ShoppingBag size={15} aria-hidden="true" /> Final Mission
              </p>
              <h2>Reserve the Mission Bag.</h2>
              <p>
                Join the prelaunch waitlist for the everything backpack built to carry your
                training, travel, recovery, and daily mission.
              </p>
              <a className="zoda-mission-final-cta__button" href={MISSION_BAG.href}>
                Reserve Your Spot
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="zoda-mission-final-cta__image" aria-label="ZODA Mission Bag">
              <img src={MISSION_BAG.image} alt="ZODA Mission backpack" />
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
