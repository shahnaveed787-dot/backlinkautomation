import type { AnchorKind, Task } from "./types";
import { ANCHOR_KINDS } from "./types";

/** Extract a brand-ish name from a URL's hostname. */
export function brandFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const name = parts.length > 2 ? parts.slice(0, -1).join(" ") : parts[0];
    return name
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return url;
  }
}

/**
 * Render the link portion of a draft for a given anchor kind.
 * Returns { html, text } — html uses an <a> tag, text is a plain-text fallback.
 */
export function renderAnchor(kind: AnchorKind, targetUrl: string, anchorText: string): { html: string; text: string } {
  const safeUrl = targetUrl;
  switch (kind) {
    case "exact":
      return {
        html: `<a href="${safeUrl}">${anchorText}</a>`,
        text: `${anchorText} (${safeUrl})`,
      };
    case "partial": {
      const partial = `best ${anchorText} guide`;
      return {
        html: `<a href="${safeUrl}">${partial}</a>`,
        text: `${partial} (${safeUrl})`,
      };
    }
    case "branded": {
      const brand = brandFromUrl(targetUrl);
      return {
        html: `<a href="${safeUrl}">${brand}</a>`,
        text: `${brand} (${safeUrl})`,
      };
    }
    case "naked":
      return {
        html: `<a href="${safeUrl}">${safeUrl}</a>`,
        text: safeUrl,
      };
  }
}

/** Pick the next anchor kind, rotating to keep the mix varied. */
export function nextAnchorKind(counts: Record<AnchorKind, number>): AnchorKind {
  let best: AnchorKind = ANCHOR_KINDS[0];
  let bestCount = Infinity;
  for (const k of ANCHOR_KINDS) {
    const c = counts[k] ?? 0;
    if (c < bestCount) {
      bestCount = c;
      best = k;
    }
  }
  return best;
}

export const OVERUSE_THRESHOLD = 3;

/** Count anchor-text usage across tasks; return texts used more than threshold. */
export function findOverusedAnchors(tasks: Task[]): { anchor: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const key = t.anchorText.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const result: { anchor: string; count: number }[] = [];
  counts.forEach((count, anchor) => {
    if (count > OVERUSE_THRESHOLD) result.push({ anchor, count });
  });
  return result.sort((a, b) => b.count - a.count);
}

export function countAnchorKinds(tasks: Task[]): Record<AnchorKind, number> {
  const counts: Record<AnchorKind, number> = { exact: 0, partial: 0, branded: 0, naked: 0 };
  for (const t of tasks) counts[t.anchorKind] = (counts[t.anchorKind] ?? 0) + 1;
  return counts;
}
