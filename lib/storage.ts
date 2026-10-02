import type { SourceSite, TargetPage, Task } from "./types";

const K = {
  sources: "bp_sources",
  targets: "bp_targets",
  tasks: "bp_tasks",
  usedPairs: "bp_used_pairs", // JSON array of "sourceId|targetId"
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / unavailable — ignore
  }
}

export const store = {
  getSources: (): SourceSite[] => read<SourceSite[]>(K.sources, []),
  setSources: (v: SourceSite[]) => write(K.sources, v),
  getTargets: (): TargetPage[] => read<TargetPage[]>(K.targets, []),
  setTargets: (v: TargetPage[]) => write(K.targets, v),
  getTasks: (): Task[] => read<Task[]>(K.tasks, []),
  setTasks: (v: Task[]) => write(K.tasks, v),
  getUsedPairs: (): string[] => read<string[]>(K.usedPairs, []),
  setUsedPairs: (v: string[]) => write(K.usedPairs, v),
  clearAll: () => {
    if (typeof window === "undefined") return;
    Object.values(K).forEach((k) => localStorage.removeItem(k));
  },
};

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
