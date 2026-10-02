"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TaskCard from "@/components/TaskCard";
import type { AnchorKind, SourceSite, TargetPage, Task } from "@/lib/types";
import { parseCsv, rowsToObjects, toCsv, normalizeUrl, readUploadRows } from "@/lib/csv";
import { store, todayKey, uid } from "@/lib/storage";
import { countAnchorKinds, findOverusedAnchors, nextAnchorKind } from "@/lib/anchors";

const DAILY_LIMIT = 10;

interface GenProgress {
  done: number;
  total: number;
}

export default function Home() {
  const [sources, setSources] = useState<SourceSite[]>([]);
  const [targets, setTargets] = useState<TargetPage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [usedPairs, setUsedPairs] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const sourcesFile = useRef<HTMLInputElement>(null);
  const targetsFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSources(store.getSources());
    setTargets(store.getTargets());
    setTasks(store.getTasks());
    setUsedPairs(store.getUsedPairs());
  }, []);

  const persistTasks = (t: Task[]) => {
    setTasks(t);
    store.setTasks(t);
  };

  const today = todayKey();
  const todaysTasks = useMemo(() => tasks.filter((t) => t.date === today), [tasks, today]);
  const remainingToday = Math.max(0, DAILY_LIMIT - todaysTasks.length);

  const overused = useMemo(() => findOverusedAnchors(tasks), [tasks]);
  const kindCounts = useMemo(() => countAnchorKinds(tasks), [tasks]);

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "all") return sorted;
    if (filter === "today") return sorted.filter((t) => t.date === today);
    return sorted.filter((t) => t.status === filter);
  }, [tasks, filter, today]);

  async function handleSourcesFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const rows = await readUploadRows(f);
      if (rows.length === 0) throw new Error("File is empty.");
      // Find the URL column: prefer a "Nandla Links" header; otherwise first column.
      const normH = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, "");
      const headerRow = rows[0].map(normH);
      let urlCol = 0;
      let dataRows = rows;
      const nandlaIdx = headerRow.findIndex((h) => h === "nandlalinks" || h.includes("nandla"));
      if (nandlaIdx >= 0) {
        urlCol = nandlaIdx;
        dataRows = rows.slice(1);
      } else {
        // Generic header detection fallback
        const generic = ["sourcesite", "sourcesites", "site", "sites", "url", "urls", "source", "sources", "website", "websites", "domain", "domains", "link", "links"];
        if (generic.includes(headerRow[0] ?? "")) dataRows = rows.slice(1);
      }
      const parsed: SourceSite[] = [];
      let skipped = 0;
      for (const r of dataRows) {
        const site = normalizeUrl(r[urlCol] ?? "");
        if (!site) {
          skipped++;
          continue;
        }
        parsed.push({ id: uid(), site, type: "other" });
      }
      if (parsed.length === 0)
        throw new Error("No valid rows. Put one site URL per row (e.g. https://example-forum.com).");
      setSources(parsed);
      store.setSources(parsed);
      setError(null);
      setNotice(skipped > 0 ? `${skipped} row${skipped === 1 ? "" : "s"} skipped — not valid URLs.` : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse sources CSV.");
      setNotice(null);
    }
    e.target.value = "";
  }

  async function handleTargetsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const rows = await readUploadRows(f);
      const objs = rowsToObjects(rows);
      const parsed: TargetPage[] = [];
      let skipped = 0;
      for (const o of objs) {
        const raw = o["targeturl"] || o["url"] || o["link"] || "";
        const url = normalizeUrl(raw);
        if (!url) {
          skipped++;
          continue;
        }
        parsed.push({
          id: uid(),
          url,
          anchor: o["anchortext"] || o["anchor"] || o["text"] || "",
        });
      }
      if (parsed.length === 0)
        throw new Error("No valid rows. 'Target URL' must be a valid page URL (e.g. https://yoursite.com/page).");
      setTargets(parsed);
      store.setTargets(parsed);
      setError(null);
      setNotice(skipped > 0 ? `${skipped} row${skipped === 1 ? "" : "s"} skipped — not valid URLs.` : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse targets CSV.");
      setNotice(null);
    }
    e.target.value = "";
  }

  async function generateDraft(sourceSite: string, sourceType: SourceSite["type"], targetUrl: string, anchorText: string, anchorKind: AnchorKind) {
    const res = await fetch("/api/generate-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceSite, sourceType, targetUrl, anchorText, anchorKind }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Draft generation failed");
    return data as { draft: string; draftSource: "ai" | "template"; note?: string };
  }

  async function generateTodays() {
    setError(null);
    if (sources.length === 0 || targets.length === 0) {
      setError("Upload both CSVs first — source sites and your pages.");
      return;
    }
    if (remainingToday <= 0) {
      setError(`Daily limit reached — ${DAILY_LIMIT} tasks already generated today.`);
      return;
    }
    const used = new Set(usedPairs);
    const pairs: { s: SourceSite; t: TargetPage }[] = [];
    // Build all unused pairs, shuffled for variety
    const allPairs: { s: SourceSite; t: TargetPage }[] = [];
    for (const s of sources) {
      for (const t of targets) {
        if (!used.has(`${s.id}|${t.id}`)) allPairs.push({ s, t });
      }
    }
    // Shuffle
    for (let i = allPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
    }
    // Take up to remainingToday, ensuring source variety (avoid same source twice if possible)
    const seenSources = new Set<string>();
    for (const p of allPairs) {
      if (pairs.length >= remainingToday) break;
      if (seenSources.has(p.s.id) && allPairs.length > remainingToday) continue;
      seenSources.add(p.s.id);
      pairs.push(p);
    }
    if (pairs.length === 0) {
      setError("No unused source/target pairs left. Upload more sources or targets.");
      return;
    }

    setGenerating(true);
    setProgress({ done: 0, total: pairs.length });
    const newTasks: Task[] = [];
    const newUsed = [...usedPairs];
    const kindCount = { ...kindCounts };

    try {
      for (let i = 0; i < pairs.length; i++) {
        const { s, t } = pairs[i];
        const anchorKind = nextAnchorKind(kindCount);
        kindCount[anchorKind] = (kindCount[anchorKind] ?? 0) + 1;
        const { draft, draftSource } = await generateDraft(s.site, s.type, t.url, t.anchor || t.url, anchorKind);
        newTasks.push({
          id: uid(),
          date: today,
          sourceId: s.id,
          sourceSite: s.site,
          sourceType: s.type,
          targetId: t.id,
          targetUrl: t.url,
          anchorText: t.anchor || t.url,
          anchorKind,
          draft,
          draftSource,
          status: "Pending",
          liveUrl: "",
          liveDate: today,
          createdAt: Date.now() + i,
        });
        newUsed.push(`${s.id}|${t.id}`);
        setProgress({ done: i + 1, total: pairs.length });
      }
      const updated = [...newTasks, ...tasks];
      persistTasks(updated);
      setUsedPairs(newUsed);
      store.setUsedPairs(newUsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed partway.");
      // keep whatever was generated
      if (newTasks.length > 0) {
        const updated = [...newTasks, ...tasks];
        persistTasks(updated);
        setUsedPairs(newUsed);
        store.setUsedPairs(newUsed);
      }
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  function exportCsv() {
    const headers = ["Date", "Source Site", "Source Type", "Target URL", "Anchor Text", "Anchor Kind", "Status", "Live URL", "Live Date", "Draft"];
    const rows = tasks.map((t) => [t.date, t.sourceSite, t.sourceType, t.targetUrl, t.anchorText, t.anchorKind, t.status, t.liveUrl, t.liveDate, t.draft]);
    const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backlink-log-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const updateTask = (t: Task) => persistTasks(tasks.map((x) => (x.id === t.id ? t : x)));
  const deleteTask = (id: string) => {
    const gone = tasks.find((x) => x.id === id);
    persistTasks(tasks.filter((x) => x.id !== id));
    // free the pair so it can be reused later
    if (gone) {
      const key = `${gone.sourceId}|${gone.targetId}`;
      const next = usedPairs.filter((p) => p !== key);
      setUsedPairs(next);
      store.setUsedPairs(next);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Backlink Planner</h1>
          <p className="text-slate-500 mt-1">Plan 10 outreach tasks a day. Track them from draft to live.</p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {notice && !error && (
          <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-800">{notice}</div>
        )}

        {overused.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Overused anchors:</span>{" "}
            {overused.map((o) => `${o.anchor} (${o.count}×)`).join(", ")} — vary these to stay natural.
          </div>
        )}

        {/* Uploads */}
        <section className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-1">1. Source sites CSV</h2>
            <p className="text-xs text-slate-500 mb-3">Upload CSV or XLSX. Reads the “Nandla Links” column (or first column). Other columns like DA / Traffic / Spam Score are ignored.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => sourcesFile.current?.click()} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
                Upload CSV
              </button>
              <span className="text-sm text-slate-600">{sources.length} sources loaded</span>
            </div>
            <input ref={sourcesFile} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleSourcesFile} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-1">2. Your pages CSV</h2>
            <p className="text-xs text-slate-500 mb-3">Headers: <code>Target URL, Anchor Text</code>. Target URL must be a valid URL.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => targetsFile.current?.click()} className="text-sm px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
                Upload CSV
              </button>
              <span className="text-sm text-slate-600">{targets.length} pages loaded</span>
            </div>
            <input ref={targetsFile} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleTargetsFile} />
          </div>
        </section>

        {/* Generate */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 mb-6 flex flex-wrap items-center gap-4">
          <button
            onClick={generateTodays}
            disabled={generating || remainingToday <= 0}
            className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating && progress
              ? `Generating ${progress.done}/${progress.total}…`
              : `Generate today's ${Math.min(DAILY_LIMIT, remainingToday)}`}
          </button>
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{todaysTasks.length}/{DAILY_LIMIT}</span> tasks today
            <span className="mx-2">·</span>{tasks.length} total
            <span className="mx-2">·</span>
            exact {kindCounts.exact} / partial {kindCounts.partial} / branded {kindCounts.branded} / naked {kindCounts.naked}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={exportCsv} disabled={tasks.length === 0} className="text-sm px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40">
              Export CSV
            </button>
            <button
              onClick={() => { if (confirm("Clear all data?")) { store.clearAll(); setSources([]); setTargets([]); setTasks([]); setUsedPairs([]); } }}
              className="text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", "today", "Pending", "Submitted", "Live", "Rejected"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-full border ${filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"}`}
            >
              {f === "all" ? "All" : f === "today" ? "Today" : f}
            </button>
          ))}
        </div>

        {/* Tasks */}
        {filteredTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 text-sm">
            No tasks yet. Upload both CSVs, then hit “Generate today’s 10”.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredTasks.map((t) => (
              <TaskCard key={t.id} task={t} onChange={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        )}

        <footer className="mt-10 text-xs text-slate-400">
          Drafts are generated {process.env.NEXT_PUBLIC_AI === "1" ? "with AI" : "via built-in templates unless OPENAI_API_KEY is set on Vercel"}. Data is stored in this browser only.
        </footer>
      </div>
    </main>
  );
}
