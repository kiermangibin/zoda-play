import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Medal, ShoppingBag } from "lucide-react";

import { MissionPlayPage } from "./mission_.play";
import ascenderTrophy from "@/assets/ascender-trophy.png";
import missionBagImage from "@/assets/Backpack.png";
import beastTrophy from "@/assets/finisher-trophy.png";
import initiatorTrophy from "@/assets/Initiator-trophy.png";
import "@/styles/mission-page.css";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "The Mission - ZODA" },
      {
        name: "description",
        content:
          "Play ZODA's 21-day Mission game, track progress, unlock reward tiers and complete the final mission.",
      },
      { property: "og:title", content: "The Mission - ZODA" },
      {
        property: "og:description",
        content:
          "A combined Mission game and rewards page for the 21-day ZODA challenge.",
      },
    ],
  }),
  component: MissionPage,
});

const REWARD_TIERS = [
  {
    name: "Initiator",
    points: "1+",
    label: "Tier 1",
    icon: initiatorTrophy,
    tone: "gold",
    summary: "Get on the board and prove the mission has started.",
    rewards: [
      "Mission tier status",
      "Week 1 finisher badge",
      "Progress counted toward the final run",
    ],
  },
  {
    name: "Ascender",
    points: "300+",
    label: "Tier 2",
    icon: ascenderTrophy,
    tone: "coral",
    summary: "Clear the middle gate with enough points to show consistency.",
    rewards: [
      "Ascender badge tier",
      "Higher leaderboard placement",
      "Final Mission qualification path",
    ],
  },
  {
    name: "Beast",
    points: "450+",
    label: "Top Tier",
    icon: beastTrophy,
    tone: "green",
    summary: "Reach the official target score and finish in Beast territory.",
    rewards: ["Beast badge tier", "Win-qualified mission score", "Full Play & Win status"],
  },
];

function MissionPage() {
  return (
    <div className="zoda-shell zoda-shell--light zoda-mission-page zoda-mission-page--combined">
      <MissionPlayPage embedded />

      <main className="zoda-mission-combined" aria-label="Mission rewards and final action">
        <section id="mission-rewards" className="zoda-mission-section zoda-mission-rewards">
          <div className="zoda-mission-rewards__inner">
            <div className="zoda-mission-copy zoda-mission-rewards__copy">
              <p className="zoda-mission-kicker">
                <Medal size={15} aria-hidden="true" /> Reward Tiers
              </p>
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

        <section id="mission-cta" className="zoda-mission-section zoda-mission-final-cta">
          <div className="zoda-mission-final-cta__inner">
            <div className="zoda-mission-final-cta__copy">
              <p className="zoda-mission-kicker">
                <ShoppingBag size={15} aria-hidden="true" /> Final Mission
              </p>
              <h2>Finish the board. Carry the mission.</h2>
              <p>
                Complete the 21-day path, record the Final Mission, and bring the same standard into
                every session with the ZODA Mission Bag.
              </p>
              <a
                className="zoda-mission-final-cta__button"
                href="https://prelaunch.com/projects/zoda-mission-zoda-mission-the-everything-backpack"
              >
                Shop Mission Gear
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="zoda-mission-final-cta__image" aria-label="ZODA Mission Bag">
              <img src={missionBagImage} alt="ZODA Mission backpack" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
