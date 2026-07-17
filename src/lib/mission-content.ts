import ascenderTrophy from "@/assets/ascender-trophy.png";
import missionBagImage from "@/assets/Backpack.png";
import beastTrophy from "@/assets/finisher-trophy.png";
import initiatorTrophy from "@/assets/Initiator-trophy.png";

export const REWARD_TIERS = [
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

export const MISSION_BAG = {
  href: "https://prelaunch.com/projects/zoda-mission-zoda-mission-the-everything-backpack",
  image: missionBagImage,
};
