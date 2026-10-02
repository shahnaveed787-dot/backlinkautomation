export type SourceType = "forum" | "profile" | "article" | "other";

export interface SourceSite {
  id: string;
  site: string; // Source Site URL or name
  type: SourceType; // Source Type
}

export interface TargetPage {
  id: string;
  url: string; // Target URL
  anchor: string; // Anchor Text
}

export type AnchorKind = "exact" | "partial" | "branded" | "naked";

export type TaskStatus = "Pending" | "Submitted" | "Live" | "Rejected";

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD the task was generated
  sourceId: string;
  sourceSite: string;
  sourceType: SourceType;
  targetId: string;
  targetUrl: string;
  anchorText: string;
  anchorKind: AnchorKind;
  draft: string;
  draftSource: "ai" | "template";
  status: TaskStatus;
  liveUrl: string;
  liveDate: string;
  createdAt: number;
}

export const ANCHOR_KINDS: AnchorKind[] = ["exact", "partial", "branded", "naked"];

export const ANCHOR_KIND_LABELS: Record<AnchorKind, string> = {
  exact: "Exact match",
  partial: "Partial match",
  branded: "Branded",
  naked: "Naked URL",
};

export const TASK_STATUSES: TaskStatus[] = ["Pending", "Submitted", "Live", "Rejected"];
