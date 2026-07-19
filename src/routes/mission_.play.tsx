import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Check, Dice5, RotateCcw, Trophy, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { isAuthenticated, useAuth } from "@/lib/auth";
import {
  MISSION_DICE_STORAGE_KEY,
  MISSION_FINAL_STORAGE_KEY,
  MISSION_LAST_ROLL_STORAGE_KEY,
  MISSION_PLAY_PICK_STORAGE_KEY,
  MISSION_PLAY_WEEK_STORAGE_KEY,
  MISSION_PLAYBOOK_STORAGE_KEY,
  MISSION_RESULTS_STORAGE_KEY,
  readMissionJson,
  readMissionString,
  removeMissionValue,
  writeMissionJson,
  writeMissionString,
} from "@/lib/mission-progress";
import { supabase } from "@/lib/supabase";
import ascenderTrophy from "@/assets/ascender-trophy.png";
import beastTrophy from "@/assets/finisher-trophy.png";
import finalMissionIcon from "@/assets/Final Mission.png";
import initiatorTrophy from "@/assets/Initiator-trophy.png";
import zodaZLogo from "@/assets/zoda-Z.png";
import "@/styles/mission-play.css";

export const Route = createFileRoute("/mission_/play")({
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login", search: { redirect: "/mission/play" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Mission Play - ZODA" },
      {
        name: "description",
        content:
          "Play ZODA's Mission game with a virtual dice challenge picker, board, scoreboard and local saved progress.",
      },
      { property: "og:title", content: "Mission Play - ZODA" },
      {
        property: "og:description",
        content:
          "A game-centered Mission board for rolling, picking challenges and tracking score.",
      },
    ],
  }),
  component: MissionPlayPage,
});

type MissionTask = {
  name: string;
  points: string;
  detail: string;
};

type MissionChallenge = MissionTask & {
  badge: string;
  id: string;
  tone: "green" | "orange" | "mint";
  weekIndex: number;
};

type MissionResult = "hit" | "fail";
type ChallengeResults = Record<string, MissionResult>;

type ScoreNotice = {
  id: number;
  challengeName: string;
  earnedPoints: number;
  result: MissionResult;
  totalPoints: number;
};

type LockedWeekNotice = {
  id: number;
  remainingTasks: number;
  requiredWeek: string;
  week: string;
};

type PlayWinNotice = {
  id: number;
  ruleId: string;
  label: string;
};

const WEEK_ONE: MissionTask[] = [
  { name: "Clean Fuel", points: "+30", detail: "No sugar + no processed food (48h)." },
  { name: "Move Daily", points: "+20", detail: "45-minute walk (no phone except music)." },
  { name: "Focus Discipline", points: "+20", detail: "4 hours screen-free block." },
  { name: "Protein Standard", points: "+20", detail: "1.5x B.W. protein minimum." },
  { name: "Sleep Lock", points: "+20", detail: "7 hours strict." },
  { name: "Repeat Any", points: "+20", detail: "Repeat any challenge." },
  {
    name: "Beast Mode",
    points: "+60",
    detail:
      "Hit all 4: no sugar, +3L water, 45-min movement, 1.5x B.W. protein hit. Miss one -> fail.",
  },
];

const WEEK_TWO: MissionTask[] = [
  { name: "Push Session", points: "+25", detail: "30 burpees under control." },
  { name: "Clean Fuel 2.0", points: "+25", detail: "No sugar + 1.75x B.W. protein." },
  { name: "Focus Lock", points: "+20", detail: "Six hours with no social media." },
  { name: "Base Pace", points: "+30", detail: "5km under 6:00." },
  { name: "Bonus", points: "+20", detail: "Player chooses any challenge." },
  { name: "Iron Distance", points: "+25", detail: "Farmers carry 24kg x2 for 100m." },
  {
    name: "Beast Mode",
    points: "+75",
    detail: "50 burpees, 2x B.W. protein hit, 3L water, 6h screen control. Miss one -> fail.",
  },
];

const WEEK_THREE: MissionTask[] = [
  { name: "Overdrive", points: "+25", detail: "Burn 750 cals + 2.0x B.W. protein." },
  { name: "Pressure Stack", points: "+25", detail: "25 diamond and 25 standard pushups." },
  { name: "Burpee War", points: "+30", detail: "75 burpees. Hit: under 15 min." },
  { name: "Cold Control", points: "+20", detail: "Ice bath (4-5 min)." },
  { name: "Pull Dominance", points: "+30", detail: "30 pullups or 10 muscle ups." },
  { name: "Recovery Stack", points: "+20", detail: "Ice bath (5 min) + 7h sleep." },
];

