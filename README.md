# Backlink Planner

A daily backlink outreach planner. Upload your source sites and target pages,
generate 10 outreach tasks a day with ready-to-post drafts, track each one from
Pending → Submitted → Live, and export the log as CSV.

## Deploy on Vercel

1. Push this repo to GitHub (or import it directly in Vercel).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: Next.js.
3. (Optional, for AI-written drafts) Add an environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: your OpenAI API key
   - Without it, the app falls back to built-in draft templates.
4. Deploy.

## CSV formats

**Source sites** — one site URL per row (a header row is optional; only the
first column is read, everything else is ignored):
```csv
https://example-forum.com
https://directory.example.com
example-blog.com
```

**Your pages** (`Target URL, Anchor Text`):
```csv
Target URL,Anchor Text
https://blossomgamez.com/spelling-bee-solver,spelling bee solver
https://blossomgamez.com/,BlossomGamez
```

## How it works

- **Generate today's 10** picks up to 10 unused source × target pairs per day
  (a pair is never reused; deleting a task frees its pair).
- Each task gets a draft (forum reply, profile bio, or short article depending on
  source type). With `OPENAI_API_KEY` set, drafts are AI-written; otherwise
  built-in templates are used.
- Anchor types rotate automatically: exact → partial → branded → naked URL.
- Anchors used more than 3 times are flagged as overused.
- Each card has a copy button, status dropdown (Pending / Submitted / Live /
  Rejected), live-link field, and date field.
- **Export CSV** downloads the full task log.

## Notes

- All data (uploads, tasks, pair history) is stored in the browser's
  localStorage — per device/browser, no account needed.
- Never commit `.env.local` — keys live in Vercel environment variables.
