"use client";

import { useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { ANCHOR_KIND_LABELS, TASK_STATUSES } from "@/lib/types";

interface Props {
  task: Task;
  onChange: (t: Task) => void;
  onDelete: (id: string) => void;
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Submitted: "bg-blue-100 text-blue-800 border-blue-300",
  Live: "bg-green-100 text-green-800 border-green-300",
  Rejected: "bg-red-100 text-red-800 border-red-300",
};

export default function TaskCard({ task, onChange, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(task.draft);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = task.draft;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const set = <K extends keyof Task>(k: K, v: Task[K]) => onChange({ ...task, [k]: v });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={task.sourceSite.startsWith("http") ? task.sourceSite : `https://${task.sourceSite}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-700 hover:underline break-all"
          >
            {task.sourceSite}
          </a>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 capitalize">
              {task.sourceType}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              {ANCHOR_KIND_LABELS[task.anchorKind]}
            </span>
            {task.draftSource === "template" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                template draft
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="text-slate-400 hover:text-red-600 text-sm shrink-0"
          title="Delete task"
        >
          ✕
        </button>
      </div>

      <div className="text-xs text-slate-500 break-all">
        <span className="font-medium">Target:</span>{" "}
        <a href={task.targetUrl} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:underline">
          {task.targetUrl}
        </a>
        <div className="mt-0.5">
          <span className="font-medium">Anchor:</span> <span className="text-slate-700">“{task.anchorText}”</span>
        </div>
      </div>

      <div className="relative">
        <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-3 pr-10 max-h-44 overflow-y-auto">
          {task.draft}
        </p>
        <button
          onClick={copyDraft}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 shadow-sm"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500 flex flex-col gap-1">
          Status
          <select
            value={task.status}
            onChange={(e) => set("status", e.target.value as TaskStatus)}
            className={`text-sm rounded-md border px-2 py-1.5 font-medium ${STATUS_STYLES[task.status]}`}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500 flex flex-col gap-1">
          Date
          <input
            type="date"
            value={task.liveDate}
            onChange={(e) => set("liveDate", e.target.value)}
            className="text-sm rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
      </div>
      <label className="text-xs text-slate-500 flex flex-col gap-1">
        Live link (URL where it was published)
        <input
          type="url"
          placeholder="https://…"
          value={task.liveUrl}
          onChange={(e) => set("liveUrl", e.target.value)}
          className="text-sm rounded-md border border-slate-300 px-2 py-1.5"
        />
      </label>
    </div>
  );
}