const MISSION_WEEKS = [
  {
    badge: "Week 1",
    title: "Foundation",
    tier: "Initiator",
    icon: initiatorTrophy,
    items: WEEK_ONE,
  },
  { badge: "Week 2", title: "Ascend", tier: "Ascender", icon: ascenderTrophy, items: WEEK_TWO },
  { badge: "Week 3", title: "Dominance", tier: "Beast", icon: beastTrophy, items: WEEK_THREE },
];

const SCOREBOARD_TARGET_POINTS = 450;
const FINAL_MISSION_ID = "final-mission";
const ROLL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REPEAT_ANY_MIN_ROLL = 3;
const STREAK_BONUSES = [
  { hits: 3, points: 10 },
  { hits: 5, points: 20 },
  { hits: 7, points: 30 },
  { hits: 12, points: 50 },
];
const STREAK_RULEBOOK = [
  "Every hit adds +1 to your streak.",
  "One fail resets it.",
  "3 / 5 / 7 hits = +10 / +20 / +30 points.",
  "12 hits = +50 bonus + 1 Beast Save.",
  "Hit = full points. Fail = half points.",
  "No points if you didn't attempt.",
];

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getPointValue(points: string) {
  const match = points.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getChallengeItemId(challenge: Pick<MissionChallenge, "badge" | "name">) {
  return `${challenge.badge}-${challenge.name}`;
}

function getChallengeResultKey(challenge: Pick<MissionChallenge, "id">) {
  return challenge.id;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRollTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(value));
}

const ALL_CHALLENGES: MissionChallenge[] = MISSION_WEEKS.flatMap((week, weekIndex) =>
  week.items.map((item) => ({
    ...item,
    badge: week.badge,
    id: `${toSlug(week.badge)}-${toSlug(item.name)}`,
    tone:
      item.name === "Beast Mode"
        ? "orange"
        : item.name === "Repeat Any" || item.name === "Bonus"
          ? "mint"
          : "green",
    weekIndex,
  })),
);

function getScoreboard(results: ChallengeResults) {
  const attemptedChallenges = ALL_CHALLENGES.filter(
    (challenge) => results[getChallengeResultKey(challenge)],
  );
  const hitChallenges = attemptedChallenges.filter(
    (challenge) => results[getChallengeResultKey(challenge)] === "hit",
  );
  const failChallenges = attemptedChallenges.filter(
    (challenge) => results[getChallengeResultKey(challenge)] === "fail",
  );
  const basePoints = attemptedChallenges.reduce(
    (total, item) =>
      total +
      (results[getChallengeResultKey(item)] === "hit"
        ? getPointValue(item.points)
        : getPointValue(item.points) / 2),
    0,
  );
  let currentStreak = 0;
  let maxStreak = 0;

  ALL_CHALLENGES.forEach((challenge) => {
    const result = results[getChallengeResultKey(challenge)];
    if (!result) return;

    if (result === "hit") {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
      return;
    }

    currentStreak = 0;
  });

  const bonusPoints = STREAK_BONUSES.reduce(
    (total, bonus) => (maxStreak >= bonus.hits ? total + bonus.points : total),
    0,
  );
  const completedPoints = basePoints + bonusPoints;
  const weekCounts = MISSION_WEEKS.map((week, weekIndex) => {
    const total = ALL_CHALLENGES.filter((challenge) => challenge.weekIndex === weekIndex).length;
    const completed = attemptedChallenges.filter(
      (challenge) => challenge.weekIndex === weekIndex,
    ).length;
    return { week: week.badge, completed, total };
  });
  const badgeTier =
    completedPoints >= SCOREBOARD_TARGET_POINTS
      ? "Beast"
      : completedPoints >= 300
        ? "Ascender"
        : completedPoints > 0
          ? "Initiator"
          : "Pending";

  return {
    badgeTier,
    basePoints,
    beastSaves: maxStreak >= 12 ? 1 : 0,
    bonusPoints,
    completedPoints,
    completedTasks: attemptedChallenges.length,
    currentStreak,
    failCount: failChallenges.length,
    hitCount: hitChallenges.length,
    maxStreak,
    targetPoints: SCOREBOARD_TARGET_POINTS,
    totalTasks: ALL_CHALLENGES.length,
    weekCounts,
  };
}

