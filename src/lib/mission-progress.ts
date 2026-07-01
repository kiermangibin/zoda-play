export const MISSION_PLAYBOOK_STORAGE_KEY = "zoda-mission-playbook-checks";
export const MISSION_RESULTS_STORAGE_KEY = "zoda-mission-play-results";
export const MISSION_DICE_STORAGE_KEY = "zoda-mission-dice-roll";
export const MISSION_LAST_ROLL_STORAGE_KEY = "zoda-mission-last-roll-at";
export const MISSION_PLAY_WEEK_STORAGE_KEY = "zoda-mission-play-active-week";
export const MISSION_PLAY_PICK_STORAGE_KEY = "zoda-mission-play-active-challenge";
export const MISSION_FINAL_STORAGE_KEY = "zoda-mission-final-complete";

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readMissionJson<T>(key: string, fallback: T): T {
  try {
    const storage = getStorage();
    const value = storage?.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeMissionJson(key: string, value: unknown) {
  getStorage()?.setItem(key, JSON.stringify(value));
}

export function readMissionString(key: string) {
  return getStorage()?.getItem(key) ?? null;
}

export function writeMissionString(key: string, value: string) {
  getStorage()?.setItem(key, value);
}

export function removeMissionValue(key: string) {
  getStorage()?.removeItem(key);
}
