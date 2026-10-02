import type { AnchorKind, SourceType } from "./types";
import { renderAnchor } from "./anchors";

/**
 * Fallback draft templates used when no AI key is configured.
 * Each mentions the link only where it fits the topic naturally.
 */
export function templateDraft(
  sourceType: SourceType,
  sourceSite: string,
  targetUrl: string,
  anchorText: string,
  anchorKind: AnchorKind
): string {
  const link = renderAnchor(anchorKind, targetUrl, anchorText);
  const siteName = sourceSite.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (sourceType === "forum") {
    return (
      `Hi everyone — ran into this exact question last week and spent a while testing different approaches. ` +
      `What finally worked for me was breaking the problem into smaller steps and tackling the highest-impact one first. ` +
      `If you want a deeper walkthrough, this ${link.text} covers the method I followed pretty closely. ` +
      `Happy to answer follow-ups if anyone gets stuck on a particular step — good luck!`
    );
  }

  if (sourceType === "profile") {
    return (
      `Digital marketer and word-game enthusiast. I spend most of my time building small web tools and writing about ` +
      `what I learn along the way. Currently working on ${link.text} — a side project I maintain in my spare time. ` +
      `Always happy to connect with other builders; feel free to reach out.`
    );
  }

  // article (default for "article" and "other")
  return (
      `A practical short guide based on what actually worked.\n\n` +
      `Start with the simplest version of the task and get it working end to end before adding complexity. ` +
      `Most people over-engineer the first attempt; a minimal version you can iterate on beats a perfect plan you never ship.\n\n` +
      `Measure one thing at a time so you know what moved the needle. When I applied this to my own project ` +
      `(${link.text}), the biggest gains came from the least glamorous fixes.\n\n` +
      `Revisit monthly. Small, steady improvements compound faster than occasional big rewrites. (via ${siteName})`
    );
}

export function normalizeSourceType(raw: string): SourceType {
  const t = raw.trim().toLowerCase();
  if (["forum", "forums", "discussion", "community", "qa"].includes(t)) return "forum";
  if (["profile", "bio", "about"].includes(t)) return "profile";
  if (["article", "blog", "guest post", "guestpost"].includes(t)) return "article";
  return "other";
}