function getPlayWinRules(scoreboard: ReturnType<typeof getScoreboard>, finalMissionComplete: boolean) {
  return [
    {
      id: "no-misses",
      isComplete:
        finalMissionComplete &&
        scoreboard.completedTasks === scoreboard.totalTasks &&
        scoreboard.failCount === 0,
      label: "21 days. No misses.",
    },
    {
      id: "beast-save",
      isComplete: scoreboard.beastSaves > 0,
      label: "Miss? 12 hits = 1 Beast Save.",
    },
    {
      id: "points",
      isComplete: scoreboard.completedPoints >= scoreboard.targetPoints,
      label: "Hit 450+ points.",
    },
    {
      id: "tier",
      isComplete: finalMissionComplete,
      label: "Earn a badge tier.",
    },
    {
      id: "arena",
      isComplete: finalMissionComplete,
      label: "Step into the arena & win.",
    },
  ];
}

export function MissionPlayPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentUser } = useAuth();
  const hasLoadedProgress = useRef(false);
  const hasSyncedSavedProgress = useRef(false);
  const [challengeResults, setChallengeResults] = useState<ChallengeResults>({});
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [diceRollCount, setDiceRollCount] = useState(0);
  const [lastRollAt, setLastRollAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [scoreNotice, setScoreNotice] = useState<ScoreNotice | null>(null);
  const [lockedWeekNotice, setLockedWeekNotice] = useState<LockedWeekNotice | null>(null);
  const [playWinNotice, setPlayWinNotice] = useState<PlayWinNotice | null>(null);
  const [finalMissionComplete, setFinalMissionComplete] = useState(false);
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);

  useEffect(() => {
    const savedResults = readMissionJson<ChallengeResults | null>(MISSION_RESULTS_STORAGE_KEY, null);
    if (savedResults) {
      setChallengeResults(savedResults);
    } else {
      const checkedItems = readMissionJson<string[]>(MISSION_PLAYBOOK_STORAGE_KEY, []);
      const migratedResults = ALL_CHALLENGES.reduce<ChallengeResults>(
        (nextResults, challenge) => {
          if (checkedItems.includes(getChallengeItemId(challenge))) {
            nextResults[getChallengeResultKey(challenge)] = "hit";
          }
          return nextResults;
        },
        {},
      );
      setChallengeResults(migratedResults);
      writeMissionJson(MISSION_RESULTS_STORAGE_KEY, migratedResults);
    }

    const savedWeek = Number(readMissionString(MISSION_PLAY_WEEK_STORAGE_KEY) ?? "0");
    setActiveWeekIndex(Math.min(Math.max(savedWeek, 0), MISSION_WEEKS.length - 1));
    setActiveChallengeId(readMissionString(MISSION_PLAY_PICK_STORAGE_KEY));
    setFinalMissionComplete(readMissionString(MISSION_FINAL_STORAGE_KEY) === "true");
    const savedLastRollAt = Number(readMissionString(MISSION_LAST_ROLL_STORAGE_KEY));
    setLastRollAt(Number.isFinite(savedLastRollAt) && savedLastRollAt > 0 ? savedLastRollAt : null);

    const savedDice = readMissionJson<{ value?: number; count?: number } | null>(
      MISSION_DICE_STORAGE_KEY,
      null,
    );
    if (savedDice) {
      setDiceValue(savedDice.value ?? null);
      setDiceRollCount(savedDice.count ?? 0);
    }

    hasLoadedProgress.current = true;
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const scoreboard = useMemo(() => getScoreboard(challengeResults), [challengeResults]);
  const playWinRules = useMemo(
    () => getPlayWinRules(scoreboard, finalMissionComplete),
    [scoreboard, finalMissionComplete],
  );
  const activeWeek = MISSION_WEEKS[activeWeekIndex];
  const activeWeekChallenges = useMemo(
    () => ALL_CHALLENGES.filter((challenge) => challenge.weekIndex === activeWeekIndex),
    [activeWeekIndex],
  );
  const incompleteActiveWeekChallenges = activeWeekChallenges.filter(
    (challenge) => !challengeResults[getChallengeResultKey(challenge)],
  );
  const activeChallenge = ALL_CHALLENGES.find((challenge) => challenge.id === activeChallengeId);
  const isFinalMissionSelected = activeChallengeId === FINAL_MISSION_ID;
  const activeChallengeResult = activeChallenge
    ? challengeResults[getChallengeResultKey(activeChallenge)]
    : undefined;
  const activeChallengeIsComplete = Boolean(activeChallengeResult);
  const isCurrentWeekComplete = incompleteActiveWeekChallenges.length === 0;
  const allTasksComplete = scoreboard.completedTasks === scoreboard.totalTasks;
  const nextRollAt = lastRollAt ? lastRollAt + ROLL_COOLDOWN_MS : null;
  const rollIsOnCooldown = Boolean(nextRollAt && now > 0 && now < nextRollAt);
  const canRollChallenge = !isCurrentWeekComplete && !rollIsOnCooldown;
  const rollStatusLabel = rollIsOnCooldown && nextRollAt
    ? `Next roll ${formatRollTime(nextRollAt)}`
    : diceValue
      ? `Roll ${diceRollCount}: ${diceValue}`
      : "Ready to pick";
  const unlockedWeekIndex = scoreboard.weekCounts.reduce(
    (highestUnlocked, week, index, weeks) =>
      index === 0 || weeks[index - 1].completed === weeks[index - 1].total
        ? index
        : highestUnlocked,
    0,
  );
  const progressPercent = Math.round(
    (scoreboard.completedTasks / Math.max(scoreboard.totalTasks, 1)) * 100,
  );

  useEffect(() => {
    if (activeWeekIndex <= unlockedWeekIndex) return;

    setActiveWeekIndex(unlockedWeekIndex);
    setActiveChallengeId(null);
    writeMissionString(MISSION_PLAY_WEEK_STORAGE_KEY, String(unlockedWeekIndex));
    removeMissionValue(MISSION_PLAY_PICK_STORAGE_KEY);
  }, [activeWeekIndex, unlockedWeekIndex]);

  useEffect(() => {
    if (!hasLoadedProgress.current || hasSyncedSavedProgress.current || !currentUser) return;

    hasSyncedSavedProgress.current = true;
    ALL_CHALLENGES.forEach((challenge) => {
      const result = challengeResults[getChallengeResultKey(challenge)];
      if (result) void trackMissionResult({ challenge, result });
    });

    if (finalMissionComplete) {
      void trackFinalMissionComplete();
    }
  }, [challengeResults, currentUser, finalMissionComplete]);

  useEffect(() => {
    if (!scoreNotice) return;

    const timeoutId = window.setTimeout(() => setScoreNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [scoreNotice]);

  useEffect(() => {
    if (!lockedWeekNotice) return;

    const timeoutId = window.setTimeout(() => setLockedWeekNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [lockedWeekNotice]);

  useEffect(() => {
    if (!playWinNotice) return;

    const timeoutId = window.setTimeout(() => setPlayWinNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [playWinNotice]);

  const saveActiveWeek = (weekIndex: number) => {
    if (weekIndex > unlockedWeekIndex) return;

    setLockedWeekNotice(null);
    setActiveWeekIndex(weekIndex);
    setActiveChallengeId(null);
    writeMissionString(MISSION_PLAY_WEEK_STORAGE_KEY, String(weekIndex));
    removeMissionValue(MISSION_PLAY_PICK_STORAGE_KEY);
  };

  const showLockedWeekNotice = (weekIndex: number) => {
    const requiredWeek = scoreboard.weekCounts[weekIndex - 1];
    if (!requiredWeek) return;

    setScoreNotice(null);
    setPlayWinNotice(null);
    setIsRulebookOpen(false);
    setLockedWeekNotice({
      id: Date.now(),
      remainingTasks: Math.max(requiredWeek.total - requiredWeek.completed, 0),
      requiredWeek: requiredWeek.week,
      week: MISSION_WEEKS[weekIndex].badge,
    });
  };

  const rollChallenge = () => {
    if (!canRollChallenge) return;

    const rollTimestamp = Date.now();
    const nextValue = Math.floor(Math.random() * 6) + 1;
    const nextCount = diceRollCount + 1;
    const eligibleChallenges =
      nextCount >= REPEAT_ANY_MIN_ROLL
        ? incompleteActiveWeekChallenges
        : incompleteActiveWeekChallenges.filter((challenge) => challenge.name !== "Repeat Any");
    const pickableChallenges =
      eligibleChallenges.length > 0 ? eligibleChallenges : incompleteActiveWeekChallenges;
    const pickedChallenge =
      pickableChallenges[(nextValue - 1) % pickableChallenges.length];

    setDiceValue(nextValue);
    setDiceRollCount(nextCount);
    setLastRollAt(rollTimestamp);
    setActiveChallengeId(pickedChallenge.id);
    writeMissionJson(MISSION_DICE_STORAGE_KEY, { value: nextValue, count: nextCount });
    writeMissionString(MISSION_LAST_ROLL_STORAGE_KEY, String(rollTimestamp));
    writeMissionString(MISSION_PLAY_PICK_STORAGE_KEY, pickedChallenge.id);
  };

  const saveChallengeResults = (nextResults: ChallengeResults) => {
    setChallengeResults(nextResults);
    writeMissionJson(MISSION_RESULTS_STORAGE_KEY, nextResults);
    writeMissionJson(
      MISSION_PLAYBOOK_STORAGE_KEY,
      ALL_CHALLENGES.filter(
        (challenge) => nextResults[getChallengeResultKey(challenge)] === "hit",
      ).map((challenge) => getChallengeItemId(challenge)),
    );
  };

  const trackMissionResult = async ({
    challenge,
    result,
  }: {
    challenge: MissionChallenge;
    result: MissionResult;
  }) => {
    if (!supabase || !currentUser) return;

    await supabase.from("mission_challenge_results").upsert(
      {
        challenge_id: challenge.id,
        challenge_name: challenge.name,
        completed_at: new Date().toISOString(),
        points:
          result === "hit"
            ? getPointValue(challenge.points)
            : getPointValue(challenge.points) / 2,
        result,
        updated_at: new Date().toISOString(),
        user_email: currentUser.email,
        user_id: currentUser.id,
        user_name: currentUser.name,
        week_label: challenge.badge,
      },
      { onConflict: "user_id,challenge_id" },
    );
  };

  const trackFinalMissionComplete = async () => {
    if (!supabase || !currentUser) return;

    await supabase.from("mission_challenge_results").upsert(
      {
        challenge_id: FINAL_MISSION_ID,
        challenge_name: "Final Mission",
        completed_at: new Date().toISOString(),
        points: 0,
        result: "final",
        updated_at: new Date().toISOString(),
        user_email: currentUser.email,
        user_id: currentUser.id,
        user_name: currentUser.name,
        week_label: "Final",
      },
      { onConflict: "user_id,challenge_id" },
    );
  };

  const markActiveChallengeResult = (result: MissionResult) => {
    if (!activeChallenge || activeChallengeIsComplete) return;
    const nextResults = {
      ...challengeResults,
      [getChallengeResultKey(activeChallenge)]: result,
    };
    const nextScoreboard = getScoreboard(nextResults);
    const newlyCompletedRule = getPlayWinRules(nextScoreboard, finalMissionComplete).find(
      (rule) =>
        rule.isComplete &&
        !playWinRules.some(
          (currentRule) => currentRule.id === rule.id && currentRule.isComplete,
        ),
    );
    setScoreNotice({
      id: Date.now(),
      challengeName: activeChallenge.name,
      earnedPoints: nextScoreboard.completedPoints - scoreboard.completedPoints,
      result,
      totalPoints: nextScoreboard.completedPoints,
    });
    if (hasLoadedProgress.current && newlyCompletedRule) {
      setLockedWeekNotice(null);
      setIsRulebookOpen(false);
      setPlayWinNotice({
        id: Date.now() + 1,
        ruleId: newlyCompletedRule.id,
        label: newlyCompletedRule.label,
      });
    }
    saveChallengeResults(nextResults);
    void trackMissionResult({ challenge: activeChallenge, result });
  };

  const markFinalMissionComplete = () => {
    if (!allTasksComplete || finalMissionComplete) return;

    const nextPlayWinRules = getPlayWinRules(scoreboard, true);
    const newlyCompletedRule = nextPlayWinRules.find(
      (rule) =>
        rule.isComplete &&
        !playWinRules.some(
          (currentRule) => currentRule.id === rule.id && currentRule.isComplete,
        ),
    );

    setFinalMissionComplete(true);
    writeMissionString(MISSION_FINAL_STORAGE_KEY, "true");
    void trackFinalMissionComplete();
    setLockedWeekNotice(null);
    setScoreNotice(null);
    setIsRulebookOpen(false);

    if (newlyCompletedRule) {
      setPlayWinNotice({
        id: Date.now(),
        ruleId: newlyCompletedRule.id,
        label: newlyCompletedRule.label,
      });
    }
  };

  const content = (
      <main
        className={embedded ? "zoda-mission-play zoda-mission-play--embedded" : "zoda-mission-play"}
        aria-label="Mission play board"
      >
        <section className="zoda-mission-play__header">
          <a className="zoda-mission-play__back" href="/mission">
            <ArrowLeft size={15} aria-hidden="true" />
            Mission
          </a>
          <div>
            <span>Mission Play</span>
            <h1>Roll. Pick. Complete.</h1>
          </div>
          <p>
            Dice picks your current-week challenge. Complete it, stack points, and clear the board.
          </p>
        </section>

        <div className="zoda-mission-play__mobile-status" aria-label="Current score">
          <span>{formatScore(scoreboard.completedPoints)} pts</span>
          <strong>
            {scoreboard.completedTasks}/{scoreboard.totalTasks} complete
          </strong>
        </div>

        {isRulebookOpen ? (
          <div
            className="zoda-mission-play__notice zoda-mission-play__notice--rulebook"
            role="dialog"
            aria-label="Streak Hit Rulebook"
            aria-modal="false"
          >
            <button
              className="zoda-mission-play__notice-close"
              type="button"
              aria-label="Close rulebook"
              onClick={() => setIsRulebookOpen(false)}
            >
              <X size={14} aria-hidden="true" />
            </button>
            <strong>Streak Hit Rulebook</strong>
            <ul>
              {STREAK_RULEBOOK.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : lockedWeekNotice ? (
          <div
            key={lockedWeekNotice.id}
            className="zoda-mission-play__notice zoda-mission-play__notice--lock"
            role="status"
            aria-live="polite"
          >
            <strong>{lockedWeekNotice.week} locked</strong>
            <span>Clear {lockedWeekNotice.requiredWeek} first.</span>
            <em>
              {lockedWeekNotice.remainingTasks} task
              {lockedWeekNotice.remainingTasks === 1 ? "" : "s"} remaining
            </em>
          </div>
        ) : playWinNotice ? (
          <div
            key={playWinNotice.id}
            className="zoda-mission-play__notice zoda-mission-play__notice--play-win"
            role="status"
            aria-live="polite"
          >
            <strong>Play & Win cleared</strong>
            <span>{playWinNotice.label}</span>
            <em>Rule crossed off</em>
          </div>
        ) : scoreNotice ? (
          <div
            key={scoreNotice.id}
            className={`zoda-mission-play__notice zoda-mission-play__notice--${scoreNotice.result}`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {scoreNotice.result === "hit" ? "Hit" : "Fail"} +
              {formatScore(scoreNotice.earnedPoints)} points
            </strong>
            <span>{scoreNotice.challengeName} recorded</span>
            <em>
              Score: {formatScore(scoreNotice.totalPoints)} / {scoreboard.targetPoints}
            </em>
          </div>
        ) : null}

        <section className="zoda-mission-play__layout">
          <aside className="zoda-mission-play__score" aria-live="polite">
            <div className="zoda-mission-play__score-head">
              <span>
                <Trophy size={15} aria-hidden="true" />
                Scoreboard
              </span>
              <strong>{scoreboard.badgeTier}</strong>
            </div>
            <dl>
              <div>
                <dt>Score</dt>
                <dd>
                  {formatScore(scoreboard.completedPoints)} / {scoreboard.targetPoints}
                </dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>
                  {scoreboard.completedTasks} / {scoreboard.totalTasks}
                </dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>{scoreboard.currentStreak}</dd>
              </div>
              <div>
                <dt>Bonus</dt>
                <dd>+{formatScore(scoreboard.bonusPoints)}</dd>
              </div>
              <div>
                <dt>Hits</dt>
                <dd>{scoreboard.hitCount}</dd>
              </div>
              <div>
                <dt>Saves</dt>
                <dd>{scoreboard.beastSaves}</dd>
              </div>
            </dl>
            <div className="zoda-mission-play__meter" aria-label={`${progressPercent}% complete`}>
              <i style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="zoda-mission-play__weeks" aria-label="Week progress">
              {scoreboard.weekCounts.map((week, index) => {
                const isLocked = index > unlockedWeekIndex;

                return (
                  <button
                    key={week.week}
                    type="button"
                    className={index === activeWeekIndex ? "is-active" : undefined}
                    aria-label={
                      isLocked
                        ? `${week.week} locked. Clear ${scoreboard.weekCounts[index - 1]?.week} first.`
                        : `Open ${week.week}`
                    }
                    data-locked={isLocked ? "true" : undefined}
                    onClick={() => (isLocked ? showLockedWeekNotice(index) : saveActiveWeek(index))}
                  >
                    <span>{week.week.replace("Week ", "W")}</span>
                    <strong>{isLocked ? "Locked" : `${week.completed}/${week.total}`}</strong>
                  </button>
                );
              })}
            </div>
            <div className="zoda-mission-play__play-win" aria-label="Play and win progress">
              <span>Play & Win</span>
              <strong>21-day build a habit mission</strong>
              <ul>
                {playWinRules.map((rule) => (
                  <li
                    key={rule.id}
                    className={[
                      rule.isComplete ? "is-complete" : "",
                      playWinNotice?.ruleId === rule.id ? "is-cleared-now" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <i aria-hidden="true" />
                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section className="zoda-mission-play__board-wrap" aria-label="Mission game board">
            <div className="zoda-mission-play__board-head">
              <div>
                <span>{activeWeek.badge}</span>
                <strong>{activeWeek.title}</strong>
              </div>
              <img src={activeWeek.icon} alt="" aria-hidden="true" />
            </div>
            <div className="zoda-mission-play__board">
              <button
                className="zoda-mission-play__start"
                type="button"
                onClick={rollChallenge}
                disabled={!canRollChallenge}
              >
                <img src={zodaZLogo} alt="" aria-hidden="true" />
                Roll
              </button>
              {activeWeekChallenges.map((challenge, index) => {
                const result = challengeResults[getChallengeResultKey(challenge)];
                const isActive = activeChallenge?.id === challenge.id;

                return (
                  <button
                    key={challenge.id}
                    type="button"
                    className={[result ? `is-${result}` : "", isActive ? "is-active" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    data-tone={challenge.tone}
                    aria-pressed={isActive}
                    aria-disabled="true"
                    tabIndex={-1}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{challenge.name}</strong>
                    <em>{challenge.points}</em>
                    {result === "hit" ? <Check size={13} aria-hidden="true" /> : null}
                    {result === "fail" ? <X size={13} aria-hidden="true" /> : null}
                  </button>
                );
              })}
              {activeWeekIndex === MISSION_WEEKS.length - 1 ? (
                <button
                  type="button"
                  className={[
                    "zoda-mission-play__final-tile",
                    isFinalMissionSelected ? "is-active" : "",
                    finalMissionComplete ? "is-complete" : "",
                    allTasksComplete ? "is-unlocked" : "is-locked",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isFinalMissionSelected}
                  onClick={() => {
                    setActiveChallengeId(FINAL_MISSION_ID);
                    writeMissionString(MISSION_PLAY_PICK_STORAGE_KEY, FINAL_MISSION_ID);
                  }}
                >
                  <span>
                    {finalMissionComplete ? "Complete" : allTasksComplete ? "Unlocked" : "Locked"}
                  </span>
                  <img src={finalMissionIcon} alt="" aria-hidden="true" />
                  <strong>Final Mission</strong>
                  <em>20/20</em>
                </button>
              ) : null}
            </div>
          </section>

          <aside className="zoda-mission-play__control" aria-live="polite">
            <div className="zoda-mission-play__dice">
              <button
                type="button"
                onClick={rollChallenge}
                disabled={!canRollChallenge}
                aria-label="Roll dice to pick challenge"
              >
                <Dice5 size={16} aria-hidden="true" />
                Roll Challenge
              </button>
              <div className="zoda-mission-play__die" data-value={diceValue ?? 0}>
                {Array.from({ length: 7 }, (_, index) => (
                  <i key={index} aria-hidden="true" />
                ))}
                <span className="sr-only">
                  {diceValue ? `Rolled ${diceValue}` : "Dice not rolled"}
                </span>
              </div>
              <small>{rollStatusLabel}</small>
            </div>
            <button
              className="zoda-mission-play__rulebook-button"
              type="button"
              onClick={() => {
                setLockedWeekNotice(null);
                setScoreNotice(null);
                setIsRulebookOpen(true);
              }}
            >
              <BookOpen size={15} aria-hidden="true" />
              Rulebook
            </button>

            <div className="zoda-mission-play__challenge">
              {isFinalMissionSelected ? (
                <>
                  <span>
                    {finalMissionComplete
                      ? "Final Mission complete"
                      : allTasksComplete
                        ? "Final Mission unlocked"
                        : "Final Mission locked"}
                  </span>
                  <h2>Final Mission</h2>
                  {finalMissionComplete ? (
                    <p>
                      Arena proof recorded. Your Mission board is complete and the badge tier is
                      earned.
                    </p>
                  ) : allTasksComplete ? (
                    <p>
                      100 burpees. Hydrate. Wear ZODA Mission Bag. Post & tag @ZODA_FIT +
                      #ZODAMISSION.
                    </p>
                  ) : (
                    <p>
                      Complete all 20 weekly tasks first. The dice will keep picking only active
                      weekly challenges until the board is cleared.
                    </p>
                  )}
                  <dl>
                    <div>
                      <dt>Tasks</dt>
                      <dd>
                        {scoreboard.completedTasks}/{scoreboard.totalTasks}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {finalMissionComplete ? "Complete" : allTasksComplete ? "Ready" : "Locked"}
                      </dd>
                    </div>
                  </dl>
                  {finalMissionComplete ? (
                    <a href="/mission">View Playbook</a>
                  ) : allTasksComplete ? (
                    <button type="button" onClick={markFinalMissionComplete}>
                      <Trophy size={15} aria-hidden="true" />
                      Mark Final Complete
                    </button>
                  ) : null}
                </>
              ) : isCurrentWeekComplete ? (
                <>
                  <span>{activeWeek.badge} complete</span>
                  <h2>{activeWeek.tier} cleared.</h2>
                  <p>
                    Every challenge in this week is complete. Move to the next week when you are
                    ready.
                  </p>
                  {activeWeekIndex < MISSION_WEEKS.length - 1 ? (
                    <button type="button" onClick={() => saveActiveWeek(activeWeekIndex + 1)}>
                      Enter {MISSION_WEEKS[activeWeekIndex + 1].badge}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChallengeId(FINAL_MISSION_ID);
                        writeMissionString(MISSION_PLAY_PICK_STORAGE_KEY, FINAL_MISSION_ID);
                      }}
                    >
                      Final Mission Ready
                    </button>
                  )}
                </>
              ) : activeChallenge ? (
                <>
                  <span>{activeChallenge.badge}</span>
                  <h2>{activeChallenge.name}</h2>
                  <p>{activeChallenge.detail}</p>
                  <dl>
                    <div>
                      <dt>Points</dt>
                      <dd>
                        Hit {activeChallenge.points} / Fail +
                        {formatScore(getPointValue(activeChallenge.points) / 2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{activeChallengeResult ?? "Active"}</dd>
                    </div>
                  </dl>
                  {activeChallengeResult ? (
                    <button type="button" disabled>
                      {activeChallengeResult === "hit" ? "Hit Recorded" : "Fail Recorded"}
                    </button>
                  ) : (
                    <div className="zoda-mission-play__challenge-actions">
                      <button type="button" onClick={() => markActiveChallengeResult("hit")}>
                        <Check size={15} aria-hidden="true" />
                        Hit
                      </button>
                      <button
                        type="button"
                        data-result="fail"
                        onClick={() => markActiveChallengeResult("fail")}
                      >
                        <X size={15} aria-hidden="true" />
                        Fail
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span>{activeWeek.badge}</span>
                  <h2>Roll for your challenge.</h2>
                  <p>
                    The dice will choose from the incomplete challenges in {activeWeek.title}. Clear
                    the week to unlock the next tier.
                  </p>
                  <button type="button" onClick={rollChallenge} disabled={!canRollChallenge}>
                    <RotateCcw size={15} aria-hidden="true" />
                    {rollIsOnCooldown ? "Roll Locked" : "Pick Challenge"}
                  </button>
                </>
              )}
            </div>
          </aside>
        </section>
      </main>
  );

  if (embedded) return content;

  return (
    <AppShell eyebrow="Mission" title="Play Board">
      <div className="zoda-shell zoda-shell--light zoda-mission-play-page">{content}</div>
    </AppShell>
  );
}
