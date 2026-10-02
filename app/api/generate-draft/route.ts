import { NextRequest, NextResponse } from "next/server";
import type { AnchorKind, SourceType } from "@/lib/types";
import { renderAnchor } from "@/lib/anchors";
import { templateDraft } from "@/lib/templates";

interface GenerateBody {
  sourceSite: string;
  sourceType: SourceType;
  targetUrl: string;
  anchorText: string;
  anchorKind: AnchorKind;
}

function aiPrompt(b: GenerateBody): string {
  const kindHint: Record<AnchorKind, string> = {
    exact: `link the exact phrase "${b.anchorText}"`,
    partial: `link a natural partial-match variation of "${b.anchorText}" (e.g. add a word or two around it)`,
    branded: `link the brand/site name derived from the URL, not the anchor phrase`,
    naked: `paste the bare URL with no anchor text`,
  };
  const formatHint: Record<SourceType, string> = {
    forum: "a helpful forum reply (120-180 words, friendly, first-person, answers a plausible question)",
    profile: "a short profile bio (60-100 words, third- or first-person)",
    article: "a short article excerpt (150-220 words, practical and specific)",
    other: "a short helpful post (120-180 words)",
  };
  return [
    `Write ${formatHint[b.sourceType]} suitable for posting on ${b.sourceSite}.`,
    `It should be genuinely useful and topically relevant to a word-game / puzzle website.`,
    `Mention the link only once, where it fits naturally: ${kindHint[b.anchorKind]} pointing to ${b.targetUrl}.`,
    `Do not stuff keywords. Do not sound like an ad. Plain text only, no markdown headings.`,
  ].join(" ");
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { sourceSite, sourceType, targetUrl, anchorText, anchorKind } = body;
  if (!sourceSite || !targetUrl) {
    return NextResponse.json({ error: "sourceSite and targetUrl are required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      draft: templateDraft(sourceType, sourceSite, targetUrl, anchorText || targetUrl, anchorKind),
      draftSource: "template",
      note: "No OPENAI_API_KEY set — used built-in template. Add the key in Vercel env vars for AI drafts.",
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 400,
        messages: [
          { role: "system", content: "You write natural, helpful web content for link placements. Never spammy." },
          { role: "user", content: aiPrompt({ sourceSite, sourceType, targetUrl, anchorText, anchorKind }) },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const draft: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!draft) throw new Error("Empty completion");
    // Ensure the URL appears at least once
    const withUrl = draft.includes(targetUrl)
      ? draft
      : `${draft}\n\n${renderAnchor(anchorKind, targetUrl, anchorText || targetUrl).text}`;
    return NextResponse.json({ draft: withUrl, draftSource: "ai" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI generation failed";
    return NextResponse.json({
      draft: templateDraft(sourceType, sourceSite, targetUrl, anchorText || targetUrl, anchorKind),
      draftSource: "template",
      note: `AI failed (${message}) — used built-in template instead.`,
    });
  }
}
